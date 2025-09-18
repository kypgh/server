import { Router } from 'express';
import ClientCreditController from '../controllers/clientCreditController';
import AuthMiddleware from '../middleware/auth';

const router = Router();

// Apply client authentication to all routes
router.use(AuthMiddleware.clientAuth);

/**
 * @route   POST /api/client/credits/purchase
 * @desc    Purchase credit plan
 * @access  Private (Client only)
 */
router.post('/purchase', ClientCreditController.purchaseCreditPlan);

/**
 * @route   GET /api/client/credits/balances
 * @desc    Get client's credit balances (all brands or specific brand)
 * @access  Private (Client only)
 */
router.get('/balances', ClientCreditController.getCreditBalances);

/**
 * @route   GET /api/client/credits/balances/:brandId/transactions
 * @desc    Get credit transaction history for a specific brand
 * @access  Private (Client only)
 */
router.get('/balances/:brandId/transactions', ClientCreditController.getCreditTransactionHistory);

/**
 * @route   GET /api/client/credits/expiring
 * @desc    Get credits expiring soon
 * @access  Private (Client only)
 */
router.get('/expiring', ClientCreditController.getExpiringCredits);

/**
 * @route   GET /api/client/credits/eligibility/:brandId/:classId
 * @desc    Check credit eligibility for a specific class
 * @access  Private (Client only)
 */
router.get('/eligibility/:brandId/:classId', ClientCreditController.checkCreditEligibility);

export default router;