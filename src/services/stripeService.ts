import Stripe from 'stripe';
import config from '../config/environment';
import { Brand } from '../models/Brand';

export interface StripeAccountStatus {
  accountId: string | null;
  onboardingComplete: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requiresAction: boolean;
  actionUrl?: string;
}

export interface StripeConnectResponse {
  accountId: string;
  onboardingUrl: string;
}

class StripeService {
  private stripe: Stripe;

  constructor() {
    if (!config.stripe.secretKey) {
      throw new Error('Stripe secret key is required');
    }
    
    this.stripe = new Stripe(config.stripe.secretKey, {
      apiVersion: '2023-10-16',
    });
  }

  /**
   * Create a Stripe Connect account for a brand
   */
  async createConnectAccount(brandId: string, email: string, businessName: string): Promise<StripeConnectResponse> {
    try {
      // Create Stripe Connect account
      const account = await this.stripe.accounts.create({
        type: 'express',
        country: 'US',
        email: email,
        business_type: 'company',
        company: {
          name: businessName,
        },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        settings: {
          payouts: {
            schedule: {
              interval: 'daily',
            },
          },
        },
      });

      // Update brand with Stripe account ID
      await Brand.findByIdAndUpdate(brandId, {
        stripeConnectAccountId: account.id,
        stripeOnboardingComplete: false,
      });

      // Create onboarding link
      const accountLink = await this.stripe.accountLinks.create({
        account: account.id,
        refresh_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/brand/stripe/refresh`,
        return_url: `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/brand/stripe/success?account=${account.id}`,
        type: 'account_onboarding',
      });

      return {
        accountId: account.id,
        onboardingUrl: accountLink.url,
      };
    } catch (error) {
      console.error('Error creating Stripe Connect account:', error);
      throw new Error('Failed to create Stripe Connect account');
    }
  }

  /**
   * Get Stripe account status and onboarding information
   */
  async getAccountStatus(accountId: string): Promise<StripeAccountStatus> {
    try {
      const account = await this.stripe.accounts.retrieve(accountId);

      const status: StripeAccountStatus = {
        accountId: account.id,
        onboardingComplete: account.details_submitted && account.charges_enabled,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted,
        requiresAction: false,
      };

      // Check if account requires additional action
      if (!account.details_submitted || !account.charges_enabled) {
        status.requiresAction = true;
        
        // Create new onboarding link if needed
        const accountLink = await this.stripe.accountLinks.create({
          account: account.id,
          refresh_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/brand/stripe/refresh`,
          return_url: `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/brand/stripe/success?account=${account.id}`,
          type: 'account_onboarding',
        });
        
        status.actionUrl = accountLink.url;
      }

      return status;
    } catch (error) {
      console.error('Error retrieving Stripe account status:', error);
      throw new Error('Failed to retrieve Stripe account status');
    }
  }

  /**
   * Update brand onboarding status based on Stripe account
   */
  async updateBrandOnboardingStatus(brandId: string, accountId: string): Promise<void> {
    try {
      const accountStatus = await this.getAccountStatus(accountId);
      
      await Brand.findByIdAndUpdate(brandId, {
        stripeOnboardingComplete: accountStatus.onboardingComplete,
      });
    } catch (error) {
      console.error('Error updating brand onboarding status:', error);
      throw new Error('Failed to update brand onboarding status');
    }
  }

  /**
   * Validate if a brand can process payments
   */
  async validatePaymentCapability(accountId: string): Promise<boolean> {
    try {
      const account = await this.stripe.accounts.retrieve(accountId);
      return account.charges_enabled && account.details_submitted;
    } catch (error) {
      console.error('Error validating payment capability:', error);
      return false;
    }
  }

  /**
   * Create a payment intent on behalf of a connected account
   */
  async createPaymentIntent(
    amount: number,
    currency: string,
    connectedAccountId: string,
    metadata?: Record<string, string>
  ): Promise<Stripe.PaymentIntent> {
    try {
      return await this.stripe.paymentIntents.create({
        amount,
        currency,
        metadata,
        transfer_data: {
          destination: connectedAccountId,
        },
      });
    } catch (error) {
      console.error('Error creating payment intent:', error);
      throw new Error('Failed to create payment intent');
    }
  }

  /**
   * Get Stripe instance for direct access (for advanced operations)
   */
  getStripeInstance(): Stripe {
    return this.stripe;
  }
}

export default new StripeService();