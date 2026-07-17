import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { calculatePaymentInfo } from '@/lib/utils';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: saleId } = await context.params;
  try {
    const payments = await prisma.payment.findMany({
      where: { saleId },
      orderBy: { paymentDate: 'desc' },
    });
    return NextResponse.json({ data: payments });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: saleId } = await context.params;

  try {
    const body = await request.json();
    const { amount, paymentDate, notes } = body;

    if (!amount || Number(amount) <= 0) return NextResponse.json({ error: 'Amount must be positive' }, { status: 400 });
    if (!paymentDate) return NextResponse.json({ error: 'Payment Date is required' }, { status: 400 });

    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: { payments: true }
    });

    if (!sale) return NextResponse.json({ error: 'Sale not found' }, { status: 404 });

    const paymentInfo = calculatePaymentInfo(Number(sale.sellingPrice), sale.payments.map((p: any) => ({ amount: Number(p.amount) })));
    
    if (paymentInfo.outstandingBalance < Number(amount)) {
      return NextResponse.json({ error: `Payment amount cannot exceed the outstanding balance of ${paymentInfo.outstandingBalance}` }, { status: 400 });
    }

    const newPayment = await prisma.payment.create({
      data: {
        saleId,
        amount,
        paymentDate: new Date(paymentDate),
        notes,
      }
    });

    // Recompute and return updated status
    const allPayments = [...sale.payments, newPayment];
    const newPaymentInfo = calculatePaymentInfo(Number(sale.sellingPrice), allPayments.map((p: any) => ({ amount: Number(p.amount) })));

    return NextResponse.json({ data: newPayment, paymentInfo: newPaymentInfo }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 });
  }
}
