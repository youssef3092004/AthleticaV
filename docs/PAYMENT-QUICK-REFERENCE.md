# Payment Logic - Quick Reference Guide

## For Developers

### How to Use the Payment System

#### 1. Client Side - Initiate Payment

```javascript
// User has selected a plan and clicked "Buy"
async function initiatePayment(planId) {
  const response = await fetch("/api/v1/payments/init", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${userToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ planId }),
  });

  const data = await response.json();

  if (data.success) {
    // Store transaction ID for later status check
    localStorage.setItem("transactionId", data.data.transactionId);

    // Redirect to PayMob checkout
    window.location.href = data.data.paymentUrl;
  } else {
    // Handle error
    alert("Payment initialization failed: " + data.error);
  }
}
```

#### 2. User Completes Payment

- User is redirected to PayMob iframe
- User enters card details
- PayMob processes payment
- User is returned to your app (redirect URL configured in PayMob dashboard)

#### 3. Check Payment Status

```javascript
// After user returns from PayMob, check if payment succeeded
async function checkPaymentStatus() {
  const transactionId = localStorage.getItem("transactionId");

  const response = await fetch(`/api/v1/payments/status/${transactionId}`, {
    headers: {
      Authorization: `Bearer ${userToken}`,
    },
  });

  const data = await response.json();

  if (data.success) {
    const { status, message, nextSteps } = data.data;

    if (status === "PAID") {
      // ✅ Payment successful - subscription is active
      showSuccessMessage(message);
      redirectToDashboard();
    } else if (status === "FAILED") {
      // ❌ Payment failed - show error
      showErrorMessage(message);
      showRetryButton();
    } else if (status === "PENDING") {
      // ⏳ Payment is pending - usually resolves within seconds
      showWaitingMessage(message);
      setTimeout(checkPaymentStatus, 3000); // Check again in 3 seconds
    }
  }
}
```

---

## Backend Flow Diagram

```
HTTP Request Flow:
┌─────────────────────────────────────────────────────────────┐
│ Client App                                                   │
│                                                              │
│  POST /api/v1/payments/init                                 │
│  { planId: "uuid" }                                         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ Backend paymob.controller.js:initPayment()                  │
│                                                              │
│  1. Validate plan exists & is active ✓                      │
│  2. Get client user data ✓                                  │
│  3. Calculate fees ✓                                        │
│  4. Create Transaction record (PENDING) ✓                   │
│  5. Create Payment record (PENDING) ✓                       │
│  6. Call PayMob API:                                        │
│     - getAuthToken() ✓                                      │
│     - createOrder() ✓                                       │
│     - generatePaymentKey() ✓                                │
│  7. Save PayMob references (externalId, paymentToken) ✓     │
│  8. Return { paymentUrl, transactionId } ✓                  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ Client Browser                                               │
│                                                              │
│  Redirect to PayMob iframe                                  │
│  https://accept.paymob.com/api/acceptance/iframes/...       │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
        ↓                         ↓
    ✓ SUCCESS              ❌ FAILURE
        │                         │
        │                         │
        ↓                         ↓
┌─────────────────────────────────────────────────────────────┐
│ PayMob Server                                                │
│                                                              │
│  POST /webhook                                              │
│  { type: "transaction.processed",                           │
│    obj: { id, order, amount_cents, success: true/false } }  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ Backend paymob.webhook.js:handlePaymentWebhook()            │
│                                                              │
│  1. Verify webhook signature ✓                              │
│  2. Extract order ID from webhook ✓                         │
│  3. Find Payment record by externalId ✓                     │
│  4. Check if already processed (idempotent) ✓               │
│  5. Update Payment status → PAID/FAILED ✓                   │
│  6. Update Transaction status → PAID/FAILED ✓               │
│                                                              │
│  If PAID:                                                    │
│    - Add funds to trainer wallet ✓                          │
│    - Activate subscription ✓                                │
│    - Log activity (PAYMENT_COMPLETED) ✓                     │
│                                                              │
│  If FAILED:                                                  │
│    - Log activity (PAYMENT_FAILED) ✓                        │
│                                                              │
│  7. Return 200 OK to PayMob ✓                               │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
        ↓                         ↓
    ✓ PAID               ❌ FAILED
        │                         │
        │  Database Updated      │  Database Updated
        │  - Payment: PAID       │  - Payment: FAILED
        │  - Transaction: PAID   │  - Transaction: FAILED
        │  - Wallet: +funds      │
        │  - Subscription: ACTIVE│
        │  - ActivityLog: entry  │  - ActivityLog: entry
        │                         │
        ↓                         ↓
  User receives              User receives
  success notification       failure notification
```

---

## Database Changes on Payment Success

### Before Webhook:

```
Transaction (id: uuid1)
├── status: PENDING
├── clientId: uuid2
├── trainerId: uuid3
├── planId: uuid4
├── grossAmount: 100.00
├── trainerAmount: 90.00
└── platformFee: 10.00

Payment (id: uuid5)
├── status: PENDING
├── transactionId: uuid1
├── externalId: "paymob-order-789"
└── paymentToken: "token_xyz"

TrainerWallet (trainerId: uuid3)
└── balance: 0.00

Subscription (planId: uuid4, userId: uuid2)
└── (none or old one)

ActivityLog
└── (none for this payment)
```

### After Webhook (Success):

