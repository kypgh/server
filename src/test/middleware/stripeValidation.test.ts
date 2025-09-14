import { Request, Response, NextFunction } from 'express';
import { validateStripeAccount, checkStripeAccount } from '../../middleware/stripeValidation';
import { Brand } from '../../models/Brand';
import stripeService from '../../services/stripeService';
import { AuthenticatedRequest } from '../../middleware/auth';

// Mock dependencies
jest.mock('../../models/Brand');
jest.mock('../../services/stripeService');

const MockedBrand = Brand as jest.Mocked<typeof Brand>;
const mockStripeService = stripeService as jest.Mocked<typeof stripeService>;

describe('Stripe Validation Middleware', () => {
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

  describe('validateStripeAccount', () => {
    const mockBrand = {
      _id: '507f1f77bcf86cd799439011',
      name: 'Test Fitness Studio',
      email: 'test@brand.com',
      stripeConnectAccountId: 'acct_test123',
      stripeOnboardingComplete: true,
    };

    it('should pass validation when brand has valid Stripe account', async () => {
      MockedBrand.findById = jest.fn().mockResolvedValue(mockBrand);
      mockStripeService.validatePaymentCapability.mockResolvedValue(true);

      await validateStripeAccount(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(MockedBrand.findById).toHaveBeenCalledWith(mockReq.user?.id);
      expect(mockStripeService.validatePaymentCapability).toHaveBeenCalledWith('acct_test123');
      expect(mockReq.stripeAccountId).toBe('acct_test123');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 401 when user is not authenticated', async () => {
      mockReq.user = undefined;

      await validateStripeAccount(
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
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 404 when brand is not found', async () => {
      MockedBrand.findById = jest.fn().mockResolvedValue(null);

      await validateStripeAccount(
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
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 400 when brand has no Stripe account', async () => {
      const mockBrandNoStripe = {
        ...mockBrand,
        stripeConnectAccountId: null,
      };

      MockedBrand.findById = jest.fn().mockResolvedValue(mockBrandNoStripe);

      await validateStripeAccount(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
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
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 400 when Stripe account cannot process payments', async () => {
      MockedBrand.findById = jest.fn().mockResolvedValue(mockBrand);
      mockStripeService.validatePaymentCapability.mockResolvedValue(false);

      await validateStripeAccount(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
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
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 500 when validation throws error', async () => {
      MockedBrand.findById = jest.fn().mockRejectedValue(new Error('Database error'));

      await validateStripeAccount(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'STRIPE_004',
          message: 'Error validating Stripe account'
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('checkStripeAccount', () => {
    const mockBrand = {
      _id: '507f1f77bcf86cd799439011',
      name: 'Test Fitness Studio',
      email: 'test@brand.com',
      stripeConnectAccountId: 'acct_test123',
      stripeOnboardingComplete: true,
    };

    it('should add Stripe account info to request when account is valid', async () => {
      MockedBrand.findById = jest.fn().mockResolvedValue(mockBrand);
      mockStripeService.validatePaymentCapability.mockResolvedValue(true);

      await checkStripeAccount(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockReq.stripeAccountId).toBe('acct_test123');
      expect(mockReq.stripeAccountActive).toBe(true);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should add inactive status when account cannot process payments', async () => {
      MockedBrand.findById = jest.fn().mockResolvedValue(mockBrand);
      mockStripeService.validatePaymentCapability.mockResolvedValue(false);

      await checkStripeAccount(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockReq.stripeAccountId).toBe('acct_test123');
      expect(mockReq.stripeAccountActive).toBe(false);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should continue without Stripe info when user is not authenticated', async () => {
      mockReq.user = undefined;

      await checkStripeAccount(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockReq.stripeAccountId).toBeUndefined();
      expect(mockReq.stripeAccountActive).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should continue without Stripe info when brand has no account', async () => {
      const mockBrandNoStripe = {
        ...mockBrand,
        stripeConnectAccountId: null,
      };

      MockedBrand.findById = jest.fn().mockResolvedValue(mockBrandNoStripe);

      await checkStripeAccount(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockReq.stripeAccountId).toBeUndefined();
      expect(mockReq.stripeAccountActive).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should continue without Stripe info when error occurs', async () => {
      MockedBrand.findById = jest.fn().mockRejectedValue(new Error('Database error'));

      await checkStripeAccount(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockReq.stripeAccountId).toBeUndefined();
      expect(mockReq.stripeAccountActive).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });
  });
});