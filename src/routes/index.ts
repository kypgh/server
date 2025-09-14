import { Router } from 'express';
import brandAuthRoutes from './brandAuth';
import brandProfileRoutes from './brandProfile';
import classRoutes from './classRoutes';
import sessionRoutes from './sessionRoutes';
import subscriptionPlanRoutes from './subscriptionPlanRoutes';
import creditPlanRoutes from './creditPlanRoutes';
import stripeRoutes from './stripeRoutes';
import clientAuthRoutes from './clientAuth';
import clientProfileRoutes from './clientProfile';
import discoveryRoutes from './discoveryRoutes';
import paymentRoutes from './paymentRoutes';

const router = Router();

// Authentication routes
router.use('/auth/brand', brandAuthRoutes);
router.use('/auth/client', clientAuthRoutes);

// Brand routes
router.use('/brand', brandProfileRoutes);
router.use('/brand/classes', classRoutes);
router.use('/brand/sessions', sessionRoutes);
router.use('/brand/subscription-plans', subscriptionPlanRoutes);
router.use('/brand/credit-plans', creditPlanRoutes);
router.use('/brand/stripe', stripeRoutes);

// Client routes
router.use('/client', clientProfileRoutes);
router.use('/client/discovery', discoveryRoutes);
router.use('/client/payments', paymentRoutes);

// Payment routes (includes both client and brand endpoints)
router.use('/payments', paymentRoutes);

export default router;