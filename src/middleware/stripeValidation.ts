import { Request, Response, NextFunction } from 'express';
import { Brand } from '../models/Brand';
import stripeService from '../services/stripeService';
import { AuthenticatedRequest } from './auth';

/**
 * Middleware to validate that a brand has a connected and active Stripe account
 * This should be used for payment-related operations
 */
export const validateStripeAccount = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const brandId = req.user?.id;
    
    if (!brandId) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_003',
          message: 'Unauthorized access'
        }
      });
      return;
    }

    // Get brand information
    const brand = await Brand.findById(brandId);
    if (!brand) {
      res.status(404).json({
        success: false,
        error: {
          code: 'BRAND_001',
          message: 'Brand not found'
        }
      });
      return;
    }

    // Check if brand has Stripe account
    if (!brand.stripeConnectAccountId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'STRIPE_001',
          message: 'Stripe account not connected. Please connect your Stripe account first.',
          details: {
            requiresAction: 'stripe_connect',
            actionUrl: '/api/brand/stripe/connect'
          }
        }
      });
      return;
    }

    // Validate payment capability with Stripe
    const canProcessPayments = await stripeService.validatePaymentCapability(
      brand.stripeConnectAccountId
    );

    if (!canProcessPayments) {
      res.status(400).json({
        success: false,
        error: {
          code: 'STRIPE_002',
          message: 'Stripe account onboarding incomplete or charges not enabled',
          details: {
            requiresAction: 'stripe_onboarding',
            actionUrl: '/api/brand/stripe/account-status'
          }
        }
      });
      return;
    }

    // Add Stripe account ID to request for use in controllers
    req.stripeAccountId = brand.stripeConnectAccountId;
    next();
  } catch (error) {
    console.error('Error in validateStripeAccount middleware:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'STRIPE_004',
        message: 'Error validating Stripe account'
      }
    });
  }
};

/**
 * Middleware to check Stripe account status without blocking the request
 * Adds Stripe account information to the request object
 */
export const checkStripeAccount = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const brandId = req.user?.id;
    
    if (brandId) {
      const brand = await Brand.findById(brandId);
      if (brand?.stripeConnectAccountId) {
        const canProcessPayments = await stripeService.validatePaymentCapability(
          brand.stripeConnectAccountId
        );
        
        req.stripeAccountId = brand.stripeConnectAccountId;
        req.stripeAccountActive = canProcessPayments;
      }
    }
    
    next();
  } catch (error) {
    console.error('Error in checkStripeAccount middleware:', error);
    // Don't block the request, just continue without Stripe info
    next();
  }
};

// Extend AuthenticatedRequest interface to include Stripe account info
declare global {
  namespace Express {
    interface Request {
      stripeAccountId?: string;
      stripeAccountActive?: boolean;
    }
  }
}