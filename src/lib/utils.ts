export function calculatePaymentInfo(
  sellingPrice: number,
  payments: { amount: number }[]
) {
  const amountPaid = payments.reduce(
    (sum, p) => sum + Number(p.amount),
    0
  );
  const outstandingBalance = Number(sellingPrice) - amountPaid;

  let paymentStatus: 'PAID' | 'PARTIALLY_PAID' | 'UNPAID' = 'UNPAID';
  if (outstandingBalance <= 0) {
    paymentStatus = 'PAID';
  } else if (amountPaid > 0) {
    paymentStatus = 'PARTIALLY_PAID';
  }

  return { amountPaid, outstandingBalance, paymentStatus };
}
