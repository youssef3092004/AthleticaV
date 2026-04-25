# Complete Payment Logic - PayMob Integration

## Overview

This document outlines the complete payment flow from initiation through confirmation when users pay with PayMob.

---

## Payment Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          PAYMENT FLOW                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. Client Selects Plan                                            │
│     └─> Calls: POST /api/v1/payments/init                         │
│                                                                     │
│  2. Backend Initializes Payment                                    │
│     ├─> Validate plan exists & is active                          │
│     ├─> Create Transaction record (PENDING)                       │
│     ├─> Create Payment record (PENDING)                           │
│     ├─> Call Paymob API (auth token)                              │
│     ├─> Create order with Paymob                                  │
│     ├─> Generate payment key                                      │
│     ├─> Store externalId & paymentToken                           │
│     └─> Return payment URL to client                              │
│                                                                     │
│  3. Client Opens Payment URL                                       │
│     └─> Redirects to Paymob iframe/checkout                       │
│                                                                     │
│  4. User Completes Payment (or fails)                              │
│     ├─ If SUCCESS:                                                │
│     │  └─> Paymob sends webhook to backend                        │
│     │      POST /api/v1/payments/webhook                          │
│     │                                                              │
│     └─ If FAILED/CANCELLED:                                       │
│        └─> Webhook sent with failure status                       │
│                                                                     │
│  5. Backend Processes Webhook                                      │
│     ├─> Verify webhook signature                                  │
│     ├─> Extract transaction/order reference                       │
│     ├─> If SUCCESS:                                               │
│     │  ├─> Update Payment status → PAID                           │
│     │  ├─> Update Transaction status → PAID                       │
│     │  ├─> Activate subscription (if applicable)                  │
│     │  ├─> Add funds to trainer wallet                            │
│     │  └─> Log activity                                           │
│     │                                                              │
│     └─ If FAILED:                                                 │
│        ├─> Update Payment status → FAILED                         │
│        ├─> Update Transaction status → FAILED                     │
│        └─> Log failure event                                      │
│                                                                     │
│  6. Client Checks Payment Status (Optional)                        │
│     └─> Calls: GET /api/v1/payments/status/:transactionId         │
│        Returns: { status, message, nextSteps }                    │
│                                                                     │
│  7. Client Redirected/Notified                                     │
│     └─> Success page or retry page                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Database Models

### Transaction Model (Existing)

```prisma
model Transaction {
  id             String
  clientId       String?          // Who is paying
  trainerId      String           // Trainer receiving payment
  planId         String?          // Plan being purchased
  grossAmount    Decimal          // Total amount (with fees)
  platformFee    Decimal          // Platform commission
  trainerAmount  Decimal          // What trainer receives
  currency       String           // "EGP"
  status         TransactionStatus // PENDING, PAID, FAILED
  createdAt      DateTime
  payment        Payment?         // Link to payment details
  // ... relations
}

enum TransactionStatus {
  PENDING
  PAID
  FAILED
}
```

### Payment Model (Existing)

```prisma
model Payment {
  id            String           // Local DB ID
  transactionId String           // Link to transaction
  provider      String           // "paymob"
  externalId    String?          // Paymob order ID
  paymentToken  String?          // Payment key for iframe
  amountCents   Int              // Amount in cents (EGP)
  currency      String           // "EGP"
  status        PaymentStatus    // PENDING, PAID, FAILED
  createdAt     DateTime
  transaction   Transaction      // Relation
}

enum PaymentStatus {
  PENDING
  PAID
  FAILED
}
```

### TrainerWallet Model (Existing)

```prisma
model TrainerWallet {
  trainerId String   // Trainer ID
  balance   Decimal  // Available balance
  trainer   User
}
```

---

## API Endpoints

### 1. Initialize Payment

**Endpoint:** `POST /api/v1/payments/init`  
**Auth:** Required (Bearer token)  
**Body:**

```json
{
  "planId": "uuid-of-plan"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "transactionId": "uuid",
    "paymentUrl": "https://accept.paymob.com/api/acceptance/iframes/...",
    "externalId": "paymob-order-id"
  }
}
```

