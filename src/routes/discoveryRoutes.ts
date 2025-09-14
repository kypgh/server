import { Router } from 'express';
import DiscoveryController from '../controllers/discoveryController';
import AuthMiddleware from '../middleware/auth';

const router = Router();

/**
 * @route GET /api/client/discovery/brands
 * @desc Get all brands with filtering and search capabilities
 * @access Public (no authentication required for discovery)
 * @requirements 8.1 - Brand listing with filtering and search
 */
router.get('/brands', DiscoveryController.getBrands);

/**
 * @route GET /api/client/discovery/brands/:brandId
 * @desc Get brand details with class information
 * @access Public (no authentication required for discovery)
 * @requirements 8.2 - Brand detail with class information
 */
router.get('/brands/:brandId', DiscoveryController.getBrandById);

/**
 * @route GET /api/client/discovery/classes
 * @desc Browse classes with category, difficulty, and brand filtering
 * @access Public (no authentication required for discovery)
 * @requirements 8.3 - Class browsing with filtering
 */
router.get('/classes', DiscoveryController.getClasses);

/**
 * @route GET /api/client/discovery/sessions
 * @desc Browse sessions with date and availability filtering
 * @access Public (no authentication required for discovery)
 * @requirements 8.4, 8.5 - Session browsing with date and availability filtering
 */
router.get('/sessions', DiscoveryController.getSessions);

/**
 * @route GET /api/client/discovery/brands/:brandId/subscription-plans
 * @desc Get available subscription plans for a specific brand
 * @access Public (no authentication required for discovery)
 * @requirements 8.6 - Subscription plan discovery for client purchase decisions
 */
router.get('/brands/:brandId/subscription-plans', DiscoveryController.getBrandSubscriptionPlans);

/**
 * @route GET /api/client/discovery/brands/:brandId/credit-plans
 * @desc Get available credit plans for a specific brand
 * @access Public (no authentication required for discovery)
 * @requirements 8.7 - Credit plan discovery for client purchase decisions
 */
router.get('/brands/:brandId/credit-plans', DiscoveryController.getBrandCreditPlans);

export default router;