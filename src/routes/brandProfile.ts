import { Router } from 'express';
import BrandProfileController from '../controllers/brandProfileController';
import AuthMiddleware from '../middleware/auth';

const router = Router();

/**
 * @route   GET /api/brand/profile
 * @desc    Get brand profile
 * @access  Private (Brand only)
 */
router.get('/profile', AuthMiddleware.brandAuth, BrandProfileController.getProfile);

/**
 * @route   PUT /api/brand/profile
 * @desc    Update brand profile
 * @access  Private (Brand only)
 */
router.put('/profile', AuthMiddleware.brandAuth, BrandProfileController.updateProfile);

export default router;