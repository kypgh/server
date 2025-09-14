import { Router } from 'express';
import ClientAuthController from '../controllers/clientAuthController';

const router = Router();

/**
 * @route   POST /api/auth/client/register
 * @desc    Register a new client
 * @access  Public
 */
router.post('/register', ClientAuthController.register);

/**
 * @route   POST /api/auth/client/login
 * @desc    Login client
 * @access  Public
 */
router.post('/login', ClientAuthController.login);

/**
 * @route   POST /api/auth/client/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public (requires valid refresh token)
 */
router.post('/refresh', ClientAuthController.refresh);

export default router;