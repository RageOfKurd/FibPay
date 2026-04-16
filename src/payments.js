'use strict';

const https = require('https');

class FibPayError extends Error {
  constructor(message, statusCode, body) {
    super(message);
    this.name = 'FibPayError';
    this.statusCode = statusCode;
    this.body = body;
  }
}

class FibPayPayments {
  constructor({ auth, baseUrl }) {
    this._auth = auth;
    this._baseUrl = baseUrl;
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Create a new payment.
   * @param {object} options
   * @param {number}  options.amount              - Amount to charge
   * @param {string}  options.currency            - Currency code, e.g. "IQD"
   * @param {string}  [options.description]       - Optional payment description
   * @param {string}  [options.callbackUrl]       - Webhook URL for status changes
   * @param {string}  [options.redirectUrl]       - URL to redirect user after payment
   * @returns {Promise<PaymentResponse>}
   */
  async create({ amount, currency = 'IQD', description, callbackUrl, redirectUrl } = {}) {
    if (!amount || amount <= 0) throw new Error('[FibPay] amount must be a positive number.');

    const payload = {
      monetaryValue: { amount, currency },
      ...(description && { description }),
      ...(callbackUrl && { statusCallbackUrl: callbackUrl }),
      ...(redirectUrl && { redirectUrl }),
    };

    return this._request('POST', '/protected/v1/payments', payload);
  }

  /**
   * Check the status of a payment.
   * @param {string} paymentId
   * @returns {Promise<PaymentStatus>}
   */
  async getStatus(paymentId) {
    this._requireId(paymentId, 'paymentId');
    return this._request('GET', `/protected/v1/payments/${paymentId}/status`);
  }

  /**
   * Cancel an UNPAID payment.
   * @param {string} paymentId
   * @returns {Promise<void>}
   */
  async cancel(paymentId) {
    this._requireId(paymentId, 'paymentId');
    return this._request('POST', `/protected/v1/payments/${paymentId}/cancel`);
  }

  /**
   * Refund a PAID payment (must have been paid within the last 24 hours).
   * After calling this, poll getStatus() until status is "REFUNDED".
   * @param {string} paymentId
   * @returns {Promise<void>}
   */
  async refund(paymentId) {
    this._requireId(paymentId, 'paymentId');
    return this._request('POST', `/protected/v1/payments/${paymentId}/refund`);
  }

  /**
   * Convenience helper: poll getStatus() until the payment reaches a terminal
   * state (PAID | DECLINED | REFUNDED) or the timeout is exceeded.
   *
   * @param {string} paymentId
   * @param {object} [options]
   * @param {number} [options.intervalMs=3000]   - Polling interval in ms
   * @param {number} [options.timeoutMs=300000]  - Max wait time in ms (default 5 min)
   * @returns {Promise<PaymentStatus>}
   */
  async waitForStatus(paymentId, { intervalMs = 3000, timeoutMs = 300_000 } = {}) {
    this._requireId(paymentId, 'paymentId');

    const TERMINAL = new Set(['PAID', 'DECLINED', 'REFUNDED']);
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const status = await this.getStatus(paymentId);
      if (TERMINAL.has(status.status)) return status;
      await this._sleep(intervalMs);
    }

    throw new Error(`[FibPay] Timed out waiting for payment ${paymentId} to reach a terminal status.`);
  }

  // ─── Internals ─────────────────────────────────────────────────────────────

  async _request(method, path, body) {
    const token = await this._auth.getAccessToken();
    const url = new URL(path, this._baseUrl);
    const bodyStr = body ? JSON.stringify(body) : null;

    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(bodyStr && {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
      }),
    };

    return new Promise((resolve, reject) => {
      const req = https.request(
        { hostname: url.hostname, path: url.pathname + url.search, method, headers },
        (res) => {
          let raw = '';
          res.on('data', (chunk) => (raw += chunk));
          res.on('end', () => {
            // 204 No Content / 202 Accepted with no body
            if (!raw || res.statusCode === 204) return resolve(null);

            try {
              const parsed = JSON.parse(raw);
              if (res.statusCode >= 400) {
                return reject(
                  new FibPayError(
                    parsed.message || parsed.error || `Request failed with status ${res.statusCode}`,
                    res.statusCode,
                    parsed,
                  ),
                );
              }
              resolve(parsed);
            } catch {
              reject(new Error(`[FibPay] Failed to parse response: ${raw}`));
            }
          });
        },
      );
      req.on('error', reject);
      if (bodyStr) req.write(bodyStr);
      req.end();
    });
  }

  _requireId(value, name) {
    if (!value || typeof value !== 'string') {
      throw new Error(`[FibPay] ${name} must be a non-empty string.`);
    }
  }

  _sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
}

module.exports = FibPayPayments;
module.exports.FibPayError = FibPayError;

/**
 * @typedef {object} PaymentResponse
 * @property {string} paymentId
 * @property {string} readableCode
 * @property {string} qrCode          - Base64 QR code image
 * @property {string} validUntil      - ISO-8601 expiry datetime
 * @property {string} personalAppLink - Deep-link for personal FIB app
 * @property {string} businessAppLink - Deep-link for business FIB app
 * @property {string} corporateAppLink
 */

/**
 * @typedef {object} PaymentStatus
 * @property {string} paymentId
 * @property {'PAID'|'UNPAID'|'DECLINED'|'REFUND_REQUESTED'|'REFUNDED'} status
 * @property {string} validUntil
 * @property {string|null} paidAt
 * @property {{ amount: number, currency: string }} amount
 * @property {'SERVER_FAILURE'|'PAYMENT_EXPIRATION'|'PAYMENT_CANCELLATION'|null} decliningReason
 * @property {string|null} declinedAt
 * @property {{ name: string, iban: string }|null} paidBy
 */
