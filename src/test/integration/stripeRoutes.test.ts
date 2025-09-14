import request from 'supertest';
import { app } from '../../app';
import { Brand } from '../../models/Brand';
import JwtUtils from '../../utils/jwt';
import stripeService from '../../services/stripeService';
import { connectTestDatabase, clearTestDatabase, closeTestDatabase } from '../setup';

// Mock Stripe service
jest.mock('../../services/stripeService');
const mockStripeService = stripeService as jest.Mocked<typeof stripeService>;

describe('Stripe Routes Integration Tests', () => {
  let brandToken: string;
  let brandId: string;

  beforeAll(async () => {
    await connectTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();
    
    // Create test brand
    const brand = new Brand({
      name: 'Test Fitness Studio',
      email: 'test@brand.com',
      password: 'hashedPassword123',
      address: {
        street: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        country: 'US'
      },
      contact: {
        phone: '+1234567890'
      },
      businessHours: [
        {
          day: 'monday',
          openTime: '09:00',
          closeTime: '17:00',
          isClosed: false
        }
      ]
    });
    
    const savedBrand = await brand.save();
    brandId = savedBrand._id.toString();
    brandToken = JwtUtils.generateAccessToken({ 
      id: brandId, 
      type: 'brand', 
      email: 'test@brand.com' 
    });
    
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  describe('POST /api/brand/stripe/connect', () => {
    it('should create new Stripe Connect account successfully', async () => {
      const mockConnectResponse = {
        accountId: 'acct_test123',
        onboardingUrl: 'https://connect.stripe.com/setup/test123',
      };

      mockStripeService.createConnectAccount.mockResolvedValue(mockConnectResponse);

      const response = await request(app)
        .post('/api/brand/stripe/connect')
        .set('Authorization', `Bearer ${brandToken}`)
        .expect(201);

      expect(response.body).toEqual({
        success: true,
        data: {
          accountId: 'acct_test123',
          onboardingUrl: 'https://connect.stripe.com/setup/test123',
          onboardingComplete: false,
          message: 'Stripe Connect account created successfully'
        }
      });

      expect(mockStripeService.createConnectAccount).toHaveBeenCalledWith(
        brandId,
        'test@brand.com',
        'Test Fitness Studio'
      );
    });

    it('should return existing account when already connected and complete', async () => {
      // Update brand with existing Stripe account
      await Brand.findByIdAndUpdate(brandId, {
        stripeConnectAccountId: 'acct_existing123',
        stripeOnboardingComplete: true
      });

      const mockAccountStatus = {
        accountId: 'acct_existing123',
        onboardingComplete: true,
        chargesEnabled: true,
        payoutsEnabled: true,
        detailsSubmitted: true,
        requiresAction: false,
      };

      mockStripeService.getAccountStatus.mockResolvedValue(mockAccountStatus);

      const response = await request(app)
        .post('/api/brand/stripe/connect')
        .set('Authorization', `Bearer ${brandToken}`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          accountId: 'acct_existing123',
          onboardingComplete: true,
          message: 'Stripe account already connected and onboarding complete'
        }
      });
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .post('/api/brand/stripe/connect')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTH_001');
    });

    it('should return 500 when Stripe service fails', async () => {
      mockStripeService.createConnectAccount.mockRejectedValue(
        new Error('Failed to create Stripe Connect account')
      );

      const response = await request(app)
        .post('/api/brand/stripe/connect')
        .set('Authorization', `Bearer ${brandToken}`)
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/brand/stripe/account-status', () => {
    it('should return account status when account exists', async () => {
      // Update brand with Stripe account
      await Brand.findByIdAndUpdate(brandId, {
        stripeConnectAccountId: 'acct_test123',
        stripeOnboardingComplete: false
      });

      const mockAccountStatus = {
        accountId: 'acct_test123',
        onboardingComplete: true,
        chargesEnabled: true,
        payoutsEnabled: true,
        detailsSubmitted: true,
        requiresAction: false,
      };

      mockStripeService.getAccountStatus.mockResolvedValue(mockAccountStatus);
      mockStripeService.updateBrandOnboardingStatus.mockResolvedValue();

      const response = await request(app)
        .get('/api/brand/stripe/account-status')
        .set('Authorization', `Bearer ${brandToken}`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockAccountStatus
      });

      expect(mockStripeService.getAccountStatus).toHaveBeenCalledWith('acct_test123');
      expect(mockStripeService.updateBrandOnboardingStatus).toHaveBeenCalledWith(
        brandId,
        'acct_test123'
      );
    });

    it('should return no account message when no Stripe account', async () => {
      const response = await request(app)
        .get('/api/brand/stripe/account-status')
        .set('Authorization', `Bearer ${brandToken}`)
        .expect(200);

      expect(response.body).toEqual({
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

    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .get('/api/brand/stripe/account-status')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTH_001');
    });
  });

  describe('POST /api/brand/stripe/refresh-status', () => {
    it('should refresh onboarding status successfully', async () => {
      // Update brand with Stripe account
      await Brand.findByIdAndUpdate(brandId, {
        stripeConnectAccountId: 'acct_test123',
        stripeOnboardingComplete: false
      });

      const mockAccountStatus = {
        accountId: 'acct_test123',
        onboardingComplete: true,
        chargesEnabled: true,
        payoutsEnabled: true,
        detailsSubmitted: true,
        requiresAction: false,
      };

      mockStripeService.updateBrandOnboardingStatus.mockResolvedValue();
      mockStripeService.getAccountStatus.mockResolvedValue(mockAccountStatus);

      const response = await request(app)
        .post('/api/brand/stripe/refresh-status')
        .set('Authorization', `Bearer ${brandToken}`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          ...mockAccountStatus,
          message: 'Onboarding status refreshed successfully'
        }
      });

      expect(mockStripeService.updateBrandOnboardingStatus).toHaveBeenCalledWith(
        brandId,
        'acct_test123'
      );
    });

    it('should return 404 when no Stripe account exists', async () => {
      const response = await request(app)
        .post('/api/brand/stripe/refresh-status')
        .set('Authorization', `Bearer ${brandToken}`)
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'STRIPE_003',
          message: 'Stripe account not found'
        }
      });
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .post('/api/brand/stripe/refresh-status')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTH_001');
    });
  });
});