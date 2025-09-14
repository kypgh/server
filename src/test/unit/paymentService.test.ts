import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import paymentService from '../../services/paymentService';
import { Payment } from '../../models/Payment';
import { SubscriptionPlan } from '../../models/SubscriptionPlan';
import { CreditPlan } from '../../models/CreditPlan';
import { Subscription } from '../../models/Subscription';
import { CreditBalance } from '../../models/CreditBalance';
import { Brand } from '../../models/Brand';
import { Client } from '../../models/Client';
import stripeService from '../../services/stripeService';
import Stripe from 'stripe';

// Mock Stripe
jest.mock('stripe');
jest.mock('../../services/stripeService');

const mockStripeService = stripeService as jest.Mocked<typeof stripeService>;

describe('PaymentService', () => {
  let mongoServer: MongoMemoryServer;
  let testBrand: any;
  let testClient: any;
  let testSubscriptionPlan: any;
  let testCreditPlan: any;

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
      Payment.deleteMany({}),
      SubscriptionPlan.deleteMany({}),
      CreditPlan.deleteMany({}),
      Subscription.deleteMany({}),
      CreditBalance.deleteMany({}),
      Brand.deleteMany({}),
      Client.deleteMany({})
    ]);

    // Create test data
    testBrand = await Brand.create({
      name: 'Test Fitness Studio',
      email: 'test@studio.com',
      password: 'hashedPassword',
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

    testClient = await Client.create({
      email: 'client@test.com',
      password: 'hashedPassword',
      firstName: 'John',
      lastName: 'Doe',
      status: 'active'
    });

    testSubscriptionPlan = await SubscriptionPlan.create({
      brand: testBrand._id,
      name: 'Monthly Unlimited',
      price: 9999, // $99.99
      billingCycle: 'monthly',
      includedClasses: [],
      frequencyLimit: {
        count: 0, // unlimited
        period: 'month',
        resetDay: 1
      },
      status: 'active'
    });

    testCreditPlan = await CreditPlan.create({
      brand: testBrand._id,
      name: '10 Class Pack',
      price: 15000, // $150.00
      creditAmount: 10,
      validityPeriod: 90,
      bonusCredits: 2,
      includedClasses: [],
      status: 'active'
    });

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('createSubscriptionPaymentIntent', () => {
    beforeEach(() => {
      mockStripeService.validatePaymentCapability.mockResolvedValue(true);
    });

    it('should create subscription payment intent successfully', async () => {
      const mockPaymentIntent = {
        id: 'pi_test123',
        client_secret: 'pi_test123_secret',
        status: 'requires_payment_method',
        amount: 9999,
        currency: 'usd'
      };

      // Mock Stripe PaymentIntent creation
      const mockStripe = {
        paymentIntents: {
          create: jest.fn().mockResolvedValue(mockPaymentIntent)
        }
      };
      (paymentService as any).stripe = mockStripe;

      const request = {
        clientId: testClient._id.toString(),
        subscriptionPlanId: testSubscriptionPlan._id.toString(),
        paymentMethodId: 'pm_test123'
      };

      const result = await paymentService.createSubscriptionPaymentIntent(request);

      expect(result).toEqual({
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
      expect(payment!.status).toBe('pending');
      expect(payment!.amount).toBe(9999);

      // Verify subscription record was created
      const subscription = await Subscription.findOne({ client: testClient._id });
      expect(subscription).toBeTruthy();
      expect(subscription!.status).toBe('pending');
      expect(subscription!.paymentIntentId).toBe('pi_test123');
    });

    it('should throw error if client not found', async () => {
      const request = {
        clientId: new mongoose.Types.ObjectId().toString(),
        subscriptionPlanId: testSubscriptionPlan._id.toString()
      };

      await expect(paymentService.createSubscriptionPaymentIntent(request))
        .rejects.toThrow('Client not found');
    });

    it('should throw error if subscription plan not found', async () => {
      const request = {
        clientId: testClient._id.toString(),
        subscriptionPlanId: new mongoose.Types.ObjectId().toString()
      };

      await expect(paymentService.createSubscriptionPaymentIntent(request))
        .rejects.toThrow('Subscription plan not found');
    });

    it('should throw error if subscription plan is inactive', async () => {
      await SubscriptionPlan.findByIdAndUpdate(testSubscriptionPlan._id, { status: 'inactive' });

      const request = {
        clientId: testClient._id.toString(),
        subscriptionPlanId: testSubscriptionPlan._id.toString()
      };

      await expect(paymentService.createSubscriptionPaymentIntent(request))
        .rejects.toThrow('Subscription plan is not active');
    });

    it('should throw error if brand Stripe account not configured', async () => {
      await Brand.findByIdAndUpdate(testBrand._id, { 
        stripeConnectAccountId: null,
        stripeOnboardingComplete: false 
      });

      const request = {
        clientId: testClient._id.toString(),
        subscriptionPlanId: testSubscriptionPlan._id.toString()
      };

      await expect(paymentService.createSubscriptionPaymentIntent(request))
        .rejects.toThrow('Brand Stripe account not properly configured');
    });

    it('should throw error if brand cannot process payments', async () => {
      mockStripeService.validatePaymentCapability.mockResolvedValue(false);

      const request = {
        clientId: testClient._id.toString(),
        subscriptionPlanId: testSubscriptionPlan._id.toString()
      };

      await expect(paymentService.createSubscriptionPaymentIntent(request))
        .rejects.toThrow('Brand cannot process payments at this time');
    });

    it('should throw error if client already has active subscription', async () => {
      // Create existing active subscription
      await Subscription.create({
        client: testClient._id,
        brand: testBrand._id,
        subscriptionPlan: testSubscriptionPlan._id,
        status: 'active',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        frequencyUsed: 0,
        frequencyResetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        autoRenew: true
      });

      const request = {
        clientId: testClient._id.toString(),
        subscriptionPlanId: testSubscriptionPlan._id.toString()
      };

      await expect(paymentService.createSubscriptionPaymentIntent(request))
        .rejects.toThrow('Client already has an active subscription with this brand');
    });
  });

  describe('createCreditPaymentIntent', () => {
    beforeEach(() => {
      mockStripeService.validatePaymentCapability.mockResolvedValue(true);
    });

    it('should create credit payment intent successfully', async () => {
      const mockPaymentIntent = {
        id: 'pi_credit123',
        client_secret: 'pi_credit123_secret',
        status: 'requires_payment_method',
        amount: 15000,
        currency: 'usd'
      };

      // Mock Stripe PaymentIntent creation
      const mockStripe = {
        paymentIntents: {
          create: jest.fn().mockResolvedValue(mockPaymentIntent)
        }
      };
      (paymentService as any).stripe = mockStripe;

      const request = {
        clientId: testClient._id.toString(),
        creditPlanId: testCreditPlan._id.toString(),
        paymentMethodId: 'pm_test123'
      };

      const result = await paymentService.createCreditPaymentIntent(request);

      expect(result).toEqual({
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
      expect(payment!.status).toBe('pending');
      expect(payment!.amount).toBe(15000);

      // Verify credit balance was created
      const creditBalance = await CreditBalance.findOne({ 
        client: testClient._id,
        brand: testBrand._id 
      });
      expect(creditBalance).toBeTruthy();
      expect(creditBalance!.availableCredits).toBe(0); // Not added until payment succeeds
    });

    it('should use existing credit balance if available', async () => {
      // Create existing credit balance
      const existingBalance = await CreditBalance.create({
        client: testClient._id,
        brand: testBrand._id,
        availableCredits: 5,
        totalCreditsEarned: 5,
        totalCreditsUsed: 0,
        creditPackages: [],
        transactions: [],
        status: 'active',
        lastActivityDate: new Date()
      });

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
      (paymentService as any).stripe = mockStripe;

      const request = {
        clientId: testClient._id.toString(),
        creditPlanId: testCreditPlan._id.toString()
      };

      await paymentService.createCreditPaymentIntent(request);

      // Verify payment references existing credit balance
      const payment = await Payment.findOne({ paymentIntentId: 'pi_credit123' });
      expect(payment!.creditBalanceId!.toString()).toBe(existingBalance._id.toString());
    });
  });

  describe('confirmPayment', () => {
    let testPayment: any;

    beforeEach(async () => {
      testPayment = await Payment.create({
        client: testClient._id,
        brand: testBrand._id,
        type: 'subscription',
        status: 'pending',
        amount: 9999,
        currency: 'USD',
        paymentIntentId: 'pi_test123',
        subscriptionId: new mongoose.Types.ObjectId(),
        metadata: {
          subscriptionPlanId: testSubscriptionPlan._id,
          clientId: testClient._id,
          brandId: testBrand._id
        }
      });
    });

    it('should confirm successful payment', async () => {
      const mockPaymentIntent = {
        id: 'pi_test123',
        status: 'succeeded',
        last_payment_error: null
      };

      const mockStripe = {
        paymentIntents: {
          retrieve: jest.fn().mockResolvedValue(mockPaymentIntent)
        }
      };
      (paymentService as any).stripe = mockStripe;

      // Create subscription for completion
      const subscription = await Subscription.create({
        _id: testPayment.subscriptionId,
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

      const request = {
        paymentIntentId: 'pi_test123',
        clientId: testClient._id.toString()
      };

      const result = await paymentService.confirmPayment(request);

      expect(result.success).toBe(true);
      expect(result.payment.status).toBe('succeeded');

      // Verify subscription was activated
      const updatedSubscription = await Subscription.findById(subscription._id);
      expect(updatedSubscription!.status).toBe('active');
    });

    it('should handle payment requiring action', async () => {
      const mockPaymentIntent = {
        id: 'pi_test123',
        status: 'requires_action',
        last_payment_error: null
      };

      const mockStripe = {
        paymentIntents: {
          retrieve: jest.fn().mockResolvedValue(mockPaymentIntent)
        }
      };
      (paymentService as any).stripe = mockStripe;

      const request = {
        paymentIntentId: 'pi_test123',
        clientId: testClient._id.toString()
      };

      const result = await paymentService.confirmPayment(request);

      expect(result.success).toBe(false);
      expect(result.payment.status).toBe('processing');
    });

    it('should handle failed payment', async () => {
      const mockPaymentIntent = {
        id: 'pi_test123',
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
      (paymentService as any).stripe = mockStripe;

      // Create subscription for cleanup
      await Subscription.create({
        _id: testPayment.subscriptionId,
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

      const request = {
        paymentIntentId: 'pi_test123',
        clientId: testClient._id.toString()
      };

      const result = await paymentService.confirmPayment(request);

      expect(result.success).toBe(false);
      expect(result.payment.status).toBe('failed');
      expect(result.payment.failureReason).toBe('Your card was declined.');

      // Verify subscription was cancelled
      const subscription = await Subscription.findById(testPayment.subscriptionId);
      expect(subscription!.status).toBe('cancelled');
      expect(subscription!.cancellationReason).toBe('Payment failed');
    });

    it('should throw error if payment not found', async () => {
      const request = {
        paymentIntentId: 'pi_nonexistent',
        clientId: testClient._id.toString()
      };

      await expect(paymentService.confirmPayment(request))
        .rejects.toThrow('Payment not found');
    });

    it('should throw error if payment already processed', async () => {
      await Payment.findByIdAndUpdate(testPayment._id, { status: 'succeeded' });

      const request = {
        paymentIntentId: 'pi_test123',
        clientId: testClient._id.toString()
      };

      await expect(paymentService.confirmPayment(request))
        .rejects.toThrow('Payment already processed');
    });
  });

  describe('handleWebhookEvent', () => {
    it('should handle payment_intent.succeeded event', async () => {
      // Create test payment
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
      const subscription = await Subscription.create({
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

      const webhookEvent = {
        id: 'evt_test123',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_webhook123',
            status: 'succeeded'
          }
        }
      } as any;

      await paymentService.handleWebhookEvent(webhookEvent);

      // Verify payment was updated
      const updatedPayment = await Payment.findById(payment._id);
      expect(updatedPayment!.status).toBe('succeeded');
      expect(updatedPayment!.processedAt).toBeTruthy();

      // Verify subscription was activated
      const updatedSubscription = await Subscription.findById(subscription._id);
      expect(updatedSubscription!.status).toBe('active');
    });

    it('should handle payment_intent.payment_failed event', async () => {
      const payment = await Payment.create({
        client: testClient._id,
        brand: testBrand._id,
        type: 'subscription',
        status: 'pending',
        amount: 9999,
        currency: 'USD',
        paymentIntentId: 'pi_webhook_failed',
        subscriptionId: new mongoose.Types.ObjectId(),
        metadata: {}
      });

      const subscription = await Subscription.create({
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

      const webhookEvent = {
        id: 'evt_failed123',
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: 'pi_webhook_failed',
            status: 'payment_failed',
            last_payment_error: {
              message: 'Card declined'
            }
          }
        }
      } as any;

      await paymentService.handleWebhookEvent(webhookEvent);

      // Verify payment was marked as failed
      const updatedPayment = await Payment.findById(payment._id);
      expect(updatedPayment!.status).toBe('failed');
      expect(updatedPayment!.failureReason).toBe('Card declined');

      // Verify subscription was cancelled
      const updatedSubscription = await Subscription.findById(subscription._id);
      expect(updatedSubscription!.status).toBe('cancelled');
    });
  });

  describe('getPaymentByIntentId', () => {
    it('should return payment by PaymentIntent ID', async () => {
      const payment = await Payment.create({
        client: testClient._id,
        brand: testBrand._id,
        type: 'subscription',
        status: 'succeeded',
        amount: 9999,
        currency: 'USD',
        paymentIntentId: 'pi_lookup123',
        subscriptionId: new mongoose.Types.ObjectId(),
        metadata: {}
      });

      const result = await paymentService.getPaymentByIntentId('pi_lookup123');

      expect(result).toBeTruthy();
      expect(result!._id.toString()).toBe(payment._id.toString());
    });

    it('should return null if payment not found', async () => {
      const result = await paymentService.getPaymentByIntentId('pi_nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('getClientPaymentHistory', () => {
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
          subscriptionId: new mongoose.Types.ObjectId(),
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
          creditBalanceId: new mongoose.Types.ObjectId(),
          metadata: {},
          createdAt: new Date('2023-01-02')
        }
      ]);
    });

    it('should return client payment history', async () => {
      const payments = await paymentService.getClientPaymentHistory(testClient._id.toString());

      expect(payments).toHaveLength(2);
      expect(payments[0].paymentIntentId).toBe('pi_history2'); // Most recent first
      expect(payments[1].paymentIntentId).toBe('pi_history1');
    });

    it('should respect limit and offset', async () => {
      const payments = await paymentService.getClientPaymentHistory(testClient._id.toString(), 1, 1);

      expect(payments).toHaveLength(1);
      expect(payments[0].paymentIntentId).toBe('pi_history1');
    });
  });

  describe('getBrandPaymentHistory', () => {
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
          subscriptionId: new mongoose.Types.ObjectId(),
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
          paymentIntentId: 'pi_brand2',
          creditBalanceId: new mongoose.Types.ObjectId(),
          metadata: {},
          createdAt: new Date('2023-01-02')
        }
      ]);
    });

    it('should return brand payment history', async () => {
      const payments = await paymentService.getBrandPaymentHistory(testBrand._id.toString());

      expect(payments).toHaveLength(2);
      expect(payments[0].paymentIntentId).toBe('pi_brand2'); // Most recent first
      expect(payments[1].paymentIntentId).toBe('pi_brand1');
    });
  });
});