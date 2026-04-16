'use strict';

const FibPayAuth = require('./auth');
const FibPayPayments = require('./payments');

const ENVIRONMENTS = {
  stage: 'https://fib.stage.fib.iq',
  production: 'https://fib.prod.fib.iq',
};

class FibPay {
  constructor({ clientId, clientSecret, environment = 'stage' } = {}) {
    if (!clientId || !clientSecret) {
      throw new Error('[FibPay] clientId and clientSecret are required.');
    }
    if (!ENVIRONMENTS[environment]) {
      throw new Error(`[FibPay] Unknown environment "${environment}". Use "stage" or "production".`);
    }

    this._baseUrl = ENVIRONMENTS[environment];
    this._auth = new FibPayAuth({ clientId, clientSecret, baseUrl: this._baseUrl });

    const payments = new FibPayPayments({ auth: this._auth, baseUrl: this._baseUrl });

    // Direct shorthand methods
    this.createPayment  = payments.create.bind(payments);
    this.getStatus      = payments.getStatus.bind(payments);
    this.cancelPayment  = payments.cancel.bind(payments);
    this.refundPayment  = payments.refund.bind(payments);
    this.waitForStatus  = payments.waitForStatus.bind(payments);

    // Keep .payments namespace for backwards compatibility
    this.payments = payments;
  }
}

module.exports = FibPay;
