// import Router from "express";
// import { initPayment, checkPaymentStatus } from "./paymob.controller.js";
// import { handlePaymentWebhook } from "./paymob.webhook.js";
// import { verifyToken } from "../middleware/auth.js";

// const router = Router();

// // Initialize payment (protected - user must be authenticated)
// router.post("/init", verifyToken, initPayment);

// // Check payment status (protected - user must be authenticated)
// router.get("/status/:transactionId", verifyToken, checkPaymentStatus);

// // PayMob webhook callback (unprotected - uses signature verification instead)
// router.post("/webhook", handlePaymentWebhook);

// export default router;
