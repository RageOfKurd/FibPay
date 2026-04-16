import { FibPay } from '../index.js';

const fib = new FibPay({
  clientId: process.env.FIB_CLIENT_ID || 'YOUR_CLIENT_ID',
  clientSecret: process.env.FIB_CLIENT_SECRET || 'YOUR_CLIENT_SECRET',
  environment: 'stage',
});

async function main() {
  // 1. Create a payment
  console.log('Creating payment...');
  const payment = await fib.createPayment({
    amount: 1000,
    currency: 'IQD',
    description: 'Order #12345',
    callbackUrl: 'https://yoursite.com/fib/webhook',
  });

  console.log('\n✅ Payment created:');
  console.log('  Payment ID  :', payment.paymentId);
  console.log('  Valid Until :', payment.validUntil);
  console.log('  Personal App:', payment.personalAppLink);
  console.log('  Business App:', payment.businessAppLink);

  // 2. Check status once
  const status = await fib.getStatus(payment.paymentId);
  console.log('\n📋 Current status:', status.status);

  // 3. Wait for terminal status (2 min timeout for demo)
  console.log('\n⏳ Waiting for payment to complete...');
  try {
    const final = await fib.waitForStatus(payment.paymentId, {
      intervalMs: 5000,
      timeoutMs: 120_000,
    });

    console.log('\n🎉 Final status:', final.status);

    if (final.status === 'PAID') {
      console.log('  Paid at:', final.paidAt);
      console.log('  Paid by:', final.paidBy?.name, '/', final.paidBy?.iban);

      // 4. Refund
      console.log('\nRefunding payment...');
      await fib.refundPayment(payment.paymentId);
      const refunded = await fib.waitForStatus(payment.paymentId);
      console.log('💸 Refund status:', refunded.status);
    }
  } catch (err) {
    console.warn('\n⚠️', err.message);
    await fib.cancelPayment(payment.paymentId);
    console.log('🚫 Payment cancelled.');
  }
}

main().catch(console.error);