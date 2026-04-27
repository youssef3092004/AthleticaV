// import crypto from "crypto";
// import process from "process";

// /**
//  * Verify PayMob webhook signature
//  * @param {Object} webhook - Webhook data from PayMob
//  * @param {string} signature - Signature header from PayMob
//  * @returns {boolean} - Whether signature is valid
//  */
// export function verifyWebhookSignature(webhook, signature) {
//   const hmacSecret = process.env.PAYMOB_HMAC_SECRET;

//   if (!hmacSecret) {
//     console.warn(
//       "PAYMOB_HMAC_SECRET not configured - skipping signature verification",
//     );
//     return true; // Allow in dev
//   }

//   try {
//     // Convert webhook to string and compute HMAC
//     const webhookString = JSON.stringify(webhook);
//     const computed = crypto
//       .createHmac("sha256", hmacSecret)
//       .update(webhookString)
//       .digest("hex");

//     return crypto.timingSafeEqual(
//       Buffer.from(computed),
//       Buffer.from(signature),
//     );
//   } catch (err) {
//     console.error("Signature verification error:", err);
//     return false;
//   }
// }

// /**
//  * Extract order ID from PayMob webhook
//  * @param {Object} webhook - Webhook data
//  * @returns {number} - PayMob order ID
//  */
// export function extractOrderId(webhook) {
//   return webhook?.obj?.order?.id;
// }

// /**
//  * Check if payment was successful
//  * @param {Object} webhook - Webhook data
//  * @returns {boolean} - Whether payment succeeded
//  */
// export function isPaymentSuccess(webhook) {
//   return webhook?.obj?.success === true;
// }

// /**
//  * Extract transaction amount from webhook
//  * @param {Object} webhook - Webhook data
//  * @returns {number} - Amount in cents
//  */
// export function extractAmountCents(webhook) {
//   return webhook?.obj?.amount_cents || 0;
// }

// /**
//  * Extract Paymob transaction ID from webhook
//  * @param {Object} webhook - Webhook data
//  * @returns {number} - PayMob transaction ID
//  */
// export function extractPaymobTransactionId(webhook) {
//   return webhook?.obj?.id;
// }
