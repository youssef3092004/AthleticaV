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
async function getAuthToken() {
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
async function createOrder(authToken, amountCents) {
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
async function generatePaymentKey(
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
function buildPaymentUrl(paymentToken) {
  if (!PAYMOB_IFRAME_ID) {
    throw new Error("PAYMOB_IFRAME_ID not configured");
  }

  return `https://accept.paymob.com/api/acceptance/iframes/${PAYMOB_IFRAME_ID}?payment_token=${paymentToken}`;
}

export { getAuthToken, createOrder, generatePaymentKey, buildPaymentUrl };
