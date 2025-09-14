import { Router } from 'express';
import paymentController from '../controllers/paymentController';
import AuthMiddleware from '../middleware/auth';
import {
  validateSubscriptionPaymentIntent,
  validateCreditPaymentIntent,
  validatePaymentConfirmation,
  validatePaymentHistoryQuery,
  validatePaymentIdParam,
  validateWebhookSignature
} from '../validation/payment';
import { validateStripeAccount } from '../middleware/stripeValidation';

const router = Router();

// Client payment routes
/**
 * @route   POST /api/client/payments/subscription/create-intent
 * @desc    Create PaymentIntent for subscription purchase
 * @access  Private (Client only)
 */
router.post(
  '/subscription/create-intent',
  AuthMiddleware.clientAuth,
  validateSubscriptionPaymentIntent,
  paymentController.createSubscriptionPaymentIntent
);

/**
 * @route   POST /api/client/payments/credits/create-intent
 * @desc    Create PaymentIntent for credit plan purchase
 * @access  Private (Client only)
 */
router.post(
  '/credits/create-intent',
  AuthMiddleware.clientAuth,
  validateCreditPaymentIntent,
  paymentController.createCreditPaymentIntent
);

/**
 * @route   POST /api/client/payments/confirm
 * @desc    Confirm payment completion
 * @access  Private (Client only)
 */
router.post(
  '/confirm',
  AuthMiddleware.clientAuth,
  validatePaymentConfirmation,
  paymentController.confirmPayment
);

/**
 * @route   GET /api/client/payments/history
 * @desc    Get client's payment history
 * @access  Private (Client only)
 */
router.get(
  '/history',
  AuthMiddleware.clientAuth,
  validatePaymentHistoryQuery,
  paymentController.getClientPaymentHistory
);

/**
 * @route   GET /api/client/payments/:paymentId
 * @desc    Get payment details by ID
 * @access  Private (Client only)
 */
router.get(
  '/:paymentId',
  AuthMiddleware.clientAuth,
  validatePaymentIdParam,
  paymentController.getPaymentDetails
);

// Brand payment routes
/**
 * @route   GET /api/brand/payments/history
 * @desc    Get brand's payment history
 * @access  Private (Brand only)
 */
router.get(
  '/brand/history',
  AuthMiddleware.brandAuth,
  validatePaymentHistoryQuery,
  paymentController.getBrandPaymentHistory
);

// Webhook routes (no authentication required)
/**
 * @route   POST /api/payments/webhook
 * @desc    Handle Stripe webhook events
 * @access  Public (Stripe webhooks)
 */
router.post(
  '/webhook',
  validateWebhookSignature,
  paymentController.handleWebhook
);

export default router;