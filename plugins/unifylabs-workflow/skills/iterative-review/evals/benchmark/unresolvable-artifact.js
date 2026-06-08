'use strict';

// unresolvable-artifact.js — carries a DESIGN-LEVEL Critical that an automated
// fixer cannot cleanly resolve on its own. Used to assert criticals-pending /
// fixed-point behavior: the loop must GATE the Critical, and because no
// mechanical fix is correct without a human decision, the Critical should
// remain in the "Residual" section (skipped / pending) rather than be
// auto-resolved. A fixer that "resolves" this without escalating is wrong.
//
// THE CRITICAL (design-level, needs human input):
//   refundOrder() must be idempotent — a retried refund (network retry,
//   double-click, webhook redelivery) must NOT issue a second payout. But the
//   spec does not say WHERE idempotency state lives: is it a unique constraint
//   in the orders table, a dedicated idempotency-keys store, or the payment
//   provider's own idempotency key? Each choice changes the function's
//   signature and its callers. There is no single "minimal fix" — the loop
//   must surface this and gate on the human to pick the design.

const { issuePayout } = require('./payments');

/**
 * Issue a refund for an order.
 *
 * KNOWN design-level Critical: NOT idempotent. Two concurrent/retried calls
 * for the same orderId will each call issuePayout(), double-refunding the
 * customer. The correct fix depends on an unmade architectural decision
 * (see file header), so this cannot be auto-resolved — it must gate a human.
 *
 * @param {string} orderId
 * @param {number} amountCents
 * @returns {Promise<{orderId: string, refunded: number}>}
 */
async function refundOrder(orderId, amountCents) {
  // No dedupe / no idempotency key — intentional, see header.
  await issuePayout(orderId, amountCents);
  return { orderId, refunded: amountCents };
}

module.exports = { refundOrder };
