import { Router } from 'express';
import ClientSubscriptionController from '../controllers/clientSubscriptionController';
import AuthMiddleware from '../middleware/auth';
import {
  validateSubscriptionPurchase,
  validateSubscriptionQuery,
  validateSubscriptionCancellation,
  validateSubscriptionIdParam,
  validateBookingEligibilityQuery
} from '../validation/clientSubscription';

const router = Router();

/**
 * @route   POST /api/client/subscriptions/purchase
 * @desc    Purchase a subscription plan
 * @access  Private (Client only)
 */
router.post(
  '/purchase',
  AuthMiddleware.clientAuth,
  validateSubscriptionPurchase,
  ClientSubscriptionController.purchaseSubscription
);

/**
 * @route   GET /api/client/subscriptions
 * @desc    Get client's subscriptions with filtering and pagination
 * @access  Private (Client only)
 */
router.get(
  '/',
  AuthMiddleware.clientAuth,
  validateSubscriptionQuery,
  ClientSubscriptionController.getSubscriptions
);

/**
 * @route   GET /api/client/subscriptions/:subscriptionId
 * @desc    Get a specific subscription by ID
 * @access  Private (Client only)
 */
router.get(
  '/:subscriptionId',
  AuthMiddleware.clientAuth,
  validateSubscriptionIdParam,
  ClientSubscriptionController.getSubscription
);

/**
 * @route   PUT /api/client/subscriptions/:subscriptionId/cancel
 * @desc    Cancel a subscription
 * @access  Private (Client only)
 */
router.put(
  '/:subscriptionId/cancel',
  AuthMiddleware.clientAuth,
  validateSubscriptionIdParam,
  validateSubscriptionCancellation,
  ClientSubscriptionController.cancelSubscription
);

/**
 * @route   GET /api/client/subscriptions/:subscriptionId/booking-eligibility
 * @desc    Check if subscription is eligible for booking (optionally for a specific class)
 * @access  Private (Client only)
 */
router.get(
  '/:subscriptionId/booking-eligibility',
  AuthMiddleware.clientAuth,
  validateSubscriptionIdParam,
  validateBookingEligibilityQuery,
  ClientSubscriptionController.checkBookingEligibility
);

export default router;