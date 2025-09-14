import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../app';
import { Brand } from '../../models/Brand';
import { Client } from '../../models/Client';
import { SubscriptionPlan } from '../../models/SubscriptionPlan';
import { CreditPlan } from '../../models/CreditPlan';
import { Payment } from '../../models/Payment';
import { Subscription } from '../../models/Subscription';
import { CreditBalance } from '../../models/CreditBalance';
import PasswordUtils from '../../utils/password';
import JwtUtils from '../../utils/jwt';
import stripeService from '../../services/stripeService';

// Mock Stripe service
jest.mock('../../services/stripeService');
const mockStripeService = stripeService as jest.Mocked<typeof stripeService>;

describe('Payment Routes Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  let testBrand: any;
  let testClient: any;
  let testSubscriptionPlan: any;
  let testCreditPlan: any;
  let brandToken: string;
  let clientToken: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear all collections
    await Promise.all([
      Brand.deleteMany({}),
      Client.deleteMany({}),
      SubscriptionPlan.deleteMany({}),
      CreditPlan.deleteMany({}),
      Payment.deleteMany({}),
      Subscription.deleteMany({}),
      CreditBalance.deleteMany({})
    ]);

    // Create test brand
    testBrand = await Brand.create({
      name: 'Test Fitness Studio',
      email: 'brand@test.com',
      password: await PasswordUtils.hashPassword('password123'),
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
      businessHours: [],
      stripeConnectAccountId: 'acct_test123',
      stripeOnboardingComplete: true,
      status: 'active'
    });

    // Create test client
    testClient = await Client.create({
      email: 'client@test.com',
      password: await PasswordUtils.hashPassword('password123'),
      firstName: 'John',
      lastName: 'Doe',
      status: 'active'
    });

    // Create test subscription plan
    testSubscriptionPlan = await SubscriptionPlan.create({
      brand: testBrand._id,
      name: 'Monthly Unlimited',
      price: 9999,
      billingCycle: 'monthly',
      includedClasses: [],
      frequencyLimit: {
        count: 0,
        period: 'month',
        resetDay: 1
      },
      status: 'active'
    });

    // Create test credit plan
    testCreditPlan = await CreditPlan.create({
      brand: testBrand._id,
      name: '10 Class Pack',
      price: 15000,
      creditAmount: 10,
      validityPeriod: 90,
      bonusCredits: 2,
      includedClasses: [],
      status: 'active'
    });

    // Generate tokens
    brandToken = JwtUtils.generateAccessToken({
      id: testBrand._id.toString(),
      type: 'brand',
      email: testBrand.email
    });
    clientToken = JwtUtils.generateAccessToken({
      id: testClient._id.toString(),
      type: 'client',
      email: testClient.email
    });

    // Reset mocks
    jest.clearAllMocks();
    mockStripeService.validatePaymentCapability.mockResolvedValue(true);
  });

  describe('POST /api/client/payments/subscription/create-intent', () => {
    it('should create subscription payment intent successfully', async () => {
      // Mock PaymentService stripe instance
      const mockPaymentIntent = {
        id: 'pi_test123',
        client_secret: 'pi_test123_secret',
        status: 'requires_payment_method',
        amount: 9999,
        currency: 'usd'
      };

      // We need to mock the Stripe instance used by PaymentService
      const mockStripe = {
        paymentIntents: {
          create: jest.fn().mockResolvedValue(mockPaymentIntent)
        }
      };

      // Mock the PaymentService's stripe instance
      const paymentService = require('../../services/paymentService').default;
      paymentService.stripe = mockStripe;

      const response = await request(app)
        .post('/api/client/payments/subscription/create-intent')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          subscriptionPlanId: testSubscriptionPlan._id.toString(),
          paymentMethodId: 'pm_test123'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.paymentIntent).toEqual({
        paymentIntentId: 'pi_test123',
        clientSecret: 'pi_test123_secret',
        amount: 9999,
        currency: 'USD',
        status: 'requires_payment_method'
      });

      // Verify payment record was created
      const payment = await Payment.findOne({ paymentIntentId: 'pi_test123' });
      expect(payment).toBeTruthy();
      expect(payment!.type).toBe('subscription');
      expect(payment!.client.toString()).toBe(testClient._id.toString());
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/client/payments/subscription/create-intent')
        .send({
          subscriptionPlanId: testSubscriptionPlan._id.toString()
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 with invalid subscription plan ID', async () => {
      const response = await request(app)
        .post('/api/client/payments/subscription/create-intent')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          subscriptionPlanId: 'invalid-id'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_001');
    });

    it('should return 400 when subscription plan not found', async () => {
      const response = await request(app)
        .post('/api/client/payments/subscription/create-intent')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          subscriptionPlanId: new mongoose.Types.ObjectId().toString()
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 when brand Stripe account not configured', async () => {
      await Brand.findByIdAndUpdate(testBrand._id, {
        stripeConnectAccountId: null,
        stripeOnboardingComplete: false
      });

      const response = await request(app)
        .post('/api/client/payments/subscription/create-intent')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          subscriptionPlanId: testSubscriptionPlan._id.toString()
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/client/payments/credits/create-intent', () => {
    it('should create credit payment intent successfully', async () => {
      const mockPaymentIntent = {
        id: 'pi_credit123',
        client_secret: 'pi_credit123_secret',
        status: 'requires_payment_method',
        amount: 15000,
        currency: 'usd'
      };

      const mockStripe = {
        paymentIntents: {
          create: jest.fn().mockResolvedValue(mockPaymentIntent)
        }
      };

      const paymentService = require('../../services/paymentService').default;
      paymentService.stripe = mockStripe;

      const response = await request(app)
        .post('/api/client/payments/credits/create-intent')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          creditPlanId: testCreditPlan._id.toString(),
          paymentMethodId: 'pm_test123'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.paymentIntent).toEqual({
        paymentIntentId: 'pi_credit123',
        clientSecret: 'pi_credit123_secret',
        amount: 15000,
        currency: 'USD',
        status: 'requires_payment_method'
      });

      // Verify payment record was created
      const payment = await Payment.findOne({ paymentIntentId: 'pi_credit123' });
      expect(payment).toBeTruthy();
      expect(payment!.type).toBe('credit_purchase');
    });

    it('should return 400 with invalid credit plan ID', async () => {
      const response = await request(app)
        .post('/api/client/payments/credits/create-intent')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          creditPlanId: 'invalid-id'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_001');
    });
  });

  describe('POST /api/client/payments/confirm', () => {
    let testPayment: any;
    let testSubscription: any;

    beforeEach(async () => {
      // Create test subscription
      testSubscription = await Subscription.create({
        client: testClient._id,
        brand: testBrand._id,
        subscriptionPlan: testSubscriptionPlan._id,
        status: 'pending',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        frequencyUsed: 0,
        frequencyResetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        autoRenew: true
      });

      // Create test payment
      testPayment = await Payment.create({
        client: testClient._id,
        brand: testBrand._id,
        type: 'subscription',
        status: 'pending',
        amount: 9999,
        currency: 'USD',
        paymentIntentId: 'pi_confirm123',
        subscriptionId: testSubscription._id,
        metadata: {
          subscriptionPlanId: testSubscriptionPlan._id,
          clientId: testClient._id,
          brandId: testBrand._id
        }
      });
    });

    it('should confirm successful payment', async () => {
      const mockPaymentIntent = {
        id: 'pi_confirm123',
        status: 'succeeded',
        last_payment_error: null
      };

      const mockStripe = {
        paymentIntents: {
          retrieve: jest.fn().mockResolvedValue(mockPaymentIntent)
        }
      };

      const paymentService = require('../../services/paymentService').default;
      paymentService.stripe = mockStripe;

      const response = await request(app)
        .post('/api/client/payments/confirm')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          paymentIntentId: 'pi_confirm123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.payment.status).toBe('succeeded');

      // Verify subscription was activated
      const updatedSubscription = await Subscription.findById(testSubscription._id);
      expect(updatedSubscription!.status).toBe('active');
    });

    it('should handle failed payment', async () => {
      const mockPaymentIntent = {
        id: 'pi_confirm123',
        status: 'payment_failed',
        last_payment_error: {
          message: 'Your card was declined.'
        }
      };

      const mockStripe = {
        paymentIntents: {
          retrieve: jest.fn().mockResolvedValue(mockPaymentIntent)
        }
      };

      const paymentService = require('../../services/paymentService').default;
      paymentService.stripe = mockStripe;

      const response = await request(app)
        .post('/api/client/payments/confirm')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          paymentIntentId: 'pi_confirm123'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.details.status).toBe('failed');
    });

    it('should return 400 with invalid payment intent ID format', async () => {
      const response = await request(app)
        .post('/api/client/payments/confirm')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          paymentIntentId: 'invalid-format'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_001');
    });
  });

  describe('GET /api/client/payments/history', () => {
    beforeEach(async () => {
      // Create test payments
      await Payment.create([
        {
          client: testClient._id,
          brand: testBrand._id,
          type: 'subscription',
          status: 'succeeded',
          amount: 9999,
          currency: 'USD',
          paymentIntentId: 'pi_history1',
          metadata: {},
          createdAt: new Date('2023-01-01')
        },
        {
          client: testClient._id,
          brand: testBrand._id,
          type: 'credit_purchase',
          status: 'succeeded',
          amount: 15000,
          currency: 'USD',
          paymentIntentId: 'pi_history2',
          metadata: {},
          createdAt: new Date('2023-01-02')
        }
      ]);
    });

    it('should return client payment history', async () => {
      const response = await request(app)
        .get('/api/client/payments/history')
        .set('Authorization', `Bearer ${clientToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.payments).toHaveLength(2);
      expect(response.body.data.payments[0].type).toBe('credit_purchase'); // Most recent first
      expect(response.body.data.payments[1].type).toBe('subscription');
    });

    it('should respect limit parameter', async () => {
      const response = await request(app)
        .get('/api/client/payments/history?limit=1')
        .set('Authorization', `Bearer ${clientToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.payments).toHaveLength(1);
      expect(response.body.data.pagination.limit).toBe(1);
    });

    it('should return 400 with invalid limit', async () => {
      const response = await request(app)
        .get('/api/client/payments/history?limit=150')
        .set('Authorization', `Bearer ${clientToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/brand/payments/history', () => {
    beforeEach(async () => {
      await Payment.create([
        {
          client: testClient._id,
          brand: testBrand._id,
          type: 'subscription',
          status: 'succeeded',
          amount: 9999,
          currency: 'USD',
          paymentIntentId: 'pi_brand1',
          metadata: {}
        },
        {
          client: testClient._id,
          brand: testBrand._id,
          type: 'credit_purchase',
          status: 'succeeded',
          amount: 15000,
          currency: 'USD',
          paymentIntentId: 'pi_brand2',
          metadata: {}
        }
      ]);
    });

    it('should return brand payment history', async () => {
      const response = await request(app)
        .get('/api/payments/brand/history')
        .set('Authorization', `Bearer ${brandToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.payments).toHaveLength(2);
    });

    it('should return 401 without brand authentication', async () => {
      const response = await request(app)
        .get('/api/payments/brand/history')
        .set('Authorization', `Bearer ${clientToken}`); // Wrong token type

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/client/payments/:paymentId', () => {
    let testPayment: any;

    beforeEach(async () => {
      testPayment = await Payment.create({
        client: testClient._id,
        brand: testBrand._id,
        type: 'subscription',
        status: 'succeeded',
        amount: 9999,
        currency: 'USD',
        paymentIntentId: 'pi_details123',
        metadata: {
          subscriptionPlanId: testSubscriptionPlan._id
        }
      });
    });

    it('should return payment details', async () => {
      const response = await request(app)
        .get(`/api/client/payments/pi_details123`)
        .set('Authorization', `Bearer ${clientToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.payment.paymentIntentId).toBe('pi_details123');
      expect(response.body.data.payment.type).toBe('subscription');
    });

    it('should return 404 for non-existent payment', async () => {
      const response = await request(app)
        .get('/api/client/payments/pi_nonexistent')
        .set('Authorization', `Bearer ${clientToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should return 403 for payment belonging to different client', async () => {
      // Create another client
      const otherClient = await Client.create({
        email: 'other@test.com',
        password: await PasswordUtils.hashPassword('password123'),
        firstName: 'Jane',
        lastName: 'Smith',
        status: 'active'
      });

      const otherToken = JwtUtils.generateAccessToken({
        id: otherClient._id.toString(),
        type: 'client',
        email: otherClient.email
      });

      const response = await request(app)
        .get(`/api/client/payments/pi_details123`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 with invalid payment ID format', async () => {
      const response = await request(app)
        .get('/api/client/payments/invalid-format')
        .set('Authorization', `Bearer ${clientToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_001');
    });
  });

  describe('POST /api/payments/webhook', () => {
    it('should handle webhook with valid signature', async () => {
      // Create test payment for webhook processing
      const payment = await Payment.create({
        client: testClient._id,
        brand: testBrand._id,
        type: 'subscription',
        status: 'pending',
        amount: 9999,
        currency: 'USD',
        paymentIntentId: 'pi_webhook123',
        subscriptionId: new mongoose.Types.ObjectId(),
        metadata: {}
      });

      // Create subscription
      await Subscription.create({
        _id: payment.subscriptionId,
        client: testClient._id,
        brand: testBrand._id,
        subscriptionPlan: testSubscriptionPlan._id,
        status: 'pending',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        frequencyUsed: 0,
        frequencyResetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        autoRenew: true
      });

      const webhookPayload = JSON.stringify({
        id: 'evt_test123',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_webhook123',
            status: 'succeeded'
          }
        }
      });

      // Mock Stripe webhook verification
      const mockStripe = {
        webhooks: {
          constructEvent: jest.fn().mockReturnValue({
            id: 'evt_test123',
            type: 'payment_intent.succeeded',
            data: {
              object: {
                id: 'pi_webhook123',
                status: 'succeeded'
              }
            }
          })
        }
      };

      const paymentService = require('../../services/paymentService').default;
      paymentService.stripe = mockStripe;

      const response = await request(app)
        .post('/api/payments/webhook')
        .set('stripe-signature', 'valid_signature')
        .send(webhookPayload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 400 without stripe signature', async () => {
      const response = await request(app)
        .post('/api/payments/webhook')
        .send('{}');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('WEBHOOK_001');
    });
  });
});