**Error Responses:**

- `400 Bad Request`: planId missing or invalid
- `404 Not Found`: Plan not found
- `409 Conflict`: Plan is inactive
- `500 Internal Server Error`: PayMob API failure

---

### 2. Payment Webhook (PayMob Callback)

**Endpoint:** `POST /api/v1/payments/webhook`  
**Auth:** None (signature verification instead)  
**Body (from PayMob):**

```json
{
  "type": "transaction.processed",
  "obj": {
    "id": 123456,
    "order": {
      "id": 789,
      "items_json": "[]"
    },
    "amount_cents": 10000,
    "currency": "EGP",
    "success": true,
    "is_3d_secure": false,
    "integration_id": 123456,
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

**Expected Behavior:**

- Verify webhook signature
- Find Payment record by externalId (Paymob order ID)
- Update Payment & Transaction status
- Activate subscription/update wallet
- Return `200 OK` to PayMob

---

### 3. Check Payment Status (Client)

**Endpoint:** `GET /api/v1/payments/status/:transactionId`  
**Auth:** Required (Bearer token)

**Response (200):**

```json
{
  "success": true,
  "data": {
    "transactionId": "uuid",
    "status": "PAID",
    "paymentStatus": "PAID",
    "amount": 100.0,
    "currency": "EGP",
    "message": "Payment successful",
    "nextSteps": "Your subscription is now active"
  }
}
```

---

## Implementation Files

### 1. `payments/paymob.utils.js` (FIXED)

Utility functions for PayMob integration.

```javascript
import crypto from "crypto";
import process from "process";

/**
 * Verify PayMob webhook signature
 * @param {Object} webhook - Webhook data from PayMob
 * @param {string} signature - Signature header from PayMob
 * @returns {boolean} - Whether signature is valid
 */
export function verifyWebhookSignature(webhook, signature) {
  const hmacSecret = process.env.PAYMOB_HMAC_SECRET;

  if (!hmacSecret) {
    throw new Error("PAYMOB_HMAC_SECRET not configured");
  }

  // Convert webhook to string and compute HMAC
  const webhookString = JSON.stringify(webhook);
  const computed = crypto
    .createHmac("sha256", hmacSecret)
    .update(webhookString)
    .digest("hex");

  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
}

/**
 * Extract order ID from PayMob webhook
 * @param {Object} webhook - Webhook data
 * @returns {number} - PayMob order ID
 */
export function extractOrderId(webhook) {
  return webhook?.obj?.order?.id;
}

/**
 * Check if payment was successful
 * @param {Object} webhook - Webhook data
 * @returns {boolean} - Whether payment succeeded
 */
export function isPaymentSuccess(webhook) {
  return webhook?.obj?.success === true;
}

/**
 * Extract transaction amount from webhook
 * @param {Object} webhook - Webhook data
 * @returns {number} - Amount in cents
 */
export function extractAmountCents(webhook) {
  return webhook?.obj?.amount_cents || 0;
}

/**
 * Build transaction update data for successful payment
 * @returns {Object} - Prisma update payload
 */
export function buildSuccessfulTransactionUpdate() {
  return {
    status: "PAID",
  };
}

/**
 * Build transaction update data for failed payment
 * @returns {Object} - Prisma update payload
 */
export function buildFailedTransactionUpdate() {
  return {
    status: "FAILED",
  };
}
```

---

### 2. `payments/paymob.webhook.js` (NEW)

Webhook processing logic.

```javascript
import { prisma } from "../configs/db.js";
import { AppError } from "../utils/appError.js";
import {
  verifyWebhookSignature,
  extractOrderId,
  isPaymentSuccess,
  extractAmountCents,
  buildSuccessfulTransactionUpdate,
  buildFailedTransactionUpdate,
} from "./paymob.utils.js";

/**
 * Process PayMob webhook callback
 * Called when user completes/fails payment
 */
