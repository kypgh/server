import { Subscription, ISubscription } from '../../models/Subscription';
import { Brand } from '../../models/Brand';
import { Client } from '../../models/Client';
import { SubscriptionPlan } from '../../models/SubscriptionPlan';
import { Class } from '../../models/Class';
import { setupTestDB, teardownTestDB, clearTestDB } from './testSetup';
import mongoose from 'mongoose';

describe('Subscription Model', () => {
  let testBrand: any;
  let testClient: any;
  let testSubscriptionPlan: any;
  let testClass: any;

  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    
    // Create test brand
    testBrand = await new Brand({
      name: 'Test Fitness Studio',
      email: 'test@studio.com',
      password: 'password123',
      address: {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        country: 'US'
      }
    }).save();

    // Create test client
    testClient = await new Client({
      email: 'client@test.com',
      password: 'password123',
      firstName: 'John',
      lastName: 'Doe'
    }).save();

    // Create test class
    testClass = await new Class({
      name: 'Yoga Class',
      brand: testBrand._id,
      description: 'Relaxing yoga session',
      category: 'yoga',
      difficulty: 'beginner',
      slots: 20,
      duration: 60,
      cancellationPolicy: 24
    }).save();

    // Create test subscription plan
    testSubscriptionPlan = await new SubscriptionPlan({
      brand: testBrand._id,
      name: 'Monthly Unlimited',
      price: 9900, // $99.00
      billingCycle: 'monthly',
      includedClasses: [],
      frequencyLimit: {
        count: 0, // Unlimited
        period: 'month',
        resetDay: 1
      }
    }).save();
  });

  const getValidSubscriptionData = () => {
    const now = new Date();
    const startDate = new Date(now);
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + 1);
    const nextBillingDate = new Date(endDate);
    const currentPeriodStart = new Date(startDate);
    const currentPeriodEnd = new Date(endDate);
    const frequencyResetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    return {
      client: testClient._id,
      brand: testBrand._id,
      subscriptionPlan: testSubscriptionPlan._id,
      status: 'active' as const,
      startDate,
      endDate,
      nextBillingDate,
      currentPeriodStart,
      currentPeriodEnd,
      frequencyUsed: 0,
      frequencyResetDate,
      autoRenew: true
    };
  };

  describe('Validation', () => {
    it('should create a valid subscription', async () => {
      const subscriptionData = getValidSubscriptionData();
      const subscription = new Subscription(subscriptionData);
      const savedSubscription = await subscription.save();
      
      expect(savedSubscription._id).toBeDefined();
      expect(savedSubscription.client.toString()).toBe(testClient._id.toString());
      expect(savedSubscription.brand.toString()).toBe(testBrand._id.toString());
      expect(savedSubscription.status).toBe('active');
      expect(savedSubscription.autoRenew).toBe(true);
    });

    it('should require client', async () => {
      const subscriptionData = getValidSubscriptionData();
      delete (subscriptionData as any).client;
      
      const subscription = new Subscription(subscriptionData);
      await expect(subscription.save()).rejects.toThrow('Client is required');
    });

    it('should require brand', async () => {
      const subscriptionData = getValidSubscriptionData();
      delete (subscriptionData as any).brand;
      
      const subscription = new Subscription(subscriptionData);
      await expect(subscription.save()).rejects.toThrow('Brand is required');
    });

    it('should require subscription plan', async () => {
      const subscriptionData = getValidSubscriptionData();
      delete (subscriptionData as any).subscriptionPlan;
      
      const subscription = new Subscription(subscriptionData);
      await expect(subscription.save()).rejects.toThrow('Subscription plan is required');
    });

    it('should validate status enum', async () => {
      const subscriptionData = getValidSubscriptionData();
      (subscriptionData as any).status = 'invalid';
      
      const subscription = new Subscription(subscriptionData);
      await expect(subscription.save()).rejects.toThrow('Status must be active, cancelled, expired, or pending');
    });

    it('should validate end date is after start date', async () => {
      const subscriptionData = getValidSubscriptionData();
      subscriptionData.endDate = new Date(subscriptionData.startDate.getTime() - 1000);
      
      const subscription = new Subscription(subscriptionData);
      await expect(subscription.save()).rejects.toThrow('End date must be after start date');
    });

    it('should validate current period end is after current period start', async () => {
      const subscriptionData = getValidSubscriptionData();
      subscriptionData.currentPeriodEnd = new Date(subscriptionData.currentPeriodStart.getTime() - 1000);
      
      const subscription = new Subscription(subscriptionData);
      await expect(subscription.save()).rejects.toThrow('Current period end must be after current period start');
    });

    it('should validate frequency used is non-negative', async () => {
      const subscriptionData = getValidSubscriptionData();
      (subscriptionData as any).frequencyUsed = -1;
      
      const subscription = new Subscription(subscriptionData);
      await expect(subscription.save()).rejects.toThrow('Frequency used cannot be negative');
    });

    it('should validate frequency used is integer', async () => {
      const subscriptionData = getValidSubscriptionData();
      (subscriptionData as any).frequencyUsed = 2.5;
      
      const subscription = new Subscription(subscriptionData);
      await expect(subscription.save()).rejects.toThrow('Frequency used must be a whole number');
    });

    it('should validate Stripe PaymentIntent ID format', async () => {
      const subscriptionData = getValidSubscriptionData();
      (subscriptionData as any).paymentIntentId = 'invalid_id';
      
      const subscription = new Subscription(subscriptionData);
      await expect(subscription.save()).rejects.toThrow('Invalid Stripe PaymentIntent ID format');
    });

    it('should validate Stripe Subscription ID format', async () => {
      const subscriptionData = getValidSubscriptionData();
      (subscriptionData as any).stripeSubscriptionId = 'invalid_id';
      
      const subscription = new Subscription(subscriptionData);
      await expect(subscription.save()).rejects.toThrow('Invalid Stripe Subscription ID format');
    });

    it('should allow valid Stripe IDs', async () => {
      const subscriptionData = getValidSubscriptionData();
      (subscriptionData as any).paymentIntentId = 'pi_1234567890abcdef';
      (subscriptionData as any).stripeSubscriptionId = 'sub_1234567890abcdef';
      
      const subscription = new Subscription(subscriptionData);
      const savedSubscription = await subscription.save();
      
      expect(savedSubscription.paymentIntentId).toBe('pi_1234567890abcdef');
      expect(savedSubscription.stripeSubscriptionId).toBe('sub_1234567890abcdef');
    });
  });

  describe('Business Logic Validation', () => {
    it('should reject subscription plan from different brand', async () => {
      // Create another brand and subscription plan
      const otherBrand = await new Brand({
        name: 'Other Studio',
        email: 'other@studio.com',
        password: 'password123',
        address: {
          street: '456 Other St',
          city: 'Boston',
          state: 'MA',
          zipCode: '02101',
          country: 'US'
        }
      }).save();

      const otherPlan = await new SubscriptionPlan({
        brand: otherBrand._id,
        name: 'Other Plan',
        price: 5000,
        billingCycle: 'monthly',
        includedClasses: [],
        frequencyLimit: {
          count: 10,
          period: 'month',
          resetDay: 1
        }
      }).save();

      const subscriptionData = getValidSubscriptionData();
      subscriptionData.subscriptionPlan = otherPlan._id;
      
      const subscription = new Subscription(subscriptionData);
      await expect(subscription.save()).rejects.toThrow('Subscription plan must belong to the specified brand');
    });

    it('should reject non-existent client', async () => {
      const subscriptionData = getValidSubscriptionData();
      subscriptionData.client = new mongoose.Types.ObjectId();
      
      const subscription = new Subscription(subscriptionData);
      await expect(subscription.save()).rejects.toThrow('Client not found');
    });

    it('should reject non-existent subscription plan', async () => {
      const subscriptionData = getValidSubscriptionData();
      subscriptionData.subscriptionPlan = new mongoose.Types.ObjectId();
      
      const subscription = new Subscription(subscriptionData);
      await expect(subscription.save()).rejects.toThrow('Subscription plan not found');
    });

    it('should automatically set cancelledAt when status is cancelled', async () => {
      const subscriptionData = getValidSubscriptionData();
      (subscriptionData as any).status = 'cancelled';
      
      const subscription = new Subscription(subscriptionData);
      const savedSubscription = await subscription.save();
      
      expect(savedSubscription.cancelledAt).toBeDefined();
      expect(savedSubscription.cancelledAt).toBeInstanceOf(Date);
    });

    it('should reject cancellation fields when status is not cancelled', async () => {
      const subscriptionData = getValidSubscriptionData();
      (subscriptionData as any).cancelledAt = new Date();
      (subscriptionData as any).cancellationReason = 'Test reason';
      
      const subscription = new Subscription(subscriptionData);
      await expect(subscription.save()).rejects.toThrow('Cancelled date can only be set when status is cancelled');
    });
  });

  describe('Instance Methods', () => {
    describe('isActive', () => {
      it('should return true for active subscription within date range', async () => {
        const now = new Date();
        const subscriptionData = getValidSubscriptionData();
        subscriptionData.status = 'active';
        subscriptionData.startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Yesterday
        subscriptionData.endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Tomorrow
        
        const subscription = new Subscription(subscriptionData);
        const savedSubscription = await subscription.save();
        
        expect(savedSubscription.isActive()).toBe(true);
      });

      it('should return false for cancelled subscription', async () => {
        const subscriptionData = getValidSubscriptionData();
        (subscriptionData as any).status = 'cancelled';
        
        const subscription = new Subscription(subscriptionData);
        const savedSubscription = await subscription.save();
        
        expect(savedSubscription.isActive()).toBe(false);
      });

      it('should return false for subscription not yet started', async () => {
        const now = new Date();
        const subscriptionData = getValidSubscriptionData();
        subscriptionData.status = 'active';
        subscriptionData.startDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Tomorrow
        subscriptionData.endDate = new Date(now.getTime() + 48 * 60 * 60 * 1000); // Day after tomorrow
        
        const subscription = new Subscription(subscriptionData);
        const savedSubscription = await subscription.save();
        
        expect(savedSubscription.isActive()).toBe(false);
      });

      it('should return false for expired subscription', async () => {
        const now = new Date();
        const subscriptionData = getValidSubscriptionData();
        subscriptionData.status = 'active';
        subscriptionData.startDate = new Date(now.getTime() - 48 * 60 * 60 * 1000); // Two days ago
        subscriptionData.endDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Yesterday
        
        const subscription = new Subscription(subscriptionData);
        const savedSubscription = await subscription.save();
        
        expect(savedSubscription.isActive()).toBe(false);
      });
    });

    describe('isValidForBooking', () => {
      it('should return true for active subscription within current period', async () => {
        const now = new Date();
        const subscriptionData = getValidSubscriptionData();
        subscriptionData.status = 'active';
        subscriptionData.startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        subscriptionData.endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        subscriptionData.currentPeriodStart = new Date(now.getTime() - 12 * 60 * 60 * 1000);
        subscriptionData.currentPeriodEnd = new Date(now.getTime() + 12 * 60 * 60 * 1000);
        
        const subscription = new Subscription(subscriptionData);
        const savedSubscription = await subscription.save();
        
        expect(savedSubscription.isValidForBooking()).toBe(true);
      });

      it('should return false for inactive subscription', async () => {
        const subscriptionData = getValidSubscriptionData();
        (subscriptionData as any).status = 'cancelled';
        
        const subscription = new Subscription(subscriptionData);
        const savedSubscription = await subscription.save();
        
        expect(savedSubscription.isValidForBooking()).toBe(false);
      });

      it('should return false for subscription outside current period', async () => {
        const now = new Date();
        const subscriptionData = getValidSubscriptionData();
        subscriptionData.status = 'active';
        subscriptionData.startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        subscriptionData.endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        subscriptionData.currentPeriodStart = new Date(now.getTime() + 12 * 60 * 60 * 1000); // Future period
        subscriptionData.currentPeriodEnd = new Date(now.getTime() + 36 * 60 * 60 * 1000);
        
        const subscription = new Subscription(subscriptionData);
        const savedSubscription = await subscription.save();
        
        expect(savedSubscription.isValidForBooking()).toBe(false);
      });
    });

    describe('canBookClass', () => {
      it('should return true for valid subscription with included class', async () => {
        const subscriptionData = getValidSubscriptionData();
        const subscription = new Subscription(subscriptionData);
        const savedSubscription = await subscription.save();
        
        const canBook = await savedSubscription.canBookClass(testClass._id);
        expect(canBook).toBe(true);
      });

      it('should return false for invalid subscription', async () => {
        const subscriptionData = getValidSubscriptionData();
        (subscriptionData as any).status = 'cancelled';
        
        const subscription = new Subscription(subscriptionData);
        const savedSubscription = await subscription.save();
        
        const canBook = await savedSubscription.canBookClass(testClass._id);
        expect(canBook).toBe(false);
      });

      it('should return false for class not included in plan', async () => {
        // Create a plan with specific class restrictions
        const restrictedPlan = await new SubscriptionPlan({
          brand: testBrand._id,
          name: 'Restricted Plan',
          price: 5000,
          billingCycle: 'monthly',
          includedClasses: [new mongoose.Types.ObjectId()], // Different class
          frequencyLimit: {
            count: 10,
            period: 'month',
            resetDay: 1
          }
        }).save();

        const subscriptionData = getValidSubscriptionData();
        subscriptionData.subscriptionPlan = restrictedPlan._id;
        
        const subscription = new Subscription(subscriptionData);
        const savedSubscription = await subscription.save();
        
        const canBook = await savedSubscription.canBookClass(testClass._id);
        expect(canBook).toBe(false);
      });
    });

    describe('incrementFrequencyUsage', () => {
      it('should increment frequency usage by 1', async () => {
        const subscriptionData = getValidSubscriptionData();
        subscriptionData.frequencyUsed = 5;
        
        const subscription = new Subscription(subscriptionData);
        const savedSubscription = await subscription.save();
        
        await savedSubscription.incrementFrequencyUsage();
        expect(savedSubscription.frequencyUsed).toBe(6);
      });
    });

    describe('resetFrequencyUsage', () => {
      it('should reset frequency usage to 0', async () => {
        const subscriptionData = getValidSubscriptionData();
        subscriptionData.frequencyUsed = 10;
        
        const subscription = new Subscription(subscriptionData);
        const savedSubscription = await subscription.save();
        
        await savedSubscription.resetFrequencyUsage();
        expect(savedSubscription.frequencyUsed).toBe(0);
      });

      it('should update frequency reset date for weekly period', async () => {
        // Create weekly plan
        const weeklyPlan = await new SubscriptionPlan({
          brand: testBrand._id,
          name: 'Weekly Plan',
          price: 2500,
          billingCycle: 'monthly',
          includedClasses: [],
          frequencyLimit: {
            count: 5,
            period: 'week',
            resetDay: 1 // Monday
          }
        }).save();

        const subscriptionData = getValidSubscriptionData();
        subscriptionData.subscriptionPlan = weeklyPlan._id;
        subscriptionData.frequencyUsed = 3;
        
        const subscription = new Subscription(subscriptionData);
        const savedSubscription = await subscription.save();
        
        const oldResetDate = savedSubscription.frequencyResetDate;
        await savedSubscription.resetFrequencyUsage();
        
        expect(savedSubscription.frequencyUsed).toBe(0);
        expect(savedSubscription.frequencyResetDate).not.toEqual(oldResetDate);
      });
    });

    describe('getRemainingFrequency', () => {
      it('should return remaining frequency for limited plan', async () => {
        // Create limited plan
        const limitedPlan = await new SubscriptionPlan({
          brand: testBrand._id,
          name: 'Limited Plan',
          price: 5000,
          billingCycle: 'monthly',
          includedClasses: [],
          frequencyLimit: {
            count: 10,
            period: 'month',
            resetDay: 1
          }
        }).save();

        const subscriptionData = getValidSubscriptionData();
        subscriptionData.subscriptionPlan = limitedPlan._id;
        subscriptionData.frequencyUsed = 3;
        
        const subscription = new Subscription(subscriptionData);
        const savedSubscription = await subscription.save();
        
        const remaining = await savedSubscription.getRemainingFrequency();
        expect(remaining).toBe(7);
      });

      it('should return large number for unlimited plan', async () => {
        const subscriptionData = getValidSubscriptionData();
        subscriptionData.frequencyUsed = 100;
        
        const subscription = new Subscription(subscriptionData);
        const savedSubscription = await subscription.save();
        
        const remaining = await savedSubscription.getRemainingFrequency();
        expect(remaining).toBe(Number.MAX_SAFE_INTEGER);
      });

      it('should return 0 when frequency limit is reached', async () => {
        // Create limited plan
        const limitedPlan = await new SubscriptionPlan({
          brand: testBrand._id,
          name: 'Limited Plan',
          price: 5000,
          billingCycle: 'monthly',
          includedClasses: [],
          frequencyLimit: {
            count: 5,
            period: 'month',
            resetDay: 1
          }
        }).save();

        const subscriptionData = getValidSubscriptionData();
        subscriptionData.subscriptionPlan = limitedPlan._id;
        subscriptionData.frequencyUsed = 5;
        
        const subscription = new Subscription(subscriptionData);
        const savedSubscription = await subscription.save();
        
        const remaining = await savedSubscription.getRemainingFrequency();
        expect(remaining).toBe(0);
      });
    });
  });

  describe('Indexes', () => {
    it('should have client and brand compound index', async () => {
      const indexes = await Subscription.collection.getIndexes();
      expect(indexes).toHaveProperty('client_1_brand_1');
    });

    it('should have client and status compound index', async () => {
      const indexes = await Subscription.collection.getIndexes();
      expect(indexes).toHaveProperty('client_1_status_1');
    });

    it('should have brand and status compound index', async () => {
      const indexes = await Subscription.collection.getIndexes();
      expect(indexes).toHaveProperty('brand_1_status_1');
    });

    it('should have status and endDate compound index', async () => {
      const indexes = await Subscription.collection.getIndexes();
      expect(indexes).toHaveProperty('status_1_endDate_1');
    });
  });
});