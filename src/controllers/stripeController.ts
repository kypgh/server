import { Request, Response, NextFunction } from 'express';
import stripeService, { StripeConnectResponse, StripeAccountStatus } from '../services/stripeService';
import { Brand } from '../models/Brand';
import { AuthenticatedRequest } from '../middleware/auth';

export class StripeController {
  /**
   * Connect brand to Stripe (create account and onboarding link)
   */
  async connectAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
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

      // Check if brand already has a Stripe account
      if (brand.stripeConnectAccountId) {
        // Get current status and return onboarding link if needed
        const accountStatus = await stripeService.getAccountStatus(brand.stripeConnectAccountId);
        
        if (accountStatus.onboardingComplete) {
          res.status(200).json({
            success: true,
            data: {
              accountId: brand.stripeConnectAccountId,
              onboardingComplete: true,
              message: 'Stripe account already connected and onboarding complete'
            }
          });
          return;
        } else {
          res.status(200).json({
            success: true,
            data: {
              accountId: brand.stripeConnectAccountId,
              onboardingComplete: false,
              onboardingUrl: accountStatus.actionUrl,
              message: 'Stripe account exists but onboarding incomplete'
            }
          });
          return;
        }
      }

      // Create new Stripe Connect account
      const connectResponse: StripeConnectResponse = await stripeService.createConnectAccount(
        brandId,
        brand.email,
        brand.name
      );

      res.status(201).json({
        success: true,
        data: {
          accountId: connectResponse.accountId,
          onboardingUrl: connectResponse.onboardingUrl,
          onboardingComplete: false,
          message: 'Stripe Connect account created successfully'
        }
      });
    } catch (error) {
      console.error('Error in connectAccount:', error);
      next(error);
    }
  }

  /**
   * Get Stripe account status for the authenticated brand
   */
  async getAccountStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
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
        res.status(200).json({
          success: true,
          data: {
            accountId: null,
            onboardingComplete: false,
            chargesEnabled: false,
            payoutsEnabled: false,
            detailsSubmitted: false,
            requiresAction: true,
            message: 'No Stripe account connected'
          }
        });
        return;
      }

      // Get account status from Stripe
      const accountStatus: StripeAccountStatus = await stripeService.getAccountStatus(
        brand.stripeConnectAccountId
      );

      // Update brand onboarding status if it has changed
      if (accountStatus.onboardingComplete !== brand.stripeOnboardingComplete) {
        await stripeService.updateBrandOnboardingStatus(brandId, brand.stripeConnectAccountId);
      }

      res.status(200).json({
        success: true,
        data: accountStatus
      });
    } catch (error) {
      console.error('Error in getAccountStatus:', error);
      next(error);
    }
  }

  /**
   * Refresh onboarding status (called after user completes onboarding)
   */
  async refreshOnboardingStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
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
      if (!brand || !brand.stripeConnectAccountId) {
        res.status(404).json({
          success: false,
          error: {
            code: 'STRIPE_003',
            message: 'Stripe account not found'
          }
        });
        return;
      }

      // Update onboarding status
      await stripeService.updateBrandOnboardingStatus(brandId, brand.stripeConnectAccountId);

      // Get updated status
      const accountStatus = await stripeService.getAccountStatus(brand.stripeConnectAccountId);

      res.status(200).json({
        success: true,
        data: {
          ...accountStatus,
          message: 'Onboarding status refreshed successfully'
        }
      });
    } catch (error) {
      console.error('Error in refreshOnboardingStatus:', error);
      next(error);
    }
  }
}

export default new StripeController();