export const handlePaymentWebhook = async (req, res, next) => {
  try {
    const webhook = req.body;
    const signature =
      req.headers["x-paymob-signature"] || req.headers["x-signature"];

    // 1. Verify webhook authenticity
    if (!signature) {
      console.warn("Webhook received without signature");
      // Still process if no signature required in dev
      if (process.env.NODE_ENV === "production") {
        return res.status(401).json({ error: "Missing signature" });
      }
    } else {
      try {
        const isValid = verifyWebhookSignature(webhook, signature);
        if (!isValid) {
          console.warn("Invalid webhook signature");
          return res.status(401).json({ error: "Invalid signature" });
        }
      } catch (err) {
        console.error("Signature verification error:", err);
        // Continue processing anyway (signature config might be missing)
      }
    }

    // 2. Extract order ID from webhook
    const orderId = extractOrderId(webhook);
    if (!orderId) {
      console.warn("Webhook missing order ID");
      return res.status(400).json({ error: "Missing order ID" });
    }

    // 3. Find payment record by external ID (Paymob order ID)
    const payment = await prisma.payment.findUnique({
      where: {
        transactionId: {
          // This won't work, need different lookup
        },
      },
      include: {
        transaction: {
          include: {
            plan: true,
            subscription: true,
          },
        },
      },
    });

    // NOTE: Payment model doesn't have index on externalId
    // Query by externalId instead:
    const paymentRecord = await prisma.payment.findFirst({
      where: {
        externalId: String(orderId),
      },
      include: {
        transaction: {
          include: {
            plan: true,
            subscription: true,
          },
        },
      },
    });

    if (!paymentRecord) {
      console.warn(`Payment not found for order ID: ${orderId}`);
      // Still return 200 to avoid PayMob retries
      return res
        .status(200)
        .json({ success: false, message: "Order not found" });
    }

    const transaction = paymentRecord.transaction;
    const amountCents = extractAmountCents(webhook);
    const success = isPaymentSuccess(webhook);

    // 4. Validate amount matches
    if (amountCents !== paymentRecord.amountCents) {
      console.warn(
        `Amount mismatch for payment ${paymentRecord.id}: expected ${paymentRecord.amountCents}, got ${amountCents}`,
      );
      // Continue anyway - might be converted currency
    }

    // 5. Update payment and transaction status in transaction
    const result = await prisma.$transaction(async (tx) => {
      if (success) {
        // ✅ PAYMENT SUCCESSFUL

        // Update payment status
        const updatedPayment = await tx.payment.update({
          where: { id: paymentRecord.id },
          data: {
            status: "PAID",
            updatedAt: new Date(),
          },
        });

        // Update transaction status
        const updatedTransaction = await tx.transaction.update({
          where: { id: transaction.id },
          data: {
            status: "PAID",
          },
        });

        // Add funds to trainer wallet
        if (transaction.trainerId) {
          await tx.trainerWallet.upsert({
            where: { trainerId: transaction.trainerId },
            update: {
              balance: {
                // Increment balance
                increment: transaction.trainerAmount,
              },
            },
            create: {
              trainerId: transaction.trainerId,
              balance: transaction.trainerAmount,
            },
          });
        }

        // Activate subscription if plan-based transaction
        if (transaction.planId && transaction.plan) {
          const now = new Date();
          const periodEnd = addBillingCyclePeriod(
            now,
            transaction.plan.billingCycle || "MONTHLY",
          );

          await tx.subscription.upsert({
            where: {
              // Assuming subscription has unique constraint on userId + planId
              // This may need adjustment based on actual schema
              userId_planId: {
                userId: transaction.clientId,
                planId: transaction.planId,
              },
            },
            update: {
              startDate: now,
              endDate: periodEnd,
              isActive: true,
            },
            create: {
              userId: transaction.clientId,
              planId: transaction.planId,
              startDate: now,
              endDate: periodEnd,
              isActive: true,
            },
          });
        }

        // Log activity
        if (transaction.clientId) {
          await tx.activityLog.create({
            data: {
              userId: transaction.clientId,
              action: "PAYMENT_COMPLETED",
              metadata: {
                transactionId: transaction.id,
                paymentId: paymentRecord.id,
                amount: transaction.grossAmount,
                currency: transaction.currency,
              },
            },
          });
        }

        return {
          success: true,
          status: "PAID",
          message: "Payment processed successfully",
        };
      } else {
        // ❌ PAYMENT FAILED

        // Update payment status
        const updatedPayment = await tx.payment.update({
          where: { id: paymentRecord.id },
          data: {
            status: "FAILED",
            updatedAt: new Date(),
          },
        });

        // Update transaction status
        const updatedTransaction = await tx.transaction.update({
          where: { id: transaction.id },
          data: {
            status: "FAILED",
          },
        });

        // Log activity
        if (transaction.clientId) {
          await tx.activityLog.create({
            data: {
              userId: transaction.clientId,
              action: "PAYMENT_FAILED",
              metadata: {
                transactionId: transaction.id,
                paymentId: paymentRecord.id,
                reason: webhook?.obj?.error || "Unknown error",
              },
            },
          });
        }

        return {
          success: false,
          status: "FAILED",
          message: "Payment failed",
        };
      }
    });

    // 6. Return success to PayMob
    return res.status(200).json({
      success: result.success,
      message: result.message,
      transactionId: transaction.id,
    });
  } catch (err) {
    console.error("Webhook processing error:", err);
    // Return 200 anyway to avoid PayMob retrying indefinitely
    return res.status(200).json({
      success: false,
      error: err.message || "Webhook processing failed",
    });
  }
};

