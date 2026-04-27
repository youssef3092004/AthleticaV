// import { prisma } from "../configs/db.js";
// import { AppError } from "../utils/appError.js";
// import {
//   verifyWebhookSignature,
//   extractOrderId,
//   isPaymentSuccess,
//   extractAmountCents,
// } from "./paymob.utils.js";

// /**
//  * Process PayMob webhook callback
//  * Called when user completes/fails payment
//  */
// export const handlePaymentWebhook = async (req, res, next) => {
//   try {
//     const webhook = req.body;
//     const signature =
//       req.headers["x-paymob-signature"] || req.headers["x-signature"];

//     console.log("Webhook received:", {
//       orderId: webhook?.obj?.order?.id,
//       success: webhook?.obj?.success,
//       timestamp: new Date().toISOString(),
//     });

//     // 1. Verify webhook authenticity
//     if (signature && process.env.NODE_ENV === "production") {
//       const isValid = verifyWebhookSignature(webhook, signature);
//       if (!isValid) {
//         console.warn("Invalid webhook signature");
//         return res.status(401).json({ error: "Invalid signature" });
//       }
//     }

//     // 2. Extract order ID from webhook
//     const orderId = extractOrderId(webhook);
//     if (!orderId) {
//       console.warn("Webhook missing order ID");
//       return res.status(400).json({ error: "Missing order ID" });
//     }

//     // 3. Find payment record by external ID (Paymob order ID)
//     const paymentRecord = await prisma.payment.findFirst({
//       where: {
//         externalId: String(orderId),
//       },
//       include: {
//         transaction: {
//           include: {
//             plan: {
//               select: {
//                 id: true,
//                 billingCycle: true,
//               },
//             },
//             client: {
//               select: {
//                 id: true,
//                 email: true,
//               },
//             },
//           },
//         },
//       },
//     });

//     if (!paymentRecord) {
//       console.warn(`Payment not found for order ID: ${orderId}`);
//       // Return 200 to avoid PayMob retries on unfound orders
//       return res.status(200).json({
//         success: false,
//         message:
//           "Order not found - this payment may have already been processed",
//       });
//     }

//     const transaction = paymentRecord.transaction;
//     const amountCents = extractAmountCents(webhook);
//     const success = isPaymentSuccess(webhook);

//     // 4. Check if already processed
//     if (paymentRecord.status === "PAID") {
//       console.log(
//         `Payment ${paymentRecord.id} already marked as PAID - idempotent response`,
//       );
//       return res.status(200).json({
//         success: true,
//         message: "Payment already processed",
//         transactionId: transaction.id,
//       });
//     }

//     if (paymentRecord.status === "FAILED" && !success) {
//       console.log(`Payment ${paymentRecord.id} already marked as FAILED`);
//       return res.status(200).json({
//         success: false,
//         message: "Payment already failed",
//         transactionId: transaction.id,
//       });
//     }

//     // 5. Validate amount matches
//     if (amountCents !== paymentRecord.amountCents) {
//       console.warn(
//         `Amount mismatch for payment ${paymentRecord.id}: expected ${paymentRecord.amountCents}, got ${amountCents}`,
//       );
//       // Log but continue - might be currency conversion
//     }

//     // 6. Update payment and transaction status in atomic transaction
//     const result = await prisma.$transaction(async (tx) => {
//       if (success) {
//         // ✅ PAYMENT SUCCESSFUL

//         // Update payment status
//         await tx.payment.update({
//           where: { id: paymentRecord.id },
//           data: {
//             status: "PAID",
//             updatedAt: new Date(),
//           },
//         });

//         // Update transaction status
//         await tx.transaction.update({
//           where: { id: transaction.id },
//           data: {
//             status: "PAID",
//           },
//         });

//         // Add funds to trainer wallet
//         if (transaction.trainerId) {
//           await tx.trainerWallet.upsert({
//             where: { trainerId: transaction.trainerId },
//             update: {
//               balance: {
//                 increment: transaction.trainerAmount,
//               },
//             },
//             create: {
//               trainerId: transaction.trainerId,
//               balance: transaction.trainerAmount,
//             },
//           });
//         }

