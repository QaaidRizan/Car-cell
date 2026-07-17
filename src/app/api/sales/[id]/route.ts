import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { calculatePaymentInfo } from '@/lib/utils';
import { uploadDocument, deleteDocument } from '@/lib/azure-storage';
import { FileType } from '@prisma/client';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;

  try {
    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        car: true,
        customer: true,
        payments: {
          orderBy: { paymentDate: 'desc' },
        },
        installmentPlan: true,
        financeDetail: true,
        documents: true,
      }
    });

    if (!sale) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
    }

    const paymentInfo = calculatePaymentInfo(Number(sale.sellingPrice), sale.payments.map((p: any) => ({ amount: Number(p.amount) })));

    return NextResponse.json({
      data: {
        ...sale,
        ...paymentInfo,
      }
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch sale' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;

  try {
    // Note: Due to onDelete: Cascade in schema, deleting Sale deletes Car, InstallmentPlan, Payment, Document rows.
    // However, the actual blobs in Azure Storage should be deleted. We'll handle blob deletion when doing documents.
    // Ideally, we fetch documents first, delete blobs, then delete the sale.
    const saleWithDocs = await prisma.sale.findUnique({
      where: { id },
      include: { documents: true }
    });

    if (!saleWithDocs) return NextResponse.json({ error: 'Sale not found' }, { status: 404 });

    // Delete documents from storage
    if (saleWithDocs.documents && saleWithDocs.documents.length > 0) {
      for (const doc of saleWithDocs.documents) {
        if (doc.fileUrl) {
          await deleteDocument(doc.fileUrl);
        }
      }
    }

    await prisma.sale.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to delete sale' }, { status: 500 });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;

  try {
    const formData = await request.formData();
    const saleDataStr = formData.get('saleData') as string;
    if (!saleDataStr) return NextResponse.json({ error: 'saleData is required' }, { status: 400 });

    const saleData = JSON.parse(saleDataStr);
    const { car, customer, sale, installmentPlan, financeDetail, deletedDocumentIds } = saleData;

    // 1. Handle Document Deletions from Storage
    if (deletedDocumentIds && Array.isArray(deletedDocumentIds) && deletedDocumentIds.length > 0) {
      const docsToDelete = await prisma.document.findMany({
        where: { id: { in: deletedDocumentIds }, saleId: id }
      });

      for (const doc of docsToDelete) {
        await deleteDocument(doc.fileUrl);
      }
    }

    // 2. Handle New Document Uploads
    const newDocumentsData: any[] = [];

    for (const [key, value] of formData.entries()) {
      if (key.startsWith('file_') && value instanceof File) {
        const index = key.split('_')[1];

        if (value.size > 20 * 1024 * 1024) continue; // Skip large files

        let fileType: FileType;
        if (value.type === 'application/pdf') fileType = 'PDF';
        else if (value.type.startsWith('image/')) fileType = 'IMAGE';
        else continue;

        const arrayBuffer = await value.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const fileUrl = await uploadDocument(buffer, value.name, value.type);

        newDocumentsData.push({
          fileUrl,
          fileType,
          originalFileName: value.name,
        });
      }
    }

    // 3. Update Database using Prisma Transaction
    const existingSale = await prisma.sale.findUnique({
      where: { id },
      include: { car: true, customer: true }
    });

    if (!existingSale) return NextResponse.json({ error: 'Sale not found' }, { status: 404 });

    const updatedSale = await prisma.$transaction(async (tx: any) => {
      // Update Customer
      if (customer) {
        await tx.customer.update({
          where: { id: existingSale.customerId },
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
      }

      // Update Car
      if (car) {
        await tx.car.update({
          where: { id: existingSale.carId },
          data: {
            make: car.make,
            model: car.model,
            year: car.year ? Number(car.year) : undefined,
            vin: car.vin,
            registrationNumber: car.registrationNumber,
            color: car.color,
            mileage: car.mileage ? Number(car.mileage) : undefined,
            notes: car.notes,
          }
        });
      }

      // Update Sale
      let updatedSaleRecord = existingSale;
      if (sale) {
        updatedSaleRecord = await tx.sale.update({
          where: { id },
          data: {
            saleDate: sale.saleDate ? new Date(sale.saleDate) : undefined,
            sellingPrice: sale.sellingPrice,
            paymentType: sale.paymentType,
            notes: sale.notes,
          }
        });
      }

      // Manage Installment Plan
      if (sale && sale.paymentType === 'INSTALLMENT' && installmentPlan) {
        await tx.installmentPlan.upsert({
          where: { saleId: id },
          update: {
            downPayment: installmentPlan.downPayment,
            installmentAmount: installmentPlan.installmentAmount,
            frequency: installmentPlan.frequency,
            customFrequencyDays: installmentPlan.customFrequencyDays ? Number(installmentPlan.customFrequencyDays) : null,
            numberOfInstallments: Number(installmentPlan.numberOfInstallments),
            nextDueDate: new Date(installmentPlan.nextDueDate),
          },
          create: {
            saleId: id,
            downPayment: installmentPlan.downPayment,
            installmentAmount: installmentPlan.installmentAmount,
            frequency: installmentPlan.frequency,
            customFrequencyDays: installmentPlan.customFrequencyDays ? Number(installmentPlan.customFrequencyDays) : null,
            numberOfInstallments: Number(installmentPlan.numberOfInstallments),
            nextDueDate: new Date(installmentPlan.nextDueDate),
          }
        });
      } else if (sale && sale.paymentType !== 'INSTALLMENT') {
        await tx.installmentPlan.deleteMany({
          where: { saleId: id }
        });
      }

      // Manage Finance Detail
      if (sale && sale.paymentType === 'FINANCING' && financeDetail) {
        await tx.financeDetail.upsert({
          where: { saleId: id },
          update: {
            financeCompanyName: financeDetail.financeCompanyName,
            loanAgreementNumber: financeDetail.loanAgreementNumber,
            loanAmount: financeDetail.loanAmount ? Number(financeDetail.loanAmount) : null,
            downPayment: financeDetail.downPayment ? Number(financeDetail.downPayment) : null,
            financeStatus: financeDetail.financeStatus,
            note: financeDetail.note,
          },
          create: {
            saleId: id,
            financeCompanyName: financeDetail.financeCompanyName,
            loanAgreementNumber: financeDetail.loanAgreementNumber,
            loanAmount: financeDetail.loanAmount ? Number(financeDetail.loanAmount) : null,
            downPayment: financeDetail.downPayment ? Number(financeDetail.downPayment) : null,
            financeStatus: financeDetail.financeStatus,
            note: financeDetail.note,
          }
        });
      } else if (sale && sale.paymentType !== 'FINANCING') {
        await tx.financeDetail.deleteMany({
          where: { saleId: id }
        });
      }

      // Manage Documents
      if (deletedDocumentIds && Array.isArray(deletedDocumentIds) && deletedDocumentIds.length > 0) {
        await tx.document.deleteMany({
          where: { id: { in: deletedDocumentIds }, saleId: id }
        });
      }

      if (newDocumentsData.length > 0) {
        for (const doc of newDocumentsData) {
          await tx.document.create({
            data: {
              ...doc,
              saleId: id,
            }
          });
        }
      }

      return updatedSaleRecord;
    });

    return NextResponse.json({ data: updatedSale, success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to update sale' }, { status: 500 });
  }
}