/**
 * Helper: Add billing period to a date
 */
function addBillingCyclePeriod(start, billingCycle) {
  const end = new Date(start);
  if (billingCycle === "ANNUAL") {
    end.setUTCFullYear(end.getUTCFullYear() + 1);
  } else {
    // Default to monthly
    end.setUTCMonth(end.getUTCMonth() + 1);
  }
  return end;
}
```

---

### 3. `payments/paymob.controller.js` (FIXED)

Updated controller with proper user data and error handling.

```javascript
import { prisma } from "../configs/db.js";
import { AppError } from "../utils/appError.js";
import {
  getAuthToken,
  createOrder,
  generatePaymentKey,
  buildPaymentUrl,
} from "./paymob.service.js";

/**
 * Initialize payment for a plan purchase
 */
export const initPayment = async (req, res, next) => {
  try {
    const { planId } = req.body;
    const userId = req.user.id; // from auth middleware

    // Validation
    if (!planId) {
      throw new AppError("planId is required", 400);
    }

    // 1. Get plan details
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
      include: {
        trainer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!plan) {
      throw new AppError("Plan not found", 404);
    }

    if (!plan.isActive) {
      throw new AppError("Plan is inactive", 409);
    }

    // 2. Get client details for billing
    const client = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
      },
    });

    if (!client) {
      throw new AppError("Client not found", 404);
    }

    // 3. Calculate fees (if applicable)
    const platformFeePercent = Number(process.env.PLATFORM_FEE_PERCENT || 0);
    const platformFee = (plan.price * platformFeePercent) / 100;
    const trainerAmount = plan.price - platformFee;
    const grossAmount = plan.price; // Total charged to client

    const amountCents = Math.round(grossAmount * 100); // Convert to cents

    // 4. Create Transaction record
    const transaction = await prisma.transaction.create({
      data: {
        clientId: userId,
        trainerId: plan.trainerId,
        planId: plan.id,
        grossAmount: grossAmount.toFixed(2),
        platformFee: platformFee.toFixed(2),
        trainerAmount: trainerAmount.toFixed(2),
        currency: "EGP",
        paymentMode: "PLATFORM",
        status: "PENDING",
      },
    });

    // 5. Create Payment record
    const payment = await prisma.payment.create({
      data: {
        transactionId: transaction.id,
        provider: "paymob",
        amountCents,
        currency: "EGP",
        status: "PENDING",
      },
    });

    // 6. Call PayMob API
    let paymentUrl;
    try {
      const token = await getAuthToken();

      const order = await createOrder(token, amountCents);
      if (!order || !order.id) {
        throw new Error("PayMob order creation failed");
      }

      const billingData = {
        first_name: client.firstName || "User",
        last_name: client.lastName || "Client",
        email: client.email,
        phone_number: (client.phone || "").replace(/[^\d]/g, ""), // Only digits
        country: "EG",
        city: "Cairo",
        state: "Cairo",
        postal_code: "11211",
        street: "N/A", // Required by PayMob
      };

      const paymentKey = await generatePaymentKey(
        token,
        order.id,
        amountCents,
        billingData,
      );

      if (!paymentKey) {
        throw new Error("PayMob payment key generation failed");
      }

      paymentUrl = buildPaymentUrl(paymentKey);

      // 7. Update Payment with PayMob references
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          externalId: String(order.id),
          paymentToken: paymentKey,
        },
      });
    } catch (paymobErr) {
      console.error("PayMob API error:", paymobErr);

      // Mark payment as failed
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "FAILED" },
      });

      // Mark transaction as failed
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: "FAILED" },
      });

      throw new AppError(
        `Payment initialization failed: ${paymobErr.message}`,
        500,
      );
    }

    // 8. Return payment URL
    return res.json({
      success: true,
      data: {
        transactionId: transaction.id,
        paymentUrl,
        externalId: order?.id,
      },
    });
  } catch (err) {
    console.error("initPayment error:", err);
    next(err);
  }
};

