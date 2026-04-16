'use strict';

const FibPay = require('./src/FibPay');
const { FibPayError } = require('./src/payments');

module.exports = FibPay;
module.exports.FibPay = FibPay;
module.exports.FibPayError = FibPayError;
module.exports.default = FibPay;