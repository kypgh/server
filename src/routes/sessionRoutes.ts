import { Router } from 'express';
import SessionController from '../controllers/sessionController';
import AuthMiddleware from '../middleware/auth';

const router = Router();

// Apply brand authentication to all routes
router.use(AuthMiddleware.brandAuth);

/**
 * @route   POST /api/brand/sessions
 * @desc    Create a new session
 * @access  Private (Brand only)
 */
router.post('/', SessionController.createSession);

/**
 * @route   POST /api/brand/sessions/bulk
 * @desc    Create multiple sessions for recurring schedules
 * @access  Private (Brand only)
 */
router.post('/bulk', SessionController.createBulkSessions);

/**
 * @route   GET /api/brand/sessions
 * @desc    Get all sessions for the authenticated brand with filtering and pagination
 * @access  Private (Brand only)
 * @query   class, status, startDate, endDate, availableOnly, page, limit, sortBy, sortOrder
 */
router.get('/', SessionController.getSessions);

/**
 * @route   GET /api/brand/sessions/stats
 * @desc    Get session statistics for the authenticated brand
 * @access  Private (Brand only)
 */
router.get('/stats', SessionController.getSessionStats);

/**
 * @route   GET /api/brand/sessions/:sessionId
 * @desc    Get a specific session by ID
 * @access  Private (Brand only - ownership validated)
 */
router.get('/:sessionId', SessionController.getSessionById);

/**
 * @route   PUT /api/brand/sessions/:sessionId
 * @desc    Update a session
 * @access  Private (Brand only - ownership validated)
 */
router.put('/:sessionId', SessionController.updateSession);

/**
 * @route   DELETE /api/brand/sessions/:sessionId
 * @desc    Cancel a session
 * @access  Private (Brand only - ownership validated)
 */
router.delete('/:sessionId', SessionController.deleteSession);

export default router;