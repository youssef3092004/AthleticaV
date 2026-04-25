# Payment Logic - Frontend Implementation Example

## React Payment Component Example

```jsx
import React, { useState, useEffect } from "react";
import "./PaymentFlow.css";

/**
 * Complete payment flow component
 * Handles init → redirect → status check → success/failure
 */
function PaymentFlow({ planId, authToken, onPaymentComplete }) {
  const [step, setStep] = useState("SELECT_PLAN"); // SELECT_PLAN, PROCESSING, CHECKOUT, WAITING, SUCCESS, FAILED
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [transactionId, setTransactionId] = useState(null);
  const [statusCheckInterval, setStatusCheckInterval] = useState(null);

  /**
   * Step 1: User clicks "Buy Plan"
   */
  async function handleBuyPlan() {
    setLoading(true);
    setError(null);

    try {
      // Call backend to initialize payment
      const response = await fetch("/api/v1/payments/init", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ planId }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Payment initialization failed");
      }

      // Save transaction ID for later status checks
      const txId = data.data.transactionId;
      setTransactionId(txId);
      localStorage.setItem("lastTransactionId", txId);
      localStorage.setItem("lastTransactionTime", Date.now());

      setStep("CHECKOUT");
      setLoading(false);

      // Redirect to PayMob checkout
      // Open in same window or new window (you can customize)
      window.location.href = data.data.paymentUrl;
    } catch (err) {
      console.error("Payment init error:", err);
      setError(err.message);
      setLoading(false);
    }
  }

  /**
   * Step 2: Check payment status (called when user returns from PayMob)
   */
  async function checkPaymentStatus(txId) {
    try {
      const response = await fetch(`/api/v1/payments/status/${txId}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error("Status check failed");
      }

      const { status, message } = data.data;

      console.log(`Payment status: ${status}`, message);

      if (status === "PAID") {
        // ✅ SUCCESS
        setStep("SUCCESS");
        if (statusCheckInterval) clearInterval(statusCheckInterval);
        if (onPaymentComplete) onPaymentComplete(txId);
      } else if (status === "FAILED") {
        // ❌ FAILURE
        setStep("FAILED");
        setError(message || "Payment failed");
        if (statusCheckInterval) clearInterval(statusCheckInterval);
      }
      // If PENDING, continue polling

      return status;
    } catch (err) {
      console.error("Status check error:", err);
      // Continue polling even on error
      return null;
    }
  }

  /**
   * Step 3: Restore from browser back button
   * Check if user returned from PayMob
   */
  useEffect(() => {
    const savedTxId = localStorage.getItem("lastTransactionId");
    const savedTime = localStorage.getItem("lastTransactionTime");

    if (savedTxId && savedTime) {
      const age = Date.now() - parseInt(savedTime);
      // Only restore if transaction is fresh (less than 10 minutes old)
      if (age < 10 * 60 * 1000) {
        setTransactionId(savedTxId);
        setStep("WAITING");

        // Check status immediately
        checkPaymentStatus(savedTxId);

        // Then poll every 3 seconds
        const interval = setInterval(() => checkPaymentStatus(savedTxId), 3000);
        setStatusCheckInterval(interval);

        // Auto-clear interval after 5 minutes
        setTimeout(() => clearInterval(interval), 5 * 60 * 1000);
      }
    }
  }, []);

  /**
   * Cleanup interval on unmount
   */
  useEffect(() => {
    return () => {
      if (statusCheckInterval) clearInterval(statusCheckInterval);
    };
  }, [statusCheckInterval]);

  return (
    <div className="payment-flow">
      <div className="payment-card">
        {/* STEP 1: SELECT PLAN - Show plan details and buy button */}
        {step === "SELECT_PLAN" && (
          <div className="step-content">
            <h2>Confirm Purchase</h2>
            <div className="plan-details">
              <p>Plan ID: {planId}</p>
              <p className="amount">$99.99/month</p>
            </div>
            <button
              onClick={handleBuyPlan}
              disabled={loading}
              className="btn btn-primary"
            >
              {loading ? "Processing..." : "Proceed to Payment"}
            </button>
            {error && <div className="error-message">{error}</div>}
          </div>
        )}

        {/* STEP 2: CHECKOUT - Redirecting to PayMob */}
        {step === "CHECKOUT" && (
          <div className="step-content">
            <div className="loading-spinner"></div>
            <p>Redirecting to secure checkout...</p>
            <small>You will be redirected to PayMob payment page</small>
          </div>
        )}

        {/* STEP 3: WAITING - Checking payment status */}
        {step === "WAITING" && (
          <div className="step-content">
            <div className="loading-spinner"></div>
            <h3>Processing Payment</h3>
            <p>We're verifying your payment...</p>
            <p className="small">This usually takes a few seconds</p>

            <button
              onClick={() => checkPaymentStatus(transactionId)}
              className="btn btn-secondary btn-small"
            >
              Check Status Now
            </button>
          </div>
        )}

        {/* STEP 4: SUCCESS */}
        {step === "SUCCESS" && (
          <div className="step-content success">
            <div className="success-icon">✓</div>
            <h2>Payment Successful!</h2>
            <p>Your subscription is now active</p>
            <p className="small">Transaction ID: {transactionId}</p>

            <button
              onClick={() => (window.location.href = "/dashboard")}
              className="btn btn-primary"
            >
              Go to Dashboard
            </button>
          </div>
        )}

        {/* STEP 5: FAILED */}
        {step === "FAILED" && (
          <div className="step-content failed">
            <div className="failed-icon">✗</div>
            <h2>Payment Failed</h2>
            <p>{error || "Please try again"}</p>
            <p className="small">Transaction ID: {transactionId}</p>

            <div className="button-group">
              <button
                onClick={() => {
                  setStep("SELECT_PLAN");
                  setError(null);
                  setTransactionId(null);
                  localStorage.removeItem("lastTransactionId");
                }}
                className="btn btn-primary"
              >
                Try Again
              </button>
              <button
                onClick={() => (window.location.href = "/contact-support")}
                className="btn btn-secondary"
              >
                Contact Support
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PaymentFlow;
```

---

## Plain JavaScript Implementation

```html
<!-- payment.html -->
<!DOCTYPE html>
<html>
  <head>
    <title>Payment</title>
    <style>
      .payment-card {
        max-width: 500px;
        margin: 50px auto;
        padding: 30px;
        border: 1px solid #ddd;
        border-radius: 8px;
      }
      .btn {
        padding: 10px 20px;
        font-size: 16px;
        cursor: pointer;
        border: none;
        border-radius: 4px;
      }
      .btn-primary {
        background: #007bff;
        color: white;
      }
      .btn-primary:hover {
        background: #0056b3;
      }
      .error {
        color: #dc3545;
      }
      .success {
        color: #28a745;
      }
      .spinner {
        border: 4px solid #f3f3f3;
        border-top: 4px solid #007bff;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        animation: spin 1s linear infinite;
        margin: 20px auto;
      }
      @keyframes spin {
        0% {
          transform: rotate(0deg);
        }
        100% {
          transform: rotate(360deg);
        }
      }
    </style>
  </head>
  <body>
    <div class="payment-card" id="paymentCard">
      <h2>Secure Payment</h2>

      <div id="content">
        <!-- Plan selection form -->
        <div id="selectPlanStep">
          <input
            type="text"
            id="planId"
            placeholder="Plan ID"
            value="550e8400-e29b-41d4-a716-446655440000"
          />
          <button onclick="handleBuyPlan()" class="btn btn-primary">
            Proceed to Payment
          </button>
        </div>

        <!-- Processing spinner (hidden initially) -->
        <div id="processingStep" style="display:none">
          <div class="spinner"></div>
          <p>Processing payment...</p>
        </div>

        <!-- Success message (hidden initially) -->
        <div id="successStep" style="display:none">
          <p class="success">✓ Payment Successful!</p>
          <p>Your subscription is now active.</p>
          <p id="transactionIdDisplay"></p>
        </div>

        <!-- Error message (hidden initially) -->
        <div id="errorStep" style="display:none">
          <p class="error">✗ Payment Failed</p>
          <p id="errorMessage"></p>
          <button onclick="location.reload()" class="btn btn-primary">
            Try Again
          </button>
        </div>
      </div>
    </div>

    <script>
      // Get auth token from localStorage or sessionStorage
      const authToken =
        localStorage.getItem("authToken") ||
        sessionStorage.getItem("authToken");

      // Check if returning from PayMob
      function checkReturningUser() {
        const savedTxId = localStorage.getItem("lastTransactionId");
        if (savedTxId) {
          document.getElementById("selectPlanStep").style.display = "none";
          document.getElementById("processingStep").style.display = "block";
          checkPaymentStatus(savedTxId);
        }
      }

      // Initialize
      checkReturningUser();

      /**
       * Handle "Proceed to Payment" button click
       */
      async function handleBuyPlan() {
        const planId = document.getElementById("planId").value;

        if (!planId) {
          alert("Please enter a plan ID");
          return;
        }

        if (!authToken) {
          alert("Not authenticated. Please log in first.");
          return;
        }

        document.getElementById("selectPlanStep").style.display = "none";
        document.getElementById("processingStep").style.display = "block";

        try {
          // Call backend payment init endpoint
          const response = await fetch("/api/v1/payments/init", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${authToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ planId }),
          });

          const data = await response.json();

          if (!data.success) {
            throw new Error(data.error || "Payment init failed");
          }

          // Save transaction ID
          const txId = data.data.transactionId;
          localStorage.setItem("lastTransactionId", txId);
          localStorage.setItem("lastTransactionTime", Date.now());

          // Redirect to PayMob
          window.location.href = data.data.paymentUrl;
        } catch (err) {
          showError(err.message);
        }
      }

      /**
       * Check payment status
       */
      async function checkPaymentStatus(transactionId) {
        try {
          const response = await fetch(
            `/api/v1/payments/status/${transactionId}`,
            {
              headers: {
                Authorization: `Bearer ${authToken}`,
              },
            },
          );

          const data = await response.json();

          if (!data.success) {
            throw new Error("Status check failed");
          }

          const { status, message } = data.data;

          if (status === "PAID") {
            // Success!
            showSuccess(transactionId);
          } else if (status === "FAILED") {
            // Failed
            showError(message || "Payment failed");
          } else if (status === "PENDING") {
            // Still processing, check again in 3 seconds
            setTimeout(() => checkPaymentStatus(transactionId), 3000);
          }
        } catch (err) {
          // Continue checking even on error
          console.error("Status check error:", err);
          setTimeout(() => checkPaymentStatus(transactionId), 3000);
        }
      }

      /**
       * Show success message
       */
      function showSuccess(txId) {
        document.getElementById("selectPlanStep").style.display = "none";
        document.getElementById("processingStep").style.display = "none";
        document.getElementById("errorStep").style.display = "none";
        document.getElementById("successStep").style.display = "block";
        document.getElementById("transactionIdDisplay").textContent =
          `Transaction ID: ${txId}`;

        // Clear storage
        localStorage.removeItem("lastTransactionId");
      }

      /**
       * Show error message
       */
      function showError(message) {
        document.getElementById("selectPlanStep").style.display = "none";
        document.getElementById("processingStep").style.display = "none";
        document.getElementById("successStep").style.display = "none";
        document.getElementById("errorStep").style.display = "block";
        document.getElementById("errorMessage").textContent = message;
      }
    </script>
  </body>
</html>
```

---

## Vue 3 Implementation

```vue
<template>
  <div class="payment-flow">
    <!-- Step 1: Select Plan -->
    <div v-if="step === 'SELECT_PLAN'" class="step">
      <h2>Confirm Purchase</h2>
      <div class="plan-details">
        <p>Plan: {{ planId }}</p>
        <p class="amount">$99.99/month</p>
      </div>
      <button
        @click="handleBuyPlan"
        :disabled="loading"
        class="btn btn-primary"
      >
        {{ loading ? "Processing..." : "Proceed to Payment" }}
      </button>
      <div v-if="error" class="error-message">{{ error }}</div>
    </div>

    <!-- Step 2: Checking Payment Status -->
    <div v-if="step === 'WAITING'" class="step">
      <div class="spinner"></div>
      <h3>Processing Payment</h3>
      <p>Verifying your payment...</p>
      <button @click="checkPaymentStatusNow" class="btn btn-secondary">
        Check Status Now
      </button>
    </div>

    <!-- Step 3: Success -->
    <div v-if="step === 'SUCCESS'" class="step success">
      <h2>✓ Payment Successful!</h2>
      <p>Your subscription is now active</p>
      <p class="small">Transaction ID: {{ transactionId }}</p>
      <button @click="$router.push('/dashboard')" class="btn btn-primary">
        Go to Dashboard
      </button>
    </div>

    <!-- Step 4: Failed -->
    <div v-if="step === 'FAILED'" class="step failed">
      <h2>✗ Payment Failed</h2>
      <p>{{ error }}</p>
      <button @click="reset" class="btn btn-primary">Try Again</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";

const props = defineProps({
  planId: String,
  authToken: String,
});

const emit = defineEmits(["payment-complete"]);

const step = ref("SELECT_PLAN");
const loading = ref(false);
const error = ref(null);
const transactionId = ref(null);
const statusCheckInterval = ref(null);

async function handleBuyPlan() {
  loading.value = true;
  error.value = null;

  try {
    const response = await fetch("/api/v1/payments/init", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${props.authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ planId: props.planId }),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error);
    }

    transactionId.value = data.data.transactionId;
    step.value = "WAITING";

    // Redirect to PayMob
    window.location.href = data.data.paymentUrl;
  } catch (err) {
    error.value = err.message;
    loading.value = false;
  }
}

