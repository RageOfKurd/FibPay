import { FibPayAuth } from './auth.js';
import { FibPayPayments } from './payments.js';

const ENVIRONMENTS = {
  stage: 'https://fib.stage.fib.iq',
  production: 'https://fib.prod.fib.iq',
};

export class FibPay {
  constructor({ clientId, clientSecret, environment = 'stage' } = {}) {
    if (!clientId || !clientSecret) {
      throw new Error('[FibPay] clientId and clientSecret are required.');
    }
    if (!ENVIRONMENTS[environment]) {
      throw new Error(
        `[FibPay] Unknown environment "${environment}". Use "stage" or "production".`,
      );
    }

    const baseUrl = ENVIRONMENTS[environment];
    const auth = new FibPayAuth({ clientId, clientSecret, baseUrl });
    const payments = new FibPayPayments({ auth, baseUrl });

    // Shorthand methods directly on the instance
    this.createPayment = payments.create.bind(payments);
    this.getStatus     = payments.getStatus.bind(payments);
    this.cancelPayment = payments.cancel.bind(payments);
    this.refundPayment = payments.refund.bind(payments);
    this.waitForStatus = payments.waitForStatus.bind(payments);
  }
}