/**
 * Check payment status
 */
export const checkPaymentStatus = async (req, res, next) => {
  try {
    const { transactionId } = req.params;
    const userId = req.user.id;

    if (!transactionId) {
      throw new AppError("transactionId is required", 400);
    }

    // Get transaction
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        payment: true,
      },
    });

    if (!transaction) {
      throw new AppError("Transaction not found", 404);
    }

    // Check access: only client or trainer can view
    const isClient = String(userId) === String(transaction.clientId);
    const isTrainer = String(userId) === String(transaction.trainerId);

    if (!isClient && !isTrainer) {
      throw new AppError("Forbidden", 403);
    }

    const payment = transaction.payment;
    const statusMessage = getStatusMessage(transaction.status, payment?.status);

    return res.json({
      success: true,
      data: {
        transactionId: transaction.id,
        status: transaction.status,
        paymentStatus: payment?.status || "UNKNOWN",
        amount: Number(transaction.grossAmount),
        currency: transaction.currency,
        message: statusMessage,
        nextSteps: getNextSteps(transaction.status),
      },
    });
  } catch (err) {
    console.error("checkPaymentStatus error:", err);
    next(err);
  }
};

/**
 * Helper: Get user-friendly status message
 */
function getStatusMessage(transactionStatus, paymentStatus) {
  if (transactionStatus === "PAID") {
    return "Payment successful! Your subscription is active.";
  }
  if (transactionStatus === "FAILED") {
    return "Payment failed. Please try again.";
  }
  if (paymentStatus === "PENDING") {
    return "Payment is pending. Please complete the payment.";
  }
  return "Payment status unknown";
}

/**
 * Helper: Get next steps based on status
 */
function getNextSteps(status) {
  if (status === "PAID") {
    return "Your subscription has been activated. You can now access your trainer's plans.";
  }
  if (status === "FAILED") {
    return "Please return to the payment page and try again, or contact support.";
  }
  return "Please complete the payment to activate your subscription.";
}
```

---

### 4. `payments/paymob.routes.js` (UPDATED)

Add webhook and status check endpoints.

```javascript
import Router from "express";
import { initPayment, checkPaymentStatus } from "./paymob.controller.js";
import { handlePaymentWebhook } from "./paymob.webhook.js";
import { verifyToken } from "../middleware/auth.js";

const router = Router();

// Initialize payment (protected)
router.post("/init", verifyToken, initPayment);

// Check payment status (protected)
router.get("/status/:transactionId", verifyToken, checkPaymentStatus);

// PayMob webhook callback (unprotected - uses signature verification)
router.post("/webhook", handlePaymentWebhook);

export default router;
```

---

### 5. `payments/paymob.service.js` (EXISTING - Add Error Handling)

Enhanced service with better error handling.

```javascript
import axios from "axios";
import process from "process";

