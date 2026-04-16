'use strict';

const express = require('express');
const FibPay = require('../index');

const app = express();
app.use(express.json());

const fib = new FibPay({
  clientId: process.env.FIB_CLIENT_ID,
  clientSecret: process.env.FIB_CLIENT_SECRET,
  environment: 'stage',
});

app.get('/pay', async (req, res) => {
  try {
    const payment = await fib.createPayment({
      amount: 2500,
      currency: 'IQD',
      description: 'Demo purchase',
      callbackUrl: 'https://yoursite.com/fib/webhook',
    });

    res.json({
      paymentId: payment.paymentId,
      validUntil: payment.validUntil,
      personalAppLink: payment.personalAppLink,
      businessAppLink: payment.businessAppLink,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/fib/webhook', async (req, res) => {
  const { paymentId, status } = req.body;
  console.log(`[Webhook] Payment ${paymentId} → ${status}`);
  res.sendStatus(200);

  if (status === 'PAID') {
    console.log(`✅ Order for payment ${paymentId} fulfilled.`);
  }
});

app.listen(3000, () => console.log('Server running at http://localhost:3000'));