async function checkPaymentStatus(txId) {
  try {
    const response = await fetch(`/api/v1/payments/status/${txId}`, {
      headers: { Authorization: `Bearer ${props.authToken}` },
    });

    const data = await response.json();
    const { status } = data.data;

    if (status === "PAID") {
      step.value = "SUCCESS";
      clearInterval(statusCheckInterval.value);
      emit("payment-complete", txId);
    } else if (status === "FAILED") {
      step.value = "FAILED";
      error.value = data.data.message;
      clearInterval(statusCheckInterval.value);
    }
  } catch (err) {
    console.error("Status check error:", err);
  }
}

function checkPaymentStatusNow() {
  checkPaymentStatus(transactionId.value);
}

function reset() {
  step.value = "SELECT_PLAN";
  error.value = null;
  transactionId.value = null;
}

onMounted(() => {
  // Check if returning from PayMob
  const savedTxId = localStorage.getItem("lastTransactionId");
  if (savedTxId) {
    transactionId.value = savedTxId;
    step.value = "WAITING";
    checkPaymentStatus(savedTxId);

    statusCheckInterval.value = setInterval(
      () => checkPaymentStatus(savedTxId),
      3000,
    );
  }
});

onUnmounted(() => {
  if (statusCheckInterval.value) {
    clearInterval(statusCheckInterval.value);
  }
});
</script>

