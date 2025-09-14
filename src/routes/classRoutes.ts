import { Router } from 'express';
import ClassController from '../controllers/classController';
import AuthMiddleware from '../middleware/auth';

const router = Router();

// Apply brand authentication to all routes
router.use(AuthMiddleware.brandAuth);

/**
 * @route   POST /api/brand/classes
 * @desc    Create a new class
 * @access  Private (Brand only)
 */
router.post('/', ClassController.createClass);

/**
 * @route   GET /api/brand/classes
 * @desc    Get all classes for the authenticated brand with filtering and pagination
 * @access  Private (Brand only)
 * @query   category, difficulty, status, search, page, limit, sortBy, sortOrder
 */
router.get('/', ClassController.getClasses);

/**
 * @route   GET /api/brand/classes/stats
 * @desc    Get class statistics for the authenticated brand
 * @access  Private (Brand only)
 */
router.get('/stats', ClassController.getClassStats);

/**
 * @route   GET /api/brand/classes/:classId
 * @desc    Get a specific class by ID
 * @access  Private (Brand only - ownership validated)
 */
router.get('/:classId', ClassController.getClassById);

/**
 * @route   PUT /api/brand/classes/:classId
 * @desc    Update a class
 * @access  Private (Brand only - ownership validated)
 */
router.put('/:classId', ClassController.updateClass);

/**
 * @route   DELETE /api/brand/classes/:classId
 * @desc    Delete a class (soft delete)
 * @access  Private (Brand only - ownership validated)
 */
router.delete('/:classId', ClassController.deleteClass);

export default router;