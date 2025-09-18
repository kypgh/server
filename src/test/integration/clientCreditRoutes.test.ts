import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import App from '../../app';
import { Brand } from '../../models/Brand';
import { Client } from '../../models/Client';
import { CreditPlan } from '../../models/CreditPlan';
import { CreditBalance } from '../../models/CreditBalance';
import JwtUtils from '../../utils/jwt';
import stripeService from '../../services/stripeService';
import paymentService from '../../services/paymentService';

describe('Client Credit Routes', () => {
  let app: App;
  let mongoServer: MongoMemoryServer;
  let testBrand: any;
  let testClient: any;
  let testCreditPlan: any;
  let clientToken: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
    
    app = new App();
  });

  afterAll(async () => {
    // Restore mocks
    jest.restoreAllMocks();
    
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Mock Stripe service for tests
    jest.spyOn(stripeService, 'validatePaymentCapability').mockResolvedValue(true);
    
    // Mock payment service for tests
    jest.spyOn(paymentService, 'createCreditPaymentIntent').mockResolvedValue({
      paymentIntentId: 'pi_test123',
      clientSecret: 'pi_test123_secret',
      amount: 10000,
      currency: 'USD',
      status: 'requires_payment_method'
    });

    // Clear all collections
    await Promise.all([
      Brand.deleteMany({}),
      Client.deleteMany({}),
      CreditPlan.deleteMany({}),
      CreditBalance.deleteMany({})
    ]);

    // Create test brand
    testBrand = await Brand.create({
      name: 'Test Fitness Studio',
      email: 'brand@test.com',
      password: 'hashedPassword',
      address: {
        street: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        country: 'Test Country'
      },
      contact: {
        phone: '+1234567890',
        email: 'contact@studio.com'
      },
      businessHours: [{
        day: 'monday',
        openTime: '06:00',
        closeTime: '22:00',
        isOpen: true
      }],
      stripeConnectAccountId: 'acct_test123',
      stripeOnboardingComplete: true
    });

    // Create test client
    testClient = await Client.create({
      email: 'client@test.com',
      password: 'hashedPassword',
      firstName: 'Test',
      lastName: 'Client',
      preferences: {
        notifications: {
          email: true,
          sms: false,
          push: true
        },
        privacy: {
          profileVisibility: 'public',
          shareData: false
        }
      }
    });

    // Create test credit plan
    testCreditPlan = await CreditPlan.create({
      brand: testBrand._id,
      name: '10 Credit Package',
      description: 'Basic credit package',
      price: 10000,
      creditAmount: 10,
      validityPeriod: 30,
      bonusCredits: 2,
      includedClasses: [],
      status: 'active'
    });

    // Generate client token
    const jwtPayload = {
      id: testClient._id.toString(),
      type: 'client' as const,
      email: testClient.email
    };
    const tokens = JwtUtils.generateTokenPair(jwtPayload);
    clientToken = tokens.accessToken;
  });

  describe('POST /api/client/credits/purchase', () => {
    it('should create payment intent for credit plan purchase', async () => {
      const response = await request(app.getApp())
        .post('/api/client/credits/purchase')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          creditPlanId: testCreditPlan._id.toString(),
          paymentMethodId: 'pm_test123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.paymentIntent).toBeDefined();
      expect(response.body.data.paymentIntent.paymentIntentId).toBeDefined();
      expect(response.body.data.paymentIntent.clientSecret).toBeDefined();
      expect(response.body.data.creditPlan).toBeDefined();
      expect(response.body.data.creditPlan.totalCredits).toBe(12); // 10 + 2 bonus
    });

    it('should return 400 for invalid credit plan ID', async () => {
      const response = await request(app.getApp())
        .post('/api/client/credits/purchase')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          creditPlanId: 'invalid-id',
          paymentMethodId: 'pm_test123'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_001');
    });

    it('should return 404 for non-existent credit plan', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      
      const response = await request(app.getApp())
        .post('/api/client/credits/purchase')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          creditPlanId: fakeId,
          paymentMethodId: 'pm_test123'
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PLAN_001');
    });

    it('should return 400 for inactive credit plan', async () => {
      testCreditPlan.status = 'inactive';
      await testCreditPlan.save();

      const response = await request(app.getApp())
        .post('/api/client/credits/purchase')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          creditPlanId: testCreditPlan._id.toString(),
          paymentMethodId: 'pm_test123'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PLAN_002');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app.getApp())
        .post('/api/client/credits/purchase')
        .send({
          creditPlanId: testCreditPlan._id.toString(),
          paymentMethodId: 'pm_test123'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/client/credits/balances', () => {
    beforeEach(async () => {
      // Create credit balance for testing
      const creditBalance = new CreditBalance({
        client: testClient._id,
        brand: testBrand._id,
        availableCredits: 15,
        totalCreditsEarned: 20,
        totalCreditsUsed: 5,
        creditPackages: [{
          creditPlan: testCreditPlan._id,
          purchaseDate: new Date(),
          expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          originalCredits: 12,
          creditsRemaining: 10,
          status: 'active'
        }],
        transactions: [],
        status: 'active'
      });
      await creditBalance.save();
    });

    it('should return all credit balances for client', async () => {
      const response = await request(app.getApp())
        .get('/api/client/credits/balances')
        .set('Authorization', `Bearer ${clientToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.creditBalances).toBeDefined();
      expect(response.body.data.creditBalances).toHaveLength(1);
      expect(response.body.data.creditBalances[0].availableCredits).toBe(15);
    });

    it('should return specific brand credit balance', async () => {
      const response = await request(app.getApp())
        .get('/api/client/credits/balances')
        .query({ brandId: testBrand._id.toString() })
        .set('Authorization', `Bearer ${clientToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.creditBalance).toBeDefined();
      expect(response.body.data.creditBalance.availableCredits).toBe(15);
      expect(response.body.data.creditBalance.totalCreditsEarned).toBe(20);
      expect(response.body.data.creditBalance.totalCreditsUsed).toBe(5);
    });

    it('should return 400 for invalid brand ID format', async () => {
      const response = await request(app.getApp())
        .get('/api/client/credits/balances')
        .query({ brandId: 'invalid-id' })
        .set('Authorization', `Bearer ${clientToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_001');
    });

    it('should return 404 for non-existent brand balance', async () => {
      const fakeBrandId = new mongoose.Types.ObjectId().toString();
      
      const response = await request(app.getApp())
        .get('/api/client/credits/balances')
        .query({ brandId: fakeBrandId })
        .set('Authorization', `Bearer ${clientToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('CREDIT_001');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app.getApp())
        .get('/api/client/credits/balances');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/client/credits/balances/:brandId/transactions', () => {
    beforeEach(async () => {
      // Create credit balance with transactions
      const creditBalance = new CreditBalance({
        client: testClient._id,
        brand: testBrand._id,
        availableCredits: 10,
        totalCreditsEarned: 15,
        totalCreditsUsed: 5,
        creditPackages: [],
        transactions: [
          {
            type: 'purchase',
            amount: 15,
            description: 'Purchased 10 Credit Package - 15 credits',
            timestamp: new Date('2024-01-01')
          },
          {
            type: 'deduction',
            amount: 5,
            description: 'Used 5 credits for booking',
            timestamp: new Date('2024-01-02')
          }
        ],
        status: 'active'
      });
      await creditBalance.save();
    });

    it('should return credit transaction history', async () => {
      const response = await request(app.getApp())
        .get(`/api/client/credits/balances/${testBrand._id}/transactions`)
        .set('Authorization', `Bearer ${clientToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.transactions).toBeDefined();
      expect(response.body.data.transactions).toHaveLength(2);
      expect(response.body.data.transactions[0].type).toBe('deduction'); // Newest first
      expect(response.body.data.transactions[1].type).toBe('purchase');
    });

    it('should support pagination', async () => {
      const response = await request(app.getApp())
        .get(`/api/client/credits/balances/${testBrand._id}/transactions`)
        .query({ page: 1, limit: 1 })
        .set('Authorization', `Bearer ${clientToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.transactions).toHaveLength(1);
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(1);
    });

    it('should return 400 for invalid brand ID', async () => {
      const response = await request(app.getApp())
        .get('/api/client/credits/balances/invalid-id/transactions')
        .set('Authorization', `Bearer ${clientToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_001');
    });

    it('should return empty array for non-existent brand', async () => {
      const fakeBrandId = new mongoose.Types.ObjectId().toString();
      
      const response = await request(app.getApp())
        .get(`/api/client/credits/balances/${fakeBrandId}/transactions`)
        .set('Authorization', `Bearer ${clientToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.transactions).toHaveLength(0);
    });
  });

  describe('GET /api/client/credits/expiring', () => {
    beforeEach(async () => {
      // Create credit balance with expiring credits
      const creditBalance = new CreditBalance({
        client: testClient._id,
        brand: testBrand._id,
        availableCredits: 10,
        totalCreditsEarned: 10,
        totalCreditsUsed: 0,
        creditPackages: [{
          creditPlan: testCreditPlan._id,
          purchaseDate: new Date(),
          expiryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
          originalCredits: 10,
          creditsRemaining: 10,
          status: 'active'
        }],
        transactions: [],
        status: 'active'
      });
      await creditBalance.save();
    });

    it('should return expiring credits', async () => {
      const response = await request(app.getApp())
        .get('/api/client/credits/expiring')
        .query({ days: 7 })
        .set('Authorization', `Bearer ${clientToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.expiringCredits).toHaveLength(1);
      expect(response.body.data.expiringCredits[0].totalExpiringCredits).toBe(10);
      expect(response.body.data.daysAhead).toBe(7);
    });

    it('should return empty array when no credits expiring', async () => {
      const response = await request(app.getApp())
        .get('/api/client/credits/expiring')
        .query({ days: 3 }) // Credits expire in 5 days, so none in 3 days
        .set('Authorization', `Bearer ${clientToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.expiringCredits).toHaveLength(0);
    });

    it('should return 400 for invalid days parameter', async () => {
      const response = await request(app.getApp())
        .get('/api/client/credits/expiring')
        .query({ days: 500 }) // Exceeds maximum
        .set('Authorization', `Bearer ${clientToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_001');
    });
  });

  describe('GET /api/client/credits/eligibility/:brandId/:classId', () => {
    beforeEach(async () => {
      // Create credit balance
      const creditBalance = new CreditBalance({
        client: testClient._id,
        brand: testBrand._id,
        availableCredits: 5,
        totalCreditsEarned: 5,
        totalCreditsUsed: 0,
        creditPackages: [{
          creditPlan: testCreditPlan._id,
          purchaseDate: new Date(),
          expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          originalCredits: 5,
          creditsRemaining: 5,
          status: 'active'
        }],
        transactions: [],
        status: 'active'
      });
      await creditBalance.save();
    });

    it('should return eligible when sufficient credits available', async () => {
      const fakeClassId = new mongoose.Types.ObjectId().toString();
      
      const response = await request(app.getApp())
        .get(`/api/client/credits/eligibility/${testBrand._id}/${fakeClassId}`)
        .query({ amount: 3 })
        .set('Authorization', `Bearer ${clientToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.eligibility.eligible).toBe(true);
      expect(response.body.data.eligibility.availableCredits).toBe(5);
    });

    it('should return not eligible when insufficient credits', async () => {
      const fakeClassId = new mongoose.Types.ObjectId().toString();
      
      const response = await request(app.getApp())
        .get(`/api/client/credits/eligibility/${testBrand._id}/${fakeClassId}`)
        .query({ amount: 10 }) // More than available
        .set('Authorization', `Bearer ${clientToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.eligibility.eligible).toBe(false);
      expect(response.body.data.eligibility.message).toContain('Insufficient credits');
    });

    it('should return 400 for invalid brand or class ID', async () => {
      const response = await request(app.getApp())
        .get('/api/client/credits/eligibility/invalid-brand/invalid-class')
        .set('Authorization', `Bearer ${clientToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_001');
    });

    it('should return 400 for invalid amount parameter', async () => {
      const fakeClassId = new mongoose.Types.ObjectId().toString();
      
      const response = await request(app.getApp())
        .get(`/api/client/credits/eligibility/${testBrand._id}/${fakeClassId}`)
        .query({ amount: 15 }) // Exceeds maximum
        .set('Authorization', `Bearer ${clientToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_001');
    });
  });
});