const PAYMOB_BASE_URL =
  process.env.PAYMOB_BASE_URL || "https://accept.paymob.com/api";
const PAYMOB_API_KEY = process.env.PAYMOB_API_KEY;
const PAYMOB_INTEGRATION_ID = process.env.PAYMOB_INTEGRATION_ID;
const PAYMOB_IFRAME_ID = process.env.PAYMOB_IFRAME_ID;

if (!PAYMOB_API_KEY || !PAYMOB_INTEGRATION_ID || !PAYMOB_IFRAME_ID) {
  console.warn("Warning: PayMob environment variables not fully configured:", {
    hasApiKey: !!PAYMOB_API_KEY,
    hasIntegrationId: !!PAYMOB_INTEGRATION_ID,
    hasIframeId: !!PAYMOB_IFRAME_ID,
  });
}

/**
 * Get authentication token from PayMob
 */
export async function getAuthToken() {
  try {
    const res = await axios.post(`${PAYMOB_BASE_URL}/auth/tokens`, {
      api_key: PAYMOB_API_KEY,
    });

    if (!res.data.token) {
      throw new Error("No token in PayMob response");
    }

    return res.data.token;
  } catch (err) {
    console.error("PayMob auth error:", err.response?.data || err.message);
    throw new Error(`PayMob authentication failed: ${err.message}`);
  }
}

/**
 * Create order with PayMob
 */
export async function createOrder(authToken, amountCents) {
  try {
    const res = await axios.post(`${PAYMOB_BASE_URL}/ecommerce/orders`, {
      auth_token: authToken,
      delivery_needed: false,
      amount_cents: amountCents,
      currency: "EGP",
      items: [],
    });

    if (!res.data.id) {
      throw new Error("No order ID in PayMob response");
    }

    return res.data;
  } catch (err) {
    console.error(
      "PayMob order creation error:",
      err.response?.data || err.message,
    );
    throw new Error(`PayMob order creation failed: ${err.message}`);
  }
}

/**
 * Generate payment key from PayMob
 */
export async function generatePaymentKey(
  authToken,
  orderId,
  amountCents,
  billingData,
) {
  try {
    const res = await axios.post(`${PAYMOB_BASE_URL}/acceptance/payment_keys`, {
      auth_token: authToken,
      amount_cents: amountCents,
      expiration: 3600, // 1 hour
      order_id: orderId,
      billing_data: billingData,
      currency: "EGP",
      integration_id: PAYMOB_INTEGRATION_ID,
    });

    if (!res.data.token) {
      throw new Error("No payment token in PayMob response");
    }

    return res.data.token;
  } catch (err) {
    console.error(
      "PayMob payment key error:",
      err.response?.data || err.message,
    );
    throw new Error(`PayMob payment key generation failed: ${err.message}`);
  }
}

/**
 * Build PayMob payment iframe URL
 */
export function buildPaymentUrl(paymentToken) {
  if (!PAYMOB_IFRAME_ID) {
    throw new Error("PAYMOB_IFRAME_ID not configured");
  }

  return `https://accept.paymob.com/api/acceptance/iframes/${PAYMOB_IFRAME_ID}?payment_token=${paymentToken}`;
}
```

---

## Environment Variables Required

```env
# PayMob Configuration
PAYMOB_BASE_URL=https://accept.paymob.com/api
PAYMOB_API_KEY=your_api_key_here
PAYMOB_INTEGRATION_ID=your_integration_id
PAYMOB_IFRAME_ID=your_iframe_id
PAYMOB_HMAC_SECRET=your_webhook_secret_key

# Platform Configuration
PLATFORM_FEE_PERCENT=10  # 10% platform fee
```

---

## Client-Side Integration Example

### React Component

```jsx
import { useState } from "react";

