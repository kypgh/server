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

  /**
   * Delete Stripe Connect account for the authenticated brand
   */
  async deleteConnectAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
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
            code: 'STRIPE_004',
            message: 'No Stripe account to delete'
          }
        });
        return;
      }

      // Delete the Stripe account
      const deleteResult = await stripeService.deleteConnectAccount(brand.stripeConnectAccountId);

      // Clear the Stripe account info from brand
      await Brand.findByIdAndUpdate(brandId, {
        stripeConnectAccountId: null,
        stripeOnboardingComplete: false,
      });

      res.status(200).json({
        success: true,
        data: {
          deleted: deleteResult.deleted,
          accountId: deleteResult.accountId,
          message: 'Stripe Connect account deleted successfully'
        }
      });
    } catch (error) {
      console.error('Error in deleteConnectAccount:', error);
      
      // Handle specific Stripe errors
      if (error.message.includes('No such account')) {
        // Account doesn't exist in Stripe, just clear from database
        await Brand.findByIdAndUpdate(req.user?.id, {
          stripeConnectAccountId: null,
          stripeOnboardingComplete: false,
        });
        
        res.status(200).json({
          success: true,
          data: {
            deleted: true,
            message: 'Account reference cleared (account not found in Stripe)'
          }
        });
        return;
      }
      
      next(error);
    }
  }

  /**
   * Handle Stripe onboarding success callback
   */
  async onboardingSuccess(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Get the account ID from query parameters (Stripe should include this)
      const accountId = req.query.account as string;
      
      if (!accountId) {
        console.error('No account ID provided in success callback');
        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard?stripe_error=missing_account`);
      }

      // Find the brand with this Stripe account ID
      const brand = await Brand.findOne({ stripeConnectAccountId: accountId });
      
      if (!brand) {
        console.error('No brand found for Stripe account:', accountId);
        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard?stripe_error=brand_not_found`);
      }

      // Verify the onboarding status with Stripe
      const accountStatus = await stripeService.getAccountStatus(accountId);
      
      // Update the brand's onboarding status
      await Brand.findByIdAndUpdate(brand._id, {
        stripeOnboardingComplete: accountStatus.onboardingComplete,
      });

      // Redirect to frontend with success status
      const redirectUrl = accountStatus.onboardingComplete 
        ? `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard?stripe_success=true`
        : `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard?stripe_success=false&requires_action=true`;

      res.redirect(redirectUrl);
      
    } catch (error) {
      console.error('Error in onboardingSuccess:', error);
      // Redirect to frontend with error
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard?stripe_error=callback_failed`);
    }
  }
}

export default new StripeController();