```
Transaction (id: uuid1)
├── status: PAID ✓
├── clientId: uuid2
├── trainerId: uuid3
├── planId: uuid4
├── grossAmount: 100.00
├── trainerAmount: 90.00
└── platformFee: 10.00

Payment (id: uuid5)
├── status: PAID ✓
├── transactionId: uuid1
├── externalId: "paymob-order-789"
└── paymentToken: "token_xyz"

TrainerWallet (trainerId: uuid3)
└── balance: 90.00 ✓

Subscription (planId: uuid4, userId: uuid2)
├── status: ACTIVE ✓
├── startDate: NOW ✓
├── endDate: NOW + 1 month/year ✓
└── currentPeriodEnd: NOW + 1 month/year ✓

ActivityLog (new)
├── userId: uuid2 ✓
├── action: PAYMENT_COMPLETED ✓
└── metadata: { transactionId, amount, currency, planId } ✓
```

---

## Environment Setup

Create `.env.local` with:

```env
# === DATABASE ===
DATABASE_URL=postgresql://user:password@host:5432/db

# === PAYMOB (Get from paymob.com Dashboard) ===
PAYMOB_BASE_URL=https://accept.paymob.com/api
PAYMOB_API_KEY=<your_live_api_key>
PAYMOB_INTEGRATION_ID=<your_integration_id>
PAYMOB_IFRAME_ID=<your_iframe_id>
PAYMOB_HMAC_SECRET=<your_webhook_secret>

# === PLATFORM ===
PLATFORM_FEE_PERCENT=10

# === NODE ===
NODE_ENV=production
```

---

## Testing Checklist

### Local Testing

- [ ] Test payment init endpoint returns valid paymentUrl
- [ ] Verify Transaction created with PENDING status
- [ ] Verify Payment created with PENDING status
- [ ] Test webhook with simulated successful payment
- [ ] Verify Payment status updated to PAID
- [ ] Verify Transaction status updated to PAID
- [ ] Verify TrainerWallet balance increased
- [ ] Verify Subscription created with ACTIVE status
- [ ] Verify ActivityLog entry created
- [ ] Test webhook with simulated failed payment
- [ ] Verify Payment status updated to FAILED
- [ ] Verify Transaction status updated to FAILED
- [ ] Test status endpoint returns correct state

### Sandbox Testing (PayMob)

- [ ] Configure webhook URL in PayMob dashboard
- [ ] Test with PayMob test card: 4111111111111111
- [ ] Verify webhook is received and processed
- [ ] Check that status endpoint returns PAID
- [ ] Monitor logs for any errors

### Production Ready

- [ ] Env vars configured on server
- [ ] Webhook URL configured in PayMob dashboard
- [ ] HMAC secret matches between PayMob dashboard and env var
- [ ] Error logging in place for troubleshooting
- [ ] Tested with real PayMob account (sandbox)
- [ ] Rate limiting considered for /init endpoint
- [ ] Monitoring/alerts set up for payment failures

---

## Common Issues & Solutions

### Issue: "Plan not found"

**Cause:** Invalid planId or plan is deleted  
**Solution:** Verify planId exists: `SELECT * FROM "Plan" WHERE id = 'xxx'`

### Issue: "Payment initialization failed: PAYMOB authentication failed"

**Cause:** Invalid PAYMOB_API_KEY  
**Solution:** Check PayMob dashboard, copy API key again, update env var

### Issue: Webhook never received

**Cause:** Webhook URL not configured in PayMob dashboard  
**Solution:**

1. Log in to PayMob dashboard
2. Set webhook URL to: `https://yourdomain.com/api/v1/payments/webhook`
3. Save configuration

### Issue: Webhook received but payment not updated

**Cause:** externalId (order ID) mismatch between webhook and database  
**Solution:** Check webhook externalId matches `Payment.externalId` in database

### Issue: Signature verification fails

**Cause:** PAYMOB_HMAC_SECRET mismatch  
**Solution:**

1. In dev mode, signature check can be skipped (logs warning)
2. In production, verify secret matches PayMob dashboard exactly

### Issue: Subscription not created

**Cause:** planId doesn't exist or transaction.plan not loaded  
**Solution:** Verify Plan record exists, webhook handler logs error

---

## Key Code Locations

| File                                                     | Purpose                                   |
| -------------------------------------------------------- | ----------------------------------------- |
| [paymob.controller.js](../payments/paymob.controller.js) | Init payment & status check endpoints     |
| [paymob.webhook.js](../payments/paymob.webhook.js)       | Webhook processing & database updates     |
| [paymob.service.js](../payments/paymob.service.js)       | PayMob API calls                          |
| [paymob.utils.js](../payments/paymob.utils.js)           | Helper functions & signature verification |
| [paymob.routes.js](../payments/paymob.routes.js)         | Route definitions                         |
| [PAYMENT-LOGIC.md](./PAYMENT-LOGIC.md)                   | Complete documentation                    |

---

## Summary

✅ **Complete payment flow implemented from start to finish**
✅ **Real user data used instead of test data**
✅ **Webhook handler with signature verification**
✅ **Idempotent webhook processing (safe retries)**
✅ **Status check endpoint for clients**
✅ **Wallet funding on successful payment**
✅ **Subscription activation on successful payment**
✅ **Activity logging for audit trail**
✅ **Error handling throughout**
✅ **Ready for PayMob integration**

**Everything until the user pays with PayMob is complete! 🚀**