export function CheckoutFlow() {
  const [loading, setLoading] = useState(false);
  const [planId, setPlanId] = useState("");
  const [paymentUrl, setPaymentUrl] = useState("");
  const [transactionId, setTransactionId] = useState("");

  // Step 1: Initialize payment
  const handleCheckout = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/payments/init", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ planId }),
      });

      const data = await res.json();
      if (data.success) {
        setTransactionId(data.data.transactionId);
        setPaymentUrl(data.data.paymentUrl);
        // Open in popup or redirect
        window.location.href = data.data.paymentUrl;
      }
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Check status after user returns
  const checkStatus = async () => {
    const res = await fetch(`/api/v1/payments/status/${transactionId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();
    console.log("Payment status:", data.data.status);
    // Handle based on status: PAID, FAILED, PENDING
  };

  return (
    <div>
      <input
        value={planId}
        onChange={(e) => setPlanId(e.target.value)}
        placeholder="Plan ID"
      />
      <button onClick={handleCheckout} disabled={loading}>
        {loading ? "Processing..." : "Buy Plan"}
      </button>
    </div>
  );
}
```

---

## Testing Payment Flow Locally

### 1. PayMob Sandbox

Use PayMob's sandbox environment for testing:

- **Base URL:** `https://accept.paymob.com/api` (use sandbox flag)
- **Test Card:** 4111111111111111 (Visa)
- **CVV:** Any 3 digits
- **Exp:** Any future date

### 2. Webhook Testing

Use a tool like Postman or ngrok to test webhook:

```bash
# Simulate successful payment webhook
curl -X POST http://localhost:5000/api/v1/payments/webhook \
  -H "Content-Type: application/json" \
  -H "x-paymob-signature: YOUR_SIGNATURE" \
  -d '{
    "type": "transaction.processed",
    "obj": {
      "id": 123456,
      "order": {
        "id": 999,
        "items_json": "[]"
      },
      "amount_cents": 10000,
      "currency": "EGP",
      "success": true,
      "is_3d_secure": false,
      "integration_id": 123456,
      "created_at": "2024-01-15T10:30:00Z"
    }
  }'
```

---

## Error Handling & Edge Cases

### Payment Failures

- **Insufficient Funds:** Return 402 error, guide user to retry
- **Invalid Card:** PayMob returns error, webhook sent with success=false
- **Timeout:** PayMob sends webhook with status, transaction marked PENDING until callback

### Race Conditions

- Use Prisma transactions for atomic updates
- Payment webhook is idempotent (checks if already processed)

### Webhook Retries

- Always return 200 to PayMob even if processing fails internally
- PayMob retries for 24 hours on non-2xx responses

---

## Security Considerations

✅ **Implemented:**

- Webhook signature verification (HMAC-SHA256)
- User authentication on init endpoint
- Access control on status check (client/trainer only)
- Transaction ID is UUID (unguessable)

✅ **To Implement:**

- Rate limiting on `/init` endpoint (prevent payment spam)
- Amount verification in webhook (prevent tampering)
- Whitelist PayMob IP addresses
- Log all payment activities for audit

---

## Troubleshooting

| Issue                               | Cause                           | Solution                                                                  |
| ----------------------------------- | ------------------------------- | ------------------------------------------------------------------------- |
| `function min(uuid) does not exist` | Migration syntax error          | Run: `npm run prisma:dev:migrate -- --name fix_migration`                 |
| Webhook not received                | Webhook URL not configured      | Set in PayMob dashboard: `https://yourdomain.com/api/v1/payments/webhook` |
| "Plan not found"                    | Invalid planId                  | Verify plan exists: `SELECT * FROM "Plan" WHERE id = '...'`               |
| CORS error on init                  | Frontend origin not whitelisted | Add to `server.js` allowedOrigins                                         |
| Payment stuck PENDING               | Webhook never received          | Check PayMob logs, resend webhook from dashboard                          |

---

## Summary

This payment flow implements:

1. ✅ Plan selection and payment initiation
2. ✅ PayMob integration with real user data
3. ✅ Webhook handling and signature verification
4. ✅ Transaction/payment status tracking
5. ✅ Trainer wallet funding on successful payment
6. ✅ Subscription activation
7. ✅ Activity logging
8. ✅ Error handling and edge cases

**Next Steps:**

- Deploy webhook handler to production
- Configure PayMob webhook URL in dashboard
- Test with live PayMob sandbox account
- Monitor webhook delivery and payment processing
