// Mock Stripe before importing the service
const mockAccounts = {
  create: jest.fn(),
  retrieve: jest.fn(),
};

const mockAccountLinks = {
  create: jest.fn(),
};

const mockPaymentIntents = {
  create: jest.fn(),
};

const mockStripeInstance = {
  accounts: mockAccounts,
  accountLinks: mockAccountLinks,
  paymentIntents: mockPaymentIntents,
};

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => mockStripeInstance);
});

// Mock Brand model
jest.mock('../../../models/Brand');

// Mock config
jest.mock('../../../config/environment', () => ({
  stripe: {
    secretKey: 'sk_test_mock_key',
    webhookSecret: 'whsec_mock_secret'
  }
}));

import stripeService, { StripeAccountStatus, StripeConnectResponse } from '../../../services/stripeService';
import { Brand } from '../../../models/Brand';

const MockedBrand = Brand as jest.Mocked<typeof Brand>;

describe('StripeService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createConnectAccount', () => {
    const mockBrandId = '507f1f77bcf86cd799439011';
    const mockEmail = 'test@brand.com';
    const mockBusinessName = 'Test Fitness Studio';

    it('should create a Stripe Connect account successfully', async () => {
      const mockAccount = {
        id: 'acct_test123',
        type: 'express',
        email: mockEmail,
      };
      
      const mockAccountLink = {
        url: 'https://connect.stripe.com/setup/test123',
      };

      mockAccounts.create.mockResolvedValue(mockAccount as any);
      mockAccountLinks.create.mockResolvedValue(mockAccountLink as any);
      MockedBrand.findByIdAndUpdate = jest.fn().mockResolvedValue({});

      const result: StripeConnectResponse = await stripeService.createConnectAccount(
        mockBrandId,
        mockEmail,
        mockBusinessName
      );

      expect(mockAccounts.create).toHaveBeenCalledWith({
        type: 'express',
        country: 'US',
        email: mockEmail,
        business_type: 'company',
        company: {
          name: mockBusinessName,
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

      expect(MockedBrand.findByIdAndUpdate).toHaveBeenCalledWith(mockBrandId, {
        stripeConnectAccountId: mockAccount.id,
        stripeOnboardingComplete: false,
      });

      expect(mockAccountLinks.create).toHaveBeenCalledWith({
        account: mockAccount.id,
        refresh_url: 'http://localhost:3000/brand/stripe/refresh',
        return_url: 'http://localhost:3000/brand/stripe/success',
        type: 'account_onboarding',
      });

      expect(result).toEqual({
        accountId: mockAccount.id,
        onboardingUrl: mockAccountLink.url,
      });
    });

    it('should throw error when Stripe account creation fails', async () => {
      mockAccounts.create.mockRejectedValue(new Error('Stripe API error'));

      await expect(
        stripeService.createConnectAccount(mockBrandId, mockEmail, mockBusinessName)
      ).rejects.toThrow('Failed to create Stripe Connect account');
    });
  });

  describe('getAccountStatus', () => {
    const mockAccountId = 'acct_test123';

    it('should return complete account status when onboarding is complete', async () => {
      const mockAccount = {
        id: mockAccountId,
        details_submitted: true,
        charges_enabled: true,
        payouts_enabled: true,
      };

      mockAccounts.retrieve.mockResolvedValue(mockAccount as any);

      const result: StripeAccountStatus = await stripeService.getAccountStatus(mockAccountId);

      expect(mockAccounts.retrieve).toHaveBeenCalledWith(mockAccountId);
      expect(result).toEqual({
        accountId: mockAccountId,
        onboardingComplete: true,
        chargesEnabled: true,
        payoutsEnabled: true,
        detailsSubmitted: true,
        requiresAction: false,
      });
    });

    it('should return incomplete status with action URL when onboarding is incomplete', async () => {
      const mockAccount = {
        id: mockAccountId,
        details_submitted: false,
        charges_enabled: false,
        payouts_enabled: false,
      };

      const mockAccountLink = {
        url: 'https://connect.stripe.com/setup/test123',
      };

      mockAccounts.retrieve.mockResolvedValue(mockAccount as any);
      mockAccountLinks.create.mockResolvedValue(mockAccountLink as any);

      const result: StripeAccountStatus = await stripeService.getAccountStatus(mockAccountId);

      expect(result).toEqual({
        accountId: mockAccountId,
        onboardingComplete: false,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
        requiresAction: true,
        actionUrl: mockAccountLink.url,
      });
    });

    it('should throw error when account retrieval fails', async () => {
      mockAccounts.retrieve.mockRejectedValue(new Error('Account not found'));

      await expect(
        stripeService.getAccountStatus(mockAccountId)
      ).rejects.toThrow('Failed to retrieve Stripe account status');
    });
  });

  describe('updateBrandOnboardingStatus', () => {
    const mockBrandId = '507f1f77bcf86cd799439011';
    const mockAccountId = 'acct_test123';

    it('should update brand onboarding status successfully', async () => {
      const mockAccount = {
        id: mockAccountId,
        details_submitted: true,
        charges_enabled: true,
        payouts_enabled: true,
      };

      mockAccounts.retrieve.mockResolvedValue(mockAccount as any);
      MockedBrand.findByIdAndUpdate = jest.fn().mockResolvedValue({});

      await stripeService.updateBrandOnboardingStatus(mockBrandId, mockAccountId);

      expect(MockedBrand.findByIdAndUpdate).toHaveBeenCalledWith(mockBrandId, {
        stripeOnboardingComplete: true,
      });
    });
  });

  describe('validatePaymentCapability', () => {
    const mockAccountId = 'acct_test123';

    it('should return true when account can process payments', async () => {
      const mockAccount = {
        id: mockAccountId,
        charges_enabled: true,
        details_submitted: true,
      };

      mockAccounts.retrieve.mockResolvedValue(mockAccount as any);

      const result = await stripeService.validatePaymentCapability(mockAccountId);

      expect(result).toBe(true);
    });

    it('should return false when account cannot process payments', async () => {
      const mockAccount = {
        id: mockAccountId,
        charges_enabled: false,
        details_submitted: false,
      };

      mockAccounts.retrieve.mockResolvedValue(mockAccount as any);

      const result = await stripeService.validatePaymentCapability(mockAccountId);

      expect(result).toBe(false);
    });

    it('should return false when account retrieval fails', async () => {
      mockAccounts.retrieve.mockRejectedValue(new Error('Account not found'));

      const result = await stripeService.validatePaymentCapability(mockAccountId);

      expect(result).toBe(false);
    });
  });

  describe('createPaymentIntent', () => {
    const mockAmount = 2000;
    const mockCurrency = 'usd';
    const mockConnectedAccountId = 'acct_test123';
    const mockMetadata = { brandId: '507f1f77bcf86cd799439011' };

    it('should create payment intent successfully', async () => {
      const mockPaymentIntent = {
        id: 'pi_test123',
        amount: mockAmount,
        currency: mockCurrency,
        status: 'requires_payment_method',
      };

      mockPaymentIntents.create.mockResolvedValue(mockPaymentIntent as any);

      const result = await stripeService.createPaymentIntent(
        mockAmount,
        mockCurrency,
        mockConnectedAccountId,
        mockMetadata
      );

      expect(mockPaymentIntents.create).toHaveBeenCalledWith({
        amount: mockAmount,
        currency: mockCurrency,
        metadata: mockMetadata,
        transfer_data: {
          destination: mockConnectedAccountId,
        },
      });

      expect(result).toEqual(mockPaymentIntent);
    });

    it('should throw error when payment intent creation fails', async () => {
      mockPaymentIntents.create.mockRejectedValue(new Error('Payment intent creation failed'));

      await expect(
        stripeService.createPaymentIntent(mockAmount, mockCurrency, mockConnectedAccountId)
      ).rejects.toThrow('Failed to create payment intent');
    });
  });

  describe('getStripeInstance', () => {
    it('should return Stripe instance', () => {
      const instance = stripeService.getStripeInstance();
      expect(instance).toBe(mockStripeInstance);
    });
  });
});