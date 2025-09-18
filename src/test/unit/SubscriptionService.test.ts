import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import SubscriptionService from '../../services/SubscriptionService';
import { Client } from '../../models/Client';
import { Brand } from '../../models/Brand';
import { SubscriptionPlan } from '../../models/SubscriptionPlan';
import { Subscription } from '../../models/Subscription';
import { Class } from '../../models/Class';
// import { Booking } from '../../models/Booking'; // Will be implemented in future task

describe('SubscriptionService', () => {
  let mongoServer: MongoMemoryServer;
  let clientId: string;
  let brandId: string;
  let subscriptionPlanId: string;
  let classId: string;
  let subscriptionId: string;

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
      Client.deleteMany({}),
      Brand.deleteMany({}),
      SubscriptionPlan.deleteMany({}),
      Subscription.deleteMany({}),
      Class.deleteMany({}),
      // Booking.deleteMany({}) // Will be implemented in future task
    ]);

    // Create test data
    const client = new Client({
      email: 'client@test.com',
      password: 'hashedPassword',
      firstName: 'Test',
      lastName: 'Client',
      status: 'active'
    });
    await client.save();
    clientId = client._id.toString();

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

    const subscriptionPlan = new SubscriptionPlan({
      brand: brandId,
      name: 'Monthly Plan',
      description: '10 classes per month',
      price: 9900,
      billingCycle: 'monthly',
      includedClasses: [classId],
      frequencyLimit: {
        count: 10,
        period: 'month',
        resetDay: 1
      },
      status: 'active'
    });
    await subscriptionPlan.save();
    subscriptionPlanId = subscriptionPlan._id.toString();

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

  describe('validateBookingEligibility', () => {
    it('should return eligible for valid subscription and class', async () => {
      const result = await SubscriptionService.validateBookingEligibility(
        clientId,
        brandId,
        classId
      );

      expect(result.eligible).toBe(true);
      expect(result.reasons).toHaveLength(0);
      expect(result.subscription).toBeDefined();
      expect(result.subscription!.remainingFrequency).toBe(7); // 10 - 3 = 7
    });

    it('should return ineligible when no active subscription exists', async () => {
      // Cancel the subscription
      await Subscription.findByIdAndUpdate(subscriptionId, { status: 'cancelled' });

      const result = await SubscriptionService.validateBookingEligibility(
        clientId,
        brandId,
        classId
      );

      expect(result.eligible).toBe(false);
      expect(result.reasons).toContain('No active subscription found with this brand');
    });

    it('should return ineligible when frequency limit is reached', async () => {
      // Use up all frequency
      await Subscription.findByIdAndUpdate(subscriptionId, { frequencyUsed: 10 });

      const result = await SubscriptionService.validateBookingEligibility(
        clientId,
        brandId,
        classId
      );

      expect(result.eligible).toBe(false);
      expect(result.reasons).toContain('Frequency limit reached for current period');
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

      const result = await SubscriptionService.validateBookingEligibility(
        clientId,
        brandId,
        otherClass._id.toString()
      );

      expect(result.eligible).toBe(false);
      expect(result.reasons).toContain('Class is not included in your subscription plan');
    });
  });

  describe('validateFrequencyLimits', () => {
    it('should return correct frequency validation data', async () => {
      const result = await SubscriptionService.validateFrequencyLimits(subscriptionId);

      expect(result.hasFrequencyRemaining).toBe(true);
      expect(result.remainingCount).toBe(7);
      expect(result.usedCount).toBe(3);
      expect(result.limitCount).toBe(10);
      expect(result.resetDate).toBeDefined();
    });

    it('should handle unlimited frequency plans', async () => {
      // Create unlimited plan
      const unlimitedPlan = new SubscriptionPlan({
        brand: brandId,
        name: 'Unlimited Plan',
        description: 'Unlimited classes',
        price: 14900,
        billingCycle: 'monthly',
        includedClasses: [],
        frequencyLimit: {
          count: 0, // Unlimited
          period: 'month',
          resetDay: 1
        },
        status: 'active'
      });
      await unlimitedPlan.save();

      await Subscription.findByIdAndUpdate(subscriptionId, {
        subscriptionPlan: unlimitedPlan._id
      });

      const result = await SubscriptionService.validateFrequencyLimits(subscriptionId);

      expect(result.hasFrequencyRemaining).toBe(true);
      expect(result.remainingCount).toBe(Number.MAX_SAFE_INTEGER);
      expect(result.limitCount).toBe(0);
    });
  });

  describe('processSubscriptionUsage', () => {
    it('should increment frequency usage', async () => {
      await SubscriptionService.processSubscriptionUsage(subscriptionId);

      const subscription = await Subscription.findById(subscriptionId);
      expect(subscription!.frequencyUsed).toBe(4);
    });

    it('should throw error when frequency limit exceeded', async () => {
      // Use up all frequency
      await Subscription.findByIdAndUpdate(subscriptionId, { frequencyUsed: 10 });

      await expect(
        SubscriptionService.processSubscriptionUsage(subscriptionId)
      ).rejects.toThrow('Frequency limit exceeded');
    });

    it('should throw error for invalid subscription', async () => {
      // Set subscription to expired
      await Subscription.findByIdAndUpdate(subscriptionId, { 
        status: 'expired',
        endDate: new Date(Date.now() - 24 * 60 * 60 * 1000) // Yesterday
      });

      await expect(
        SubscriptionService.processSubscriptionUsage(subscriptionId)
      ).rejects.toThrow('Subscription is not valid for booking');
    });
  });

  describe('getSubscriptionStats', () => {
    beforeEach(async () => {
      // Create some bookings
      const bookings = [
        {
          client: clientId,
          session: new mongoose.Types.ObjectId(),
          subscriptionId: subscriptionId,
          bookingType: 'subscription',
          status: 'confirmed',
          confirmationDate: new Date()
        },
        {
          client: clientId,
          session: new mongoose.Types.ObjectId(),
          subscriptionId: subscriptionId,
          bookingType: 'subscription',
          status: 'completed',
          confirmationDate: new Date()
        },
        {
          client: clientId,
          session: new mongoose.Types.ObjectId(),
          subscriptionId: subscriptionId,
          bookingType: 'subscription',
          status: 'cancelled',
          confirmationDate: new Date()
        }
      ];

      // await Booking.insertMany(bookings); // Will be implemented in future task
    });

    it('should return correct subscription statistics', async () => {
      const stats = await SubscriptionService.getSubscriptionStats(subscriptionId);

      expect(stats.totalBookings).toBe(0); // Booking model not implemented yet
      expect(stats.currentPeriodBookings).toBe(0);
      expect(stats.remainingFrequency).toBe(7);
      expect(stats.utilizationRate).toBe(30); // 3/10 * 100 = 30%
    });
  });

  describe('processExpiredSubscriptions', () => {
    it('should update expired subscriptions', async () => {
      // Create an expired subscription
      const expiredSubscription = new Subscription({
        client: clientId,
        brand: brandId,
        subscriptionPlan: subscriptionPlanId,
        status: 'active',
        startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
        endDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago (expired)
        nextBillingDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        currentPeriodStart: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        currentPeriodEnd: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        frequencyUsed: 0,
        frequencyResetDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        autoRenew: true
      });
      await expiredSubscription.save();

      const updatedCount = await SubscriptionService.processExpiredSubscriptions();

      expect(updatedCount).toBe(1);

      const updated = await Subscription.findById(expiredSubscription._id);
      expect(updated!.status).toBe('expired');
    });
  });

  describe('validateSubscriptionCompatibility', () => {
    it('should return compatible for valid client and plan', async () => {
      // Cancel existing subscription first
      await Subscription.findByIdAndUpdate(subscriptionId, { status: 'cancelled' });

      const result = await SubscriptionService.validateSubscriptionCompatibility(
        clientId,
        subscriptionPlanId
      );

      expect(result.compatible).toBe(true);
    });

    it('should return incompatible when client has existing active subscription', async () => {
      const result = await SubscriptionService.validateSubscriptionCompatibility(
        clientId,
        subscriptionPlanId
      );

      expect(result.compatible).toBe(false);
      expect(result.reason).toContain('already has an active subscription');
    });

    it('should return incompatible for inactive client', async () => {
      // Cancel existing subscription first
      await Subscription.findByIdAndUpdate(subscriptionId, { status: 'cancelled' });
      
      await Client.findByIdAndUpdate(clientId, { status: 'inactive' });

      const result = await SubscriptionService.validateSubscriptionCompatibility(
        clientId,
        subscriptionPlanId
      );

      expect(result.compatible).toBe(false);
      expect(result.reason).toContain('Client not found or inactive');
    });
  });

  describe('calculateRenewalDate', () => {
    it('should calculate monthly renewal correctly', () => {
      const startDate = new Date('2024-01-15');
      const renewalDate = SubscriptionService.calculateRenewalDate(startDate, 'monthly');
      
      expect(renewalDate.getMonth()).toBe(1); // February (0-indexed)
      expect(renewalDate.getDate()).toBe(15);
    });

    it('should calculate quarterly renewal correctly', () => {
      const startDate = new Date('2024-01-15');
      const renewalDate = SubscriptionService.calculateRenewalDate(startDate, 'quarterly');
      
      expect(renewalDate.getMonth()).toBe(3); // April (0-indexed)
      expect(renewalDate.getDate()).toBe(15);
    });

    it('should calculate yearly renewal correctly', () => {
      const startDate = new Date('2024-01-15');
      const renewalDate = SubscriptionService.calculateRenewalDate(startDate, 'yearly');
      
      expect(renewalDate.getFullYear()).toBe(2025);
      expect(renewalDate.getMonth()).toBe(0); // January (0-indexed)
      expect(renewalDate.getDate()).toBe(15);
    });

    it('should throw error for invalid billing cycle', () => {
      const startDate = new Date();
      
      expect(() => {
        SubscriptionService.calculateRenewalDate(startDate, 'invalid');
      }).toThrow('Invalid billing cycle: invalid');
    });
  });

  describe('calculateFrequencyResetDate', () => {
    it('should calculate weekly reset correctly', () => {
      const startDate = new Date('2024-01-15'); // Monday
      const frequencyLimit = { period: 'week', resetDay: 1 }; // Monday = 1
      
      const resetDate = SubscriptionService.calculateFrequencyResetDate(startDate, frequencyLimit);
      
      // Should be next Monday
      expect(resetDate.getDay()).toBe(1); // Monday
      expect(resetDate > startDate).toBe(true);
    });

    it('should calculate monthly reset correctly', () => {
      const startDate = new Date('2024-01-15');
      const frequencyLimit = { period: 'month', resetDay: 1 };
      
      const resetDate = SubscriptionService.calculateFrequencyResetDate(startDate, frequencyLimit);
      
      expect(resetDate.getDate()).toBe(1);
      expect(resetDate.getMonth()).toBe(1); // February (next month)
    });
  });
});