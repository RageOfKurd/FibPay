import { request } from 'https';
import { FibPayError } from './error.js';

export class FibPayAuth {
  constructor({ clientId, clientSecret, baseUrl }) {
    this._clientId = clientId;
    this._clientSecret = clientSecret;
    this._baseUrl = baseUrl;
    this._accessToken = null;
    this._tokenExpiresAt = null;
  }

  async getAccessToken() {
    if (this._accessToken && Date.now() < this._tokenExpiresAt) {
      return this._accessToken;
    }
    return this._fetchNewToken();
  }

  async _fetchNewToken() {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this._clientId,
      client_secret: this._clientSecret,
    }).toString();

    const url = new URL(
      '/auth/realms/fib-online-shop/protocol/openid-connect/token',
      this._baseUrl,
    );

    const data = await this._request({
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
      body,
    });

    this._accessToken = data.access_token;
    // Subtract 30s buffer to avoid using a token right at expiry
    this._tokenExpiresAt = Date.now() + (data.expires_in - 30) * 1000;
    return this._accessToken;
  }

  _request({ hostname, path, method, headers, body }) {
    return new Promise((resolve, reject) => {
      const req = request({ hostname, path, method, headers }, (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(raw);
            if (res.statusCode >= 400) {
              return reject(
                new FibPayError(
                  parsed.error_description || 'Authentication failed',
                  res.statusCode,
                  parsed,
                ),
              );
            }
            resolve(parsed);
          } catch {
            reject(new Error(`[FibPay] Failed to parse auth response: ${raw}`));
          }
        });
      });
      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
  }
}