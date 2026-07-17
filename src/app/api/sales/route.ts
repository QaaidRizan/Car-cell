import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { calculatePaymentInfo } from '@/lib/utils';
import { Prisma } from '@prisma/client';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search');
  const paymentStatus = searchParams.get('paymentStatus'); // PAID, PARTIALLY_PAID, UNPAID
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '25');

  const where: Prisma.SaleWhereInput = {};

  if (search) {
    where.OR = [
      { customer: { fullName: { contains: search, mode: 'insensitive' } } },
      { car: { make: { contains: search, mode: 'insensitive' } } },
      { car: { model: { contains: search, mode: 'insensitive' } } },
      { car: { registrationNumber: { contains: search, mode: 'insensitive' } } },
      { car: { vin: { contains: search, mode: 'insensitive' } } },
    ];
  }

  try {
    const sales = await prisma.sale.findMany({
      where,
      include: {
        car: true,
        customer: true,
        payments: true,
      },
      orderBy: { saleDate: 'desc' },
      // Note: For large datasets, pagination should be handled here with skip/take
      // But filtering by computed paymentStatus is tricky in pure SQL without raw queries or views.
      // Since it's a single user app, we'll fetch more or handle in JS if paymentStatus filter is applied.
    });

    const enrichedSales = sales.map((sale: any) => {
      const paymentInfo = calculatePaymentInfo(Number(sale.sellingPrice), sale.payments.map((p: any) => ({ amount: Number(p.amount) })));
      return {
        ...sale,
        ...paymentInfo,
      };
    });

    let filteredSales = enrichedSales;
    if (paymentStatus) {
      filteredSales = enrichedSales.filter((s: any) => s.paymentStatus === paymentStatus);
    }

    const startIndex = (page - 1) * limit;
    const paginatedSales = filteredSales.slice(startIndex, startIndex + limit);

    return NextResponse.json({
      data: paginatedSales,
      total: filteredSales.length,
      page,
      totalPages: Math.ceil(filteredSales.length / limit),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch sales' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { car, customer, sale, installmentPlan, financeDetail } = body;

    // Validation
    if (!car?.vin || !car?.registrationNumber) return NextResponse.json({ error: 'Car VIN and Registration Number are required' }, { status: 400 });
    if (!customer?.fullName || !customer?.nicNumber || !customer?.phone) return NextResponse.json({ error: 'Customer Name, NIC, and Phone are required' }, { status: 400 });
    if (!sale?.sellingPrice || !sale?.saleDate || !sale?.paymentType) return NextResponse.json({ error: 'Selling Price, Sale Date, and Payment Type are required' }, { status: 400 });
    if (Number(sale.sellingPrice) <= 0) return NextResponse.json({ error: 'Selling Price must be positive' }, { status: 400 });

    if (sale.paymentType === 'INSTALLMENT' && !installmentPlan) {
      return NextResponse.json({ error: 'Installment plan details are required for this payment type' }, { status: 400 });
    }
    if (sale.paymentType === 'FINANCING' && !financeDetail) {
      return NextResponse.json({ error: 'Finance details are required for this payment type' }, { status: 400 });
    }

    // Transactional creation
    const newSale = await prisma.$transaction(async (tx: any) => {
      // Create Customer
      const createdCustomer = await tx.customer.create({
        data: {
          fullName: customer.fullName,
          nicNumber: customer.nicNumber,
          phone: customer.phone,
          email: customer.email,
          address: customer.address,
          guarantorName: customer.guarantorName,
          guarantorContact: customer.guarantorContact,
        }
      });

      // Create Car
      const createdCar = await tx.car.create({
        data: {
          make: car.make,
          model: car.model,
          year: Number(car.year),
          vin: car.vin,
          registrationNumber: car.registrationNumber,
          color: car.color,
          mileage: Number(car.mileage),
          notes: car.notes,
        }
      });

      // Create Sale
      const createdSale = await tx.sale.create({
        data: {
          carId: createdCar.id,
          customerId: createdCustomer.id,
          saleDate: new Date(sale.saleDate),
          sellingPrice: sale.sellingPrice,
          paymentType: sale.paymentType,
          notes: sale.notes,
        }
      });

      // Create initial payment for FULL payment type
      if (sale.paymentType === 'FULL') {
        await tx.payment.create({
          data: {
            saleId: createdSale.id,
            amount: sale.sellingPrice,
            paymentDate: new Date(sale.saleDate),
            notes: 'Full payment on sale date',
          }
        });
      }

      // Create Installment Plan
      if (sale.paymentType === 'INSTALLMENT') {
        await tx.installmentPlan.create({
          data: {
            saleId: createdSale.id,
            downPayment: installmentPlan.downPayment,
            installmentAmount: installmentPlan.installmentAmount,
            frequency: installmentPlan.frequency,
            customFrequencyDays: installmentPlan.customFrequencyDays ? Number(installmentPlan.customFrequencyDays) : null,
            numberOfInstallments: Number(installmentPlan.numberOfInstallments),
            nextDueDate: new Date(installmentPlan.nextDueDate),
          }
        });

        // Add down payment as a payment
        if (Number(installmentPlan.downPayment) > 0) {
          await tx.payment.create({
            data: {
              saleId: createdSale.id,
              amount: installmentPlan.downPayment,
              paymentDate: new Date(sale.saleDate),
              notes: 'Down payment',
            }
          });
        }
      }

      // Create Finance Detail
      if (sale.paymentType === 'FINANCING') {
        await tx.financeDetail.create({
          data: {
            saleId: createdSale.id,
            financeCompanyName: financeDetail.financeCompanyName,
            loanAgreementNumber: financeDetail.loanAgreementNumber,
            loanAmount: financeDetail.loanAmount ? Number(financeDetail.loanAmount) : null,
            downPayment: financeDetail.downPayment ? Number(financeDetail.downPayment) : null,
            financeStatus: financeDetail.financeStatus,
            note: financeDetail.note,
          }
        });

        // Add down payment as a payment if provided
        if (financeDetail.downPayment && Number(financeDetail.downPayment) > 0) {
          await tx.payment.create({
            data: {
              saleId: createdSale.id,
              amount: financeDetail.downPayment,
              paymentDate: new Date(sale.saleDate),
              notes: 'Down payment for Finance',
            }
          });
        }
      }

      return createdSale;
    });

    return NextResponse.json({ data: newSale }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create sale. Please verify inputs.' }, { status: 500 });
  }
}
