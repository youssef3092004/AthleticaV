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

    // 1️⃣ Get plan details
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

    // 2️⃣ Get client details for billing
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

    // 3️⃣ Calculate fees
    const platformFeePercent = Number(process.env.PLATFORM_FEE_PERCENT || 0);
    const platformFee = (plan.price * platformFeePercent) / 100;
    const trainerAmount = plan.price - platformFee;
    const grossAmount = plan.price; // Total charged to client

    const amountCents = Math.round(grossAmount * 100); // Convert to cents

    // 4️⃣ Create Transaction record
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

    // 5️⃣ Create Payment record
    const payment = await prisma.payment.create({
      data: {
        transactionId: transaction.id,
        provider: "paymob",
        amountCents,
        currency: "EGP",
        status: "PENDING",
      },
    });

    // 6️⃣ Call PayMob API
    let order;
    let paymentKey;
    try {
      const token = await getAuthToken();

      order = await createOrder(token, amountCents);
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
        street: "N/A",
      };

      paymentKey = await generatePaymentKey(
        token,
        order.id,
        amountCents,
        billingData,
      );

      if (!paymentKey) {
        throw new Error("PayMob payment key generation failed");
      }

      // 7️⃣ Update Payment with PayMob references
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

    const paymentUrl = buildPaymentUrl(paymentKey);

    // 8️⃣ Return payment URL
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
