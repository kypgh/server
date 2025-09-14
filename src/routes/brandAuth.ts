import { Router } from 'express';
import BrandAuthController from '../controllers/brandAuthController';
import AuthMiddleware from '../middleware/auth';

const router = Router();

/**
 * @route   POST /api/auth/brand/register
 * @desc    Register a new brand
 * @access  Public
 */
router.post('/register', BrandAuthController.register);

/**
 * @route   POST /api/auth/brand/login
 * @desc    Login brand
 * @access  Public
 */
router.post('/login', BrandAuthController.login);

/**
 * @route   POST /api/auth/brand/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public (requires valid refresh token)
 */
router.post('/refresh', BrandAuthController.refresh);

export default router;