<style scoped>
.payment-flow {
  max-width: 500px;
  margin: 50px auto;
}
.step {
  padding: 30px;
  border: 1px solid #ddd;
  border-radius: 8px;
}
.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
.btn-primary {
  background: #007bff;
  color: white;
}
.btn-secondary {
  background: #6c757d;
  color: white;
}
.error-message {
  color: #dc3545;
  margin-top: 10px;
}
.success {
  color: #28a745;
}
.failed {
  color: #dc3545;
}
</style>
```

---

## Testing with cURL

### 1. Initialize Payment

```bash
curl -X POST http://localhost:5000/api/v1/payments/init \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "planId": "550e8400-e29b-41d4-a716-446655440000"
  }'

# Response:
{
  "success": true,
  "data": {
    "transactionId": "abc123",
    "paymentUrl": "https://accept.paymob.com/api/acceptance/iframes/123...",
    "externalId": "789"
  }
}
```

### 2. Check Status

```bash
curl http://localhost:5000/api/v1/payments/status/abc123 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Response while PENDING:
{
  "success": true,
  "data": {
    "status": "PENDING",
    "message": "Payment is pending..."
  }
}

# Response after PAID:
{
  "success": true,
  "data": {
    "status": "PAID",
    "message": "Payment successful!",
    "nextSteps": "Your subscription is now active..."
  }
}
```

### 3. Simulate Webhook (Test Only)

```bash
curl -X POST http://localhost:5000/api/v1/payments/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "type": "transaction.processed",
    "obj": {
      "id": 123456,
      "order": {
        "id": 789
      },
      "amount_cents": 10000,
      "currency": "EGP",
      "success": true
    }
  }'

# Response:
{
  "success": true,
  "message": "Payment processed successfully",
  "transactionId": "abc123"
}
```

---

## Summary

Three complete frontend implementations are provided:

1. **React** - Modern functional component with hooks
2. **Plain JavaScript** - No dependencies, works in any environment
3. **Vue 3** - Composition API with TypeScript support

All handle:

- ✅ Plan selection
- ✅ Redirect to PayMob
- ✅ Return from PayMob checkout
- ✅ Poll for payment status
- ✅ Show success/failure
- ✅ Error handling
- ✅ Retry logic

Choose the implementation that matches your project!
