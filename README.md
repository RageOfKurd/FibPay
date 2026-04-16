# FibPay

> Official Node.js SDK for the **First Iraqi Bank (FIB) Online Payment Gateway**

---

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [API Reference](#api-reference)
  - [Create Payment](#create-payment)
  - [Get Payment Status](#get-payment-status)
  - [Cancel Payment](#cancel-payment)
  - [Refund Payment](#refund-payment)
  - [Wait for Status](#wait-for-status)
- [Error Handling](#error-handling)
- [Webhook Integration](#webhook-integration)
- [Examples](#examples)

---

## Features

- ✅ Full coverage of the FIB payment API (create, status, cancel, refund)
- 🔐 Automatic OAuth2 token management with expiry refresh
- ⏳ Built-in polling helper (`waitForStatus`)
- 🌍 Stage & Production environment support
- 📦 Zero runtime dependencies
- 📝 Full JSDoc type annotations
- 🔷 ESM-native (`"type": "module"`)

---

## Installation

```bash
npm install fibpay
```

> Requires Node.js **v14 or higher**. This package is **ESM-only** — use `import`, not `require()`.

---

## Quick Start

```js
import { FibPay } from 'fibpay';

const fib = new FibPay({
  clientId: 'YOUR_CLIENT_ID',
  clientSecret: 'YOUR_CLIENT_SECRET',
  environment: 'stage', // or 'production'
});

// Create a payment
const payment = await fib.createPayment({
  amount: 5000,
  currency: 'IQD',
  description: 'Order #001',
});

console.log('QR Code:', payment.qrCode);
console.log('App Link:', payment.personalAppLink);

// Wait until the customer pays (or times out)
const result = await fib.waitForStatus(payment.paymentId);
console.log('Status:', result.status); // 'PAID' | 'DECLINED' | 'REFUNDED'
```

---

## Configuration

```js
import { FibPay } from 'fibpay';

const fib = new FibPay({
  clientId: 'YOUR_CLIENT_ID',        // required
  clientSecret: 'YOUR_CLIENT_SECRET', // required
  environment: 'stage',              // 'stage' (default) | 'production'
});
```

| Option          | Type     | Required | Default   | Description                                        |
|-----------------|----------|----------|-----------|----------------------------------------------------|
| `clientId`      | `string` | ✅        | —         | FIB-issued client ID                               |
| `clientSecret`  | `string` | ✅        | —         | FIB-issued client secret                           |
| `environment`   | `string` | ❌        | `'stage'` | `'stage'` for testing, `'production'` for live     |

**Environment base URLs**

| Environment         | Base URL                      |
|---------------------|-------------------------------|
| Stage (Test Mode)   | `https://fib-stage.fib.iq`   |
| Production (Live)   | `https://fib.prod.fib.iq`    |

> 💡 Store credentials in environment variables — never hard-code them.

```bash
export FIB_CLIENT_ID=your_client_id
export FIB_CLIENT_SECRET=your_client_secret
```

```js
import { FibPay } from 'fibpay';

const fib = new FibPay({
  clientId: process.env.FIB_CLIENT_ID,
  clientSecret: process.env.FIB_CLIENT_SECRET,
});
```

---

## API Reference

### Create Payment

```js
const payment = await fib.createPayment(options);
```

**Options**

| Parameter      | Type     | Required | Default  | Description                                |
|----------------|----------|----------|----------|--------------------------------------------|
| `amount`       | `number` | ✅        | —        | Amount to charge (positive number)         |
| `currency`     | `string` | ❌        | `'IQD'`  | Currency code                              |
| `description`  | `string` | ❌        | —        | Payment description shown to customer      |
| `callbackUrl`  | `string` | ❌        | —        | Webhook URL called on status change        |
| `redirectUrl`  | `string` | ❌        | —        | URL to redirect customer after payment     |

**Response**

```json
{
  "paymentId": "4d6f7625-60f7-48e3-82e3-b4592a4eb993",
  "readableCode": "FIB-XXXX",
  "qrCode": "<base64 PNG>",
  "validUntil": "2024-01-31T12:26:12.544Z",
  "personalAppLink": "https://...",
  "businessAppLink": "https://...",
  "corporateAppLink": "https://..."
}
```

---

### Get Payment Status

```js
const status = await fib.getStatus(paymentId);
```

**Response**

```json
{
  "paymentId": "4d6f7625-...",
  "status": "PAID",
  "validUntil": "2024-01-31T12:26:12.544Z",
  "paidAt": "2024-01-31T12:10:05.000Z",
  "amount": { "amount": 5000, "currency": "IQD" },
  "decliningReason": null,
  "declinedAt": null,
  "paidBy": { "name": "Ahmed Ali", "iban": "IQ98..." }
}
```

**Status values**

| Status               | Description                                    |
|----------------------|------------------------------------------------|
| `UNPAID`             | Payment created, awaiting customer action      |
| `PAID`               | Successfully paid                              |
| `DECLINED`           | Payment was declined (see `decliningReason`)   |
| `REFUND_REQUESTED`   | Refund initiated, processing                   |
| `REFUNDED`           | Refund completed                               |

**Declining reasons**

| Reason                   | Description                        |
|--------------------------|------------------------------------|
| `SERVER_FAILURE`         | Internal error from FIB            |
| `PAYMENT_EXPIRATION`     | Payment link expired               |
| `PAYMENT_CANCELLATION`   | Cancelled by user or merchant      |

---

### Cancel Payment

Cancels an **UNPAID** payment. Returns `null` on success (HTTP 204).

```js
await fib.cancelPayment(paymentId);
```

---

### Refund Payment

Initiates a refund for a **PAID** payment made within the **last 24 hours**.

```js
await fib.refundPayment(paymentId);

// Then poll until status === 'REFUNDED'
const final = await fib.waitForStatus(paymentId);
```

> ⚠️ Only payments with `PAID` status paid within the last 24 hours can be refunded.

---

### Wait for Status

Polls `getStatus()` at regular intervals until a terminal state is reached or the timeout is exceeded.

```js
const result = await fib.waitForStatus(paymentId, options);
```

**Options**

| Parameter    | Type     | Default   | Description                               |
|--------------|----------|-----------|-------------------------------------------|
| `intervalMs` | `number` | `3000`    | Polling interval in milliseconds          |
| `timeoutMs`  | `number` | `300000`  | Max wait time in ms (default: 5 min)      |

Terminal states: `PAID`, `DECLINED`, `REFUNDED`

---

## Error Handling

All SDK methods throw a `FibPayError` on API errors.

```js
import { FibPay, FibPayError } from 'fibpay';

try {
  await fib.createPayment({ amount: 1000 });
} catch (err) {
  if (err instanceof FibPayError) {
    console.error('API Error:', err.message);
    console.error('Status Code:', err.statusCode);
    console.error('Body:', err.body);
  } else {
    throw err; // re-throw unexpected errors
  }
}
```

---

## Webhook Integration

Pass a `callbackUrl` when creating a payment. FIB will `POST` to this URL whenever the payment status changes.

```js
const payment = await fib.createPayment({
  amount: 1000,
  currency: 'IQD',
  callbackUrl: 'https://yoursite.com/fib/webhook',
});
```

**Express.js webhook handler example:**

```js
app.post('/fib/webhook', (req, res) => {
  const { paymentId, status } = req.body;

  // Acknowledge quickly
  res.sendStatus(200);

  // Then handle async
  if (status === 'PAID') {
    fulfillOrder(paymentId);
  }
});
```

---

## Examples

| File | Description |
|------|-------------|
| [`examples/basic.js`](examples/basic.js) | Full create → poll → refund flow |
| [`examples/express-webhook.js`](examples/express-webhook.js) | Express server with webhook handler |

---

## ESM Compatibility Note

This package is **ESM-only**. If your project uses CommonJS (`require()`), you have two options:

**Option 1** — Add `"type": "module"` to your `package.json` and use `import`.

**Option 2** — Use a dynamic import inside a CommonJS file:

```js
const { FibPay } = await import('fibpay');
```

---

## License

[MIT](LICENSE) © [Rageofkurd](https://github.com/Rageofkurd)