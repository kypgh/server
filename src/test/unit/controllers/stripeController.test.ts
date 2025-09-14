import { Request, Response, NextFunction } from 'express';
import stripeController from '../../../controllers/stripeController';
import stripeService from '../../../services/stripeService';
import { Brand } from '../../../models/Brand';
import { AuthenticatedRequest } from '../../../middleware/auth';

// Mock dependencies
jest.mock('../../../services/stripeService');
jest.mock('../../../models/Brand');

const mockStripeService = stripeService as jest.Mocked<typeof stripeService>;
const MockedBrand = Brand as jest.Mocked<typeof Brand>;

describe('StripeController', () => {
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockReq = {
      user: {
        id: '507f1f77bcf86cd799439011',
        type: 'brand',
        email: 'test@brand.com'
      }
    };
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    
    mockNext = jest.fn();
  });

  describe('connectAccount', () => {
    const mockBrand = {
      _id: '507f1f77bcf86cd799439011',
      name: 'Test Fitness Studio',
      email: 'test@brand.com',
      stripeConnectAccountId: null,
      stripeOnboardingComplete: false,
    };

    it('should create new Stripe Connect account successfully', async () => {
      const mockConnectResponse = {
        accountId: 'acct_test123',
        onboardingUrl: 'https://connect.stripe.com/setup/test123',
      };

      MockedBrand.findById = jest.fn().mockResolvedValue(mockBrand);
      mockStripeService.createConnectAccount.mockResolvedValue(mockConnectResponse);

      await stripeController.connectAccount(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(MockedBrand.findById).toHaveBeenCalledWith(mockReq.user?.id);
      expect(mockStripeService.createConnectAccount).toHaveBeenCalledWith(
        mockReq.user?.id,
        mockBrand.email,
        mockBrand.name
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          accountId: mockConnectResponse.accountId,
          onboardingUrl: mockConnectResponse.onboardingUrl,
          onboardingComplete: false,
          message: 'Stripe Connect account created successfully'
        }
      });
    });

    it('should return existing account status when account already exists and is complete', async () => {
      const mockBrandWithStripe = {
        ...mockBrand,
        stripeConnectAccountId: 'acct_existing123',
      };

      const mockAccountStatus = {
        accountId: 'acct_existing123',
        onboardingComplete: true,
        chargesEnabled: true,
        payoutsEnabled: true,
        detailsSubmitted: true,
        requiresAction: false,
      };

      MockedBrand.findById = jest.fn().mockResolvedValue(mockBrandWithStripe);
      mockStripeService.getAccountStatus.mockResolvedValue(mockAccountStatus);

      await stripeController.connectAccount(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockStripeService.getAccountStatus).toHaveBeenCalledWith('acct_existing123');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          accountId: 'acct_existing123',
          onboardingComplete: true,
          message: 'Stripe account already connected and onboarding complete'
        }
      });
    });

    it('should return onboarding URL when account exists but onboarding incomplete', async () => {
      const mockBrandWithStripe = {
        ...mockBrand,
        stripeConnectAccountId: 'acct_existing123',
      };

      const mockAccountStatus = {
        accountId: 'acct_existing123',
        onboardingComplete: false,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
        requiresAction: true,
        actionUrl: 'https://connect.stripe.com/setup/existing123',
      };

      MockedBrand.findById = jest.fn().mockResolvedValue(mockBrandWithStripe);
      mockStripeService.getAccountStatus.mockResolvedValue(mockAccountStatus);

      await stripeController.connectAccount(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          accountId: 'acct_existing123',
          onboardingComplete: false,
          onboardingUrl: 'https://connect.stripe.com/setup/existing123',
          message: 'Stripe account exists but onboarding incomplete'
        }
      });
    });

    it('should return 401 when user is not authenticated', async () => {
      mockReq.user = undefined;

      await stripeController.connectAccount(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTH_003',
          message: 'Unauthorized access'
        }
      });
    });

    it('should return 404 when brand is not found', async () => {
      MockedBrand.findById = jest.fn().mockResolvedValue(null);

      await stripeController.connectAccount(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'BRAND_001',
          message: 'Brand not found'
        }
      });
    });

    it('should call next with error when service throws', async () => {
      const mockError = new Error('Service error');
      MockedBrand.findById = jest.fn().mockResolvedValue(mockBrand);
      mockStripeService.createConnectAccount.mockRejectedValue(mockError);

      await stripeController.connectAccount(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(mockError);
    });
  });

  describe('getAccountStatus', () => {
    const mockBrand = {
      _id: '507f1f77bcf86cd799439011',
      name: 'Test Fitness Studio',
      email: 'test@brand.com',
      stripeConnectAccountId: 'acct_test123',
      stripeOnboardingComplete: false,
    };

    it('should return account status successfully', async () => {
      const mockAccountStatus = {
        accountId: 'acct_test123',
        onboardingComplete: true,
        chargesEnabled: true,
        payoutsEnabled: true,
        detailsSubmitted: true,
        requiresAction: false,
      };

      MockedBrand.findById = jest.fn().mockResolvedValue(mockBrand);
      mockStripeService.getAccountStatus.mockResolvedValue(mockAccountStatus);
      mockStripeService.updateBrandOnboardingStatus.mockResolvedValue();

      await stripeController.getAccountStatus(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockStripeService.getAccountStatus).toHaveBeenCalledWith('acct_test123');
      expect(mockStripeService.updateBrandOnboardingStatus).toHaveBeenCalledWith(
        mockReq.user?.id,
        'acct_test123'
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockAccountStatus
      });
    });

    it('should return no account message when brand has no Stripe account', async () => {
      const mockBrandNoStripe = {
        ...mockBrand,
        stripeConnectAccountId: null,
      };

      MockedBrand.findById = jest.fn().mockResolvedValue(mockBrandNoStripe);

      await stripeController.getAccountStatus(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
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
    });
  });

  describe('refreshOnboardingStatus', () => {
    const mockBrand = {
      _id: '507f1f77bcf86cd799439011',
      name: 'Test Fitness Studio',
      email: 'test@brand.com',
      stripeConnectAccountId: 'acct_test123',
      stripeOnboardingComplete: false,
    };

    it('should refresh onboarding status successfully', async () => {
      const mockAccountStatus = {
        accountId: 'acct_test123',
        onboardingComplete: true,
        chargesEnabled: true,
        payoutsEnabled: true,
        detailsSubmitted: true,
        requiresAction: false,
      };

      MockedBrand.findById = jest.fn().mockResolvedValue(mockBrand);
      mockStripeService.updateBrandOnboardingStatus.mockResolvedValue();
      mockStripeService.getAccountStatus.mockResolvedValue(mockAccountStatus);

      await stripeController.refreshOnboardingStatus(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockStripeService.updateBrandOnboardingStatus).toHaveBeenCalledWith(
        mockReq.user?.id,
        'acct_test123'
      );
      expect(mockStripeService.getAccountStatus).toHaveBeenCalledWith('acct_test123');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          ...mockAccountStatus,
          message: 'Onboarding status refreshed successfully'
        }
      });
    });

    it('should return 404 when brand has no Stripe account', async () => {
      const mockBrandNoStripe = {
        ...mockBrand,
        stripeConnectAccountId: null,
      };

      MockedBrand.findById = jest.fn().mockResolvedValue(mockBrandNoStripe);

      await stripeController.refreshOnboardingStatus(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'STRIPE_003',
          message: 'Stripe account not found'
        }
      });
    });
  });
});