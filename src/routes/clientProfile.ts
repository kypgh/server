import { Router } from 'express';
import ClientProfileController from '../controllers/clientProfileController';
import AuthMiddleware from '../middleware/auth';

const router = Router();

/**
 * @route   GET /api/client/profile
 * @desc    Get client profile
 * @access  Private (Client only)
 */
router.get('/profile', AuthMiddleware.clientAuth, ClientProfileController.getProfile);

/**
 * @route   PUT /api/client/profile
 * @desc    Update client profile
 * @access  Private (Client only)
 */
router.put('/profile', AuthMiddleware.clientAuth, ClientProfileController.updateProfile);

export default router;