//         // Activate subscription if plan-based transaction
//         if (transaction.planId && transaction.plan && transaction.clientId) {
//           const now = new Date();
//           const periodEnd = addBillingCyclePeriod(
//             now,
//             transaction.plan.billingCycle || "MONTHLY",
//           );

//           // Check if subscription already exists for this user+plan
//           const existingSubscription = await tx.subscription.findFirst({
//             where: {
//               userId: transaction.clientId,
//               planId: transaction.planId,
//             },
//             orderBy: {
//               createdAt: "desc",
//             },
//           });

//           if (existingSubscription) {
//             // Update existing subscription
//             await tx.subscription.update({
//               where: { id: existingSubscription.id },
//               data: {
//                 status: "ACTIVE",
//                 startDate: now,
//                 endDate: periodEnd,
//                 currentPeriodStart: now,
//                 currentPeriodEnd: periodEnd,
//                 cancelAtPeriodEnd: false,
//               },
//             });
//           } else {
//             // Create new subscription
//             await tx.subscription.create({
//               data: {
//                 userId: transaction.clientId,
//                 planId: transaction.planId,
//                 status: "ACTIVE",
//                 startDate: now,
//                 endDate: periodEnd,
//                 currentPeriodStart: now,
//                 currentPeriodEnd: periodEnd,
//               },
//             });
//           }
//         }

//         // Log activity
//         if (transaction.clientId) {
//           await tx.activityLog.create({
//             data: {
//               userId: transaction.clientId,
//               action: "PAYMENT_COMPLETED",
//               metadata: {
//                 transactionId: transaction.id,
//                 paymentId: paymentRecord.id,
//                 amount: transaction.grossAmount.toString(),
//                 currency: transaction.currency,
//                 planId: transaction.planId,
//               },
//             },
//           });
//         }

//         console.log(`Payment ${paymentRecord.id} marked as PAID`);

//         return {
//           success: true,
//           status: "PAID",
//           message: "Payment processed successfully",
//         };
//       } else {
//         // ❌ PAYMENT FAILED

//         // Update payment status
//         await tx.payment.update({
//           where: { id: paymentRecord.id },
//           data: {
//             status: "FAILED",
//             updatedAt: new Date(),
//           },
//         });

//         // Update transaction status
//         await tx.transaction.update({
//           where: { id: transaction.id },
//           data: {
//             status: "FAILED",
//             decisionNote: webhook?.obj?.error || "Payment failed via webhook",
//             decidedAt: new Date(),
//           },
//         });

//         // Log activity
//         if (transaction.clientId) {
//           await tx.activityLog.create({
//             data: {
//               userId: transaction.clientId,
//               action: "PAYMENT_FAILED",
//               metadata: {
//                 transactionId: transaction.id,
//                 paymentId: paymentRecord.id,
//                 reason: webhook?.obj?.error || "Unknown error",
//                 amount: transaction.grossAmount.toString(),
//               },
//             },
//           });
//         }

//         console.log(`Payment ${paymentRecord.id} marked as FAILED`);

//         return {
//           success: false,
//           status: "FAILED",
//           message: "Payment failed",
//         };
//       }
//     });

//     // 7. Return success to PayMob
//     return res.status(200).json({
//       success: result.success,
//       message: result.message,
//       transactionId: transaction.id,
//     });
//   } catch (err) {
//     console.error("Webhook processing error:", err);
//     // Return 200 anyway to avoid PayMob retrying indefinitely
//     return res.status(200).json({
//       success: false,
//       error: err.message || "Webhook processing failed",
//     });
//   }
// };

// /**
//  * Helper: Add billing period to a date
//  */
// function addBillingCyclePeriod(start, billingCycle) {
//   const end = new Date(start);
//   if (billingCycle === "ANNUAL") {
//     end.setUTCFullYear(end.getUTCFullYear() + 1);
//   } else {
//     // Default to monthly
//     end.setUTCMonth(end.getUTCMonth() + 1);
//   }
//   return end;
// }
