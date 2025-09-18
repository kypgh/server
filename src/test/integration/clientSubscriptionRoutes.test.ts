import request from 'supertest';
import { Application } from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { app } from '../../app';
import { Client } from '../../models/Client';
import { Brand } from '../../models/Brand';
import { SubscriptionPlan } from '../../models/SubscriptionPlan';
import { Subscription } from '../../models/Subscription';
import { Class } from '../../models/Class';
import JwtUtils from '../../utils/jwt';

describe('Client Subscription Routes', () => {
  let mongoServer: MongoMemoryServer;
  let testApp: Application;
  let clientToken: string;
  let clientId: string;
  let brandId: string;
  let subscriptionPlanId: string;
  let classId: string;

  beforeAll(async () => {
    // Start in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
    
    testApp = app;
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear all collections
    await Promise.all([
      Client.deleteMany({}),
      Brand.deleteMany({}),
      SubscriptionPlan.deleteMany({}),
      Subscription.deleteMany({}),
      Class.deleteMany({})
    ]);

    // Create test client
    const client = new Client({
      email: 'client@test.com',
      password: 'hashedPassword',
      firstName: 'Test',
      lastName: 'Client',
      status: 'active'
    });
    await client.save();
    clientId = client._id.toString();

    // Create test brand
    const brand = new Brand({
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
        email: 'contact@test.com'
      },
      businessHours: [{
        day: 'monday',
        openTime: '09:00',
        closeTime: '17:00',
        isOpen: true
      }],
      stripeConnectAccountId: 'acct_test123',
      stripeOnboardingComplete: true,
      status: 'active'
    });
    await brand.save();
    brandId = brand._id.toString();

    // Create test class
    const testClass = new Class({
      name: 'Test Yoga Class',
      brand: brandId,
      description: 'A relaxing yoga class',
      category: 'yoga',
      difficulty: 'beginner',
      slots: 20,
      duration: 60,
      cancellationPolicy: 24,
      timeBlocks: [{
        day: 'monday',
        startTime: '10:00',
        endTime: '11:00'
      }],
      classType: 'scheduled',
      status: 'active'
    });
    await testClass.save();
    classId = testClass._id.toString();

    // Create test subscription plan
    const subscriptionPlan = new SubscriptionPlan({
      brand: brandId,
      name: 'Monthly Unlimited',
      description: 'Unlimited classes for one month',
      price: 9900, // $99.00
      billingCycle: 'monthly',
      includedClasses: [], // Empty = all classes
      frequencyLimit: {
        count: 0, // Unlimited
        period: 'month',
        resetDay: 1
      },
      status: 'active'
    });
    await subscriptionPlan.save();
    subscriptionPlanId = subscriptionPlan._id.toString();

    // Generate client JWT token
    clientToken = JwtUtils.generateAccessToken({
      id: clientId,
      type: 'client',
      email: 'client@test.com'
    });
  });

  describe('POST /api/client/subscriptions/purchase', () => {
    it('should handle Stripe validation error in test environment', async () => {
      const response = await request(testApp)
        .post('/api/client/subscriptions/purchase')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          subscriptionPlanId,
          paymentMethodId: 'pm_card_visa'
        });

      // In test environment, Stripe validation will fail due to test account setup
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('STRIPE_002');
    });

    it('should reject purchase with invalid subscription plan ID', async () => {
      const response = await request(testApp)
        .post('/api/client/subscriptions/purchase')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          subscriptionPlanId: 'invalid-id',
          paymentMethodId: 'pm_card_visa'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_001');
    });

    it('should reject purchase with non-existent subscription plan', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      
      const response = await request(testApp)
        .post('/api/client/subscriptions/purchase')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          subscriptionPlanId: nonExistentId,
          paymentMethodId: 'pm_card_visa'
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PLAN_001');
    });

    it('should reject purchase when client already has active subscription with brand', async () => {
      // Create existing active subscription
      const existingSubscription = new Subscription({
        client: clientId,
        brand: brandId,
        subscriptionPlan: subscriptionPlanId,
        status: 'active',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        frequencyUsed: 0,
        frequencyResetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        autoRenew: true
      });
      await existingSubscription.save();

      const response = await request(testApp)
        .post('/api/client/subscriptions/purchase')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          subscriptionPlanId,
          paymentMethodId: 'pm_card_visa'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('SUBSCRIPTION_001');
    });

    it('should require authentication', async () => {
      const response = await request(testApp)
        .post('/api/client/subscriptions/purchase')
        .send({
          subscriptionPlanId,
          paymentMethodId: 'pm_card_visa'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/client/subscriptions', () => {
    beforeEach(async () => {
      // Create test subscriptions
      const subscriptions = [
        {
          client: clientId,
          brand: brandId,
          subscriptionPlan: subscriptionPlanId,
          status: 'active',
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          frequencyUsed: 5,
          frequencyResetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          autoRenew: true
        },
        {
          client: clientId,
          brand: brandId,
          subscriptionPlan: subscriptionPlanId,
          status: 'cancelled',
          startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
          endDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          nextBillingDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          currentPeriodStart: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
          currentPeriodEnd: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          frequencyUsed: 0,
          frequencyResetDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          cancelledAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
          cancellationReason: 'Test cancellation',
          autoRenew: false
        }
      ];

      await Subscription.insertMany(subscriptions);
    });

    it('should return client subscriptions with pagination', async () => {
      const response = await request(testApp)
        .get('/api/client/subscriptions')
        .set('Authorization', `Bearer ${clientToken}`)
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.subscriptions).toHaveLength(2);
      expect(response.body.data.pagination).toBeDefined();
      expect(response.body.data.pagination.total).toBe(2);
    });

    it('should filter subscriptions by status', async () => {
      const response = await request(testApp)
        .get('/api/client/subscriptions')
        .set('Authorization', `Bearer ${clientToken}`)
        .query({ status: 'active' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.subscriptions).toHaveLength(1);
      expect(response.body.data.subscriptions[0].status).toBe('active');
    });

    it('should include computed fields in response', async () => {
      const response = await request(testApp)
        .get('/api/client/subscriptions')
        .set('Authorization', `Bearer ${clientToken}`)
        .query({ status: 'active' });

      expect(response.status).toBe(200);
      const subscription = response.body.data.subscriptions[0];
      expect(subscription.remainingFrequency).toBeDefined();
      expect(subscription.isValidForBooking).toBeDefined();
      expect(subscription.daysUntilRenewal).toBeDefined();
    });

    it('should require authentication', async () => {
      const response = await request(testApp)
        .get('/api/client/subscriptions');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/client/subscriptions/:subscriptionId', () => {
    let subscriptionId: string;

    beforeEach(async () => {
      const subscription = new Subscription({
        client: clientId,
        brand: brandId,
        subscriptionPlan: subscriptionPlanId,
        status: 'active',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        frequencyUsed: 3,
        frequencyResetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        autoRenew: true
      });
      await subscription.save();
      subscriptionId = subscription._id.toString();
    });

    it('should return specific subscription details', async () => {
      const response = await request(testApp)
        .get(`/api/client/subscriptions/${subscriptionId}`)
        .set('Authorization', `Bearer ${clientToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.subscription._id).toBe(subscriptionId);
      expect(response.body.data.subscription.brand).toBeDefined();
      expect(response.body.data.subscription.subscriptionPlan).toBeDefined();
    });

    it('should return 404 for non-existent subscription', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      
      const response = await request(testApp)
        .get(`/api/client/subscriptions/${nonExistentId}`)
        .set('Authorization', `Bearer ${clientToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('SUBSCRIPTION_002');
    });

    it('should reject invalid subscription ID format', async () => {
      const response = await request(testApp)
        .get('/api/client/subscriptions/invalid-id')
        .set('Authorization', `Bearer ${clientToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_001');
    });
  });

  describe('PUT /api/client/subscriptions/:subscriptionId/cancel', () => {
    let subscriptionId: string;

    beforeEach(async () => {
      const subscription = new Subscription({
        client: clientId,
        brand: brandId,
        subscriptionPlan: subscriptionPlanId,
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
      await subscription.save();
      subscriptionId = subscription._id.toString();
    });

    it('should successfully cancel an active subscription', async () => {
      const response = await request(testApp)
        .put(`/api/client/subscriptions/${subscriptionId}/cancel`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          reason: 'No longer needed'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.subscription.status).toBe('cancelled');
      expect(response.body.data.subscription.cancelledAt).toBeDefined();
      expect(response.body.data.subscription.cancellationReason).toBe('No longer needed');
    });

    it('should cancel subscription without reason', async () => {
      const response = await request(testApp)
        .put(`/api/client/subscriptions/${subscriptionId}/cancel`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.subscription.status).toBe('cancelled');
      expect(response.body.data.subscription.cancellationReason).toBe('Cancelled by client');
    });

    it('should reject cancellation of already cancelled subscription', async () => {
      // First cancellation
      await request(testApp)
        .put(`/api/client/subscriptions/${subscriptionId}/cancel`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({});

      // Second cancellation attempt
      const response = await request(testApp)
        .put(`/api/client/subscriptions/${subscriptionId}/cancel`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('SUBSCRIPTION_003');
    });

    it('should return 404 for non-existent subscription', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      
      const response = await request(testApp)
        .put(`/api/client/subscriptions/${nonExistentId}/cancel`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({});

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('SUBSCRIPTION_002');
    });
  });

  describe('GET /api/client/subscriptions/:subscriptionId/booking-eligibility', () => {
    let subscriptionId: string;
    let limitedPlanId: string;

    beforeEach(async () => {
      // Create limited subscription plan
      const limitedPlan = new SubscriptionPlan({
        brand: brandId,
        name: 'Limited Plan',
        description: '5 classes per month',
        price: 4900,
        billingCycle: 'monthly',
        includedClasses: [classId], // Only specific class
        frequencyLimit: {
          count: 5,
          period: 'month',
          resetDay: 1
        },
        status: 'active'
      });
      await limitedPlan.save();
      limitedPlanId = limitedPlan._id.toString();

      const subscription = new Subscription({
        client: clientId,
        brand: brandId,
        subscriptionPlan: limitedPlanId,
        status: 'active',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        frequencyUsed: 2,
        frequencyResetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        autoRenew: true
      });
      await subscription.save();
      subscriptionId = subscription._id.toString();
    });

    it('should return eligibility for valid subscription and class', async () => {
      const response = await request(testApp)
        .get(`/api/client/subscriptions/${subscriptionId}/booking-eligibility`)
        .set('Authorization', `Bearer ${clientToken}`)
        .query({ classId });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.eligibility.eligible).toBe(true);
      expect(response.body.data.subscription.remainingFrequency).toBe(3);
    });

    it('should return ineligible for class not in plan', async () => {
      // Create another class not in the plan
      const otherClass = new Class({
        name: 'Other Class',
        brand: brandId,
        description: 'Another class',
        category: 'fitness',
        difficulty: 'intermediate',
        slots: 15,
        duration: 60, // Match the time block duration
        cancellationPolicy: 12,
        timeBlocks: [{
          day: 'tuesday',
          startTime: '14:00',
          endTime: '15:00'
        }],
        classType: 'scheduled',
        status: 'active'
      });
      await otherClass.save();

      const response = await request(testApp)
        .get(`/api/client/subscriptions/${subscriptionId}/booking-eligibility`)
        .set('Authorization', `Bearer ${clientToken}`)
        .query({ classId: otherClass._id.toString() });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.eligibility.eligible).toBe(false);
      expect(response.body.data.eligibility.reasons).toContain('Class is not included in your subscription plan');
    });

    it('should check general eligibility without class ID', async () => {
      const response = await request(testApp)
        .get(`/api/client/subscriptions/${subscriptionId}/booking-eligibility`)
        .set('Authorization', `Bearer ${clientToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.eligibility.eligible).toBe(true);
      expect(response.body.data.subscription.remainingFrequency).toBe(3);
    });
  });
});