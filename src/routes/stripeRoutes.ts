import { Router } from 'express';
import stripeController from '../controllers/stripeController';
import AuthMiddleware from '../middleware/auth';
import { validateStripeAccount } from '../middleware/stripeValidation';

const router = Router();

/**
 * @route   POST /api/brand/stripe/connect
 * @desc    Connect brand to Stripe (create account and get onboarding link)
 * @access  Private (Brand only)
 */
router.post('/connect', AuthMiddleware.brandAuth, stripeController.connectAccount);

/**
 * @route   GET /api/brand/stripe/account-status
 * @desc    Get Stripe account status and onboarding information
 * @access  Private (Brand only)
 */
router.get('/account-status', AuthMiddleware.brandAuth, stripeController.getAccountStatus);

/**
 * @route   POST /api/brand/stripe/refresh-status
 * @desc    Refresh onboarding status after user completes onboarding
 * @access  Private (Brand only)
 */
router.post('/refresh-status', AuthMiddleware.brandAuth, stripeController.refreshOnboardingStatus);

/**
 * @route   GET /api/brand/stripe/success
 * @desc    Stripe onboarding success callback
 * @access  Public (Stripe callback)
 */
router.get('/success', stripeController.onboardingSuccess);

export default router;