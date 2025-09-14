import { Router } from 'express';
import SubscriptionPlanController from '../controllers/subscriptionPlanController';
import AuthMiddleware from '../middleware/auth';

const router = Router();

// Apply brand authentication to all routes
router.use(AuthMiddleware.brandAuth);

/**
 * @route   POST /api/brand/subscription-plans
 * @desc    Create a new subscription plan
 * @access  Private (Brand only)
 */
router.post('/', SubscriptionPlanController.createSubscriptionPlan);

/**
 * @route   GET /api/brand/subscription-plans
 * @desc    Get all subscription plans for the authenticated brand
 * @access  Private (Brand only)
 */
router.get('/', SubscriptionPlanController.getSubscriptionPlans);

/**
 * @route   GET /api/brand/subscription-plans/:planId
 * @desc    Get a specific subscription plan by ID
 * @access  Private (Brand only)
 */
router.get('/:planId', SubscriptionPlanController.getSubscriptionPlan);

/**
 * @route   PUT /api/brand/subscription-plans/:planId
 * @desc    Update a subscription plan
 * @access  Private (Brand only)
 */
router.put('/:planId', SubscriptionPlanController.updateSubscriptionPlan);

/**
 * @route   DELETE /api/brand/subscription-plans/:planId
 * @desc    Delete (deactivate) a subscription plan
 * @access  Private (Brand only)
 */
router.delete('/:planId', SubscriptionPlanController.deleteSubscriptionPlan);

export default router;