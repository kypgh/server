import { Router } from 'express';
import CreditPlanController from '../controllers/creditPlanController';
import AuthMiddleware from '../middleware/auth';

const router = Router();

// Apply brand authentication to all routes
router.use(AuthMiddleware.brandAuth);

/**
 * @route   POST /api/brand/credit-plans
 * @desc    Create a new credit plan
 * @access  Private (Brand only)
 */
router.post('/', CreditPlanController.createCreditPlan);

/**
 * @route   GET /api/brand/credit-plans
 * @desc    Get all credit plans for the authenticated brand
 * @access  Private (Brand only)
 */
router.get('/', CreditPlanController.getCreditPlans);

/**
 * @route   GET /api/brand/credit-plans/:planId
 * @desc    Get a specific credit plan by ID
 * @access  Private (Brand only)
 */
router.get('/:planId', CreditPlanController.getCreditPlan);

/**
 * @route   PUT /api/brand/credit-plans/:planId
 * @desc    Update a credit plan
 * @access  Private (Brand only)
 */
router.put('/:planId', CreditPlanController.updateCreditPlan);

/**
 * @route   DELETE /api/brand/credit-plans/:planId
 * @desc    Delete (deactivate) a credit plan
 * @access  Private (Brand only)
 */
router.delete('/:planId', CreditPlanController.deleteCreditPlan);

export default router;