export class FibPayError extends Error {
  constructor(message, statusCode, body) {
    super(message);
    this.name = 'FibPayError';
    this.statusCode = statusCode;
    this.body = body;
  }
}