import { request } from 'https';
import { FibPayError } from './error.js';

const TERMINAL_STATES = new Set(['PAID', 'DECLINED', 'REFUNDED']);

export class FibPayPayments {
  constructor({ auth, baseUrl }) {
    this._auth = auth;
    this._baseUrl = baseUrl;
  }

  /**
   * Create a new payment.
   * @param {object} options
   * @param {number}  options.amount          - Amount to charge (positive number)
   * @param {string}  [options.currency]      - Currency code (default: "IQD")
   * @param {string}  [options.description]   - Payment description shown to customer
   * @param {string}  [options.callbackUrl]   - Webhook URL called on status change
   * @param {string}  [options.redirectUrl]   - URL to redirect customer after payment
   * @returns {Promise<PaymentResponse>}
   */
  async create({ amount, currency = 'IQD', description, callbackUrl, redirectUrl } = {}) {
    if (!amount || amount <= 0) {
      throw new Error('[FibPay] amount must be a positive number.');
    }

    const payload = {
      monetaryValue: { amount, currency },
      ...(description && { description }),
      ...(callbackUrl && { statusCallbackUrl: callbackUrl }),
      ...(redirectUrl && { redirectUrl }),
    };

    return this._request('POST', '/protected/v1/payments', payload);
  }

  /**
   * Get the current status of a payment.
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
   * @returns {Promise<null>}
   */
  async cancel(paymentId) {
    this._requireId(paymentId, 'paymentId');
    return this._request('POST', `/protected/v1/payments/${paymentId}/cancel`);
  }

  /**
   * Refund a PAID payment (must have been paid within the last 24 hours).
   * Poll getStatus() after calling this until status is "REFUNDED".
   * @param {string} paymentId
   * @returns {Promise<null>}
   */
  async refund(paymentId) {
    this._requireId(paymentId, 'paymentId');
    return this._request('POST', `/protected/v1/payments/${paymentId}/refund`);
  }

  /**
   * Poll getStatus() until a terminal state is reached or timeout is exceeded.
   * Terminal states: PAID | DECLINED | REFUNDED
   * @param {string} paymentId
   * @param {object} [options]
   * @param {number} [options.intervalMs=3000]  - Polling interval in ms
   * @param {number} [options.timeoutMs=300000] - Max wait time in ms (default: 5 min)
   * @returns {Promise<PaymentStatus>}
   */
  async waitForStatus(paymentId, { intervalMs = 3000, timeoutMs = 300_000 } = {}) {
    this._requireId(paymentId, 'paymentId');

    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const status = await this.getStatus(paymentId);
      if (TERMINAL_STATES.has(status.status)) return status;
      await this._sleep(intervalMs);
    }

    throw new Error(
      `[FibPay] Timed out waiting for payment ${paymentId} to reach a terminal status.`,
    );
  }

  // ─── Internals ──────────────────────────────────────────────────────────────

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
      const req = request(
        { hostname: url.hostname, path: url.pathname + url.search, method, headers },
        (res) => {
          let raw = '';
          res.on('data', (chunk) => (raw += chunk));
          res.on('end', () => {
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

/**
 * @typedef {object} PaymentResponse
 * @property {string} paymentId
 * @property {string} readableCode
 * @property {string} qrCode            - Base64 QR code image
 * @property {string} validUntil        - ISO-8601 expiry datetime
 * @property {string} personalAppLink   - Deep-link for personal FIB app
 * @property {string} businessAppLink   - Deep-link for business FIB app
 * @property {string} corporateAppLink  - Deep-link for corporate FIB app
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