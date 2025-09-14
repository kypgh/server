import { SubscriptionPlan, ISubscriptionPlan } from '../../models/SubscriptionPlan';
import { Brand } from '../../models/Brand';
import { Class } from '../../models/Class';
import { setupTestDB, teardownTestDB, clearTestDB } from './testSetup';
import mongoose from 'mongoose';

describe('SubscriptionPlan Model', () => {
  let testBrand: any;
  let testClass1: any;
  let testClass2: any;

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

    // Create test classes
    testClass1 = await new Class({
      name: 'Yoga Class',
      brand: testBrand._id,
      description: 'Relaxing yoga session',
      category: 'yoga',
      difficulty: 'beginner',
      slots: 20,
      duration: 60,
      cancellationPolicy: 24
    }).save();

    testClass2 = await new Class({
      name: 'HIIT Class',
      brand: testBrand._id,
      description: 'High intensity interval training',
      category: 'fitness',
      difficulty: 'advanced',
      slots: 15,
      duration: 45,
      cancellationPolicy: 12
    }).save();
  });

  const validSubscriptionPlanData = {
    name: 'Monthly Unlimited',
    description: 'Unlimited access to all classes',
    price: 9999, // $99.99
    billingCycle: 'monthly' as const,
    includedClasses: [],
    frequencyLimit: {
      count: 0, // unlimited
      period: 'month' as const,
      resetDay: 1
    }
  };

  describe('Validation', () => {
    it('should create a valid subscription plan', async () => {
      const plan = new SubscriptionPlan({
        ...validSubscriptionPlanData,
        brand: testBrand._id
      });
      const savedPlan = await plan.save();
      
      expect(savedPlan._id).toBeDefined();
      expect(savedPlan.name).toBe(validSubscriptionPlanData.name);
      expect(savedPlan.price).toBe(validSubscriptionPlanData.price);
      expect(savedPlan.status).toBe('active');
      expect(savedPlan.frequencyLimit.count).toBe(0);
    });

    it('should require brand', async () => {
      const plan = new SubscriptionPlan(validSubscriptionPlanData);
      await expect(plan.save()).rejects.toThrow('Brand is required');
    });

    it('should require name', async () => {
      const planData = { ...validSubscriptionPlanData, brand: testBrand._id };
      delete (planData as any).name;
      
      const plan = new SubscriptionPlan(planData);
      await expect(plan.save()).rejects.toThrow('Plan name is required');
    });

    it('should validate name length', async () => {
      const plan = new SubscriptionPlan({
        ...validSubscriptionPlanData,
        brand: testBrand._id,
        name: 'A' // Too short
      });
      
      await expect(plan.save()).rejects.toThrow('Plan name must be at least 2 characters');
    });

    it('should validate name max length', async () => {
      const plan = new SubscriptionPlan({
        ...validSubscriptionPlanData,
        brand: testBrand._id,
        name: 'A'.repeat(101) // Too long
      });
      
      await expect(plan.save()).rejects.toThrow('Plan name cannot exceed 100 characters');
    });

    it('should require price', async () => {
      const planData = { ...validSubscriptionPlanData, brand: testBrand._id };
      delete (planData as any).price;
      
      const plan = new SubscriptionPlan(planData);
      await expect(plan.save()).rejects.toThrow('Price is required');
    });

    it('should validate price is non-negative', async () => {
      const plan = new SubscriptionPlan({
        ...validSubscriptionPlanData,
        brand: testBrand._id,
        price: -100
      });
      
      await expect(plan.save()).rejects.toThrow('Price cannot be negative');
    });

    it('should validate price is integer', async () => {
      const plan = new SubscriptionPlan({
        ...validSubscriptionPlanData,
        brand: testBrand._id,
        price: 99.99 // Should be in cents
      });
      
      await expect(plan.save()).rejects.toThrow('Price must be a whole number (in cents)');
    });

    it('should require billing cycle', async () => {
      const planData = { ...validSubscriptionPlanData, brand: testBrand._id };
      delete (planData as any).billingCycle;
      
      const plan = new SubscriptionPlan(planData);
      await expect(plan.save()).rejects.toThrow('Billing cycle is required');
    });

    it('should validate billing cycle values', async () => {
      const plan = new SubscriptionPlan({
        ...validSubscriptionPlanData,
        brand: testBrand._id,
        billingCycle: 'weekly' as any
      });
      
      await expect(plan.save()).rejects.toThrow('Billing cycle must be monthly, quarterly, or yearly');
    });

    it('should validate description max length', async () => {
      const plan = new SubscriptionPlan({
        ...validSubscriptionPlanData,
        brand: testBrand._id,
        description: 'A'.repeat(501) // Too long
      });
      
      await expect(plan.save()).rejects.toThrow('Description cannot exceed 500 characters');
    });
  });

  describe('Frequency Limit Validation', () => {
    it('should require frequency limit', async () => {
      const planData = { ...validSubscriptionPlanData, brand: testBrand._id };
      delete (planData as any).frequencyLimit;
      
      const plan = new SubscriptionPlan(planData);
      await expect(plan.save()).rejects.toThrow('Frequency limit is required');
    });

    it('should require frequency count', async () => {
      const plan = new SubscriptionPlan({
        ...validSubscriptionPlanData,
        brand: testBrand._id,
        frequencyLimit: {
          period: 'week' as const,
          resetDay: 1
        } as any
      });
      
      await expect(plan.save()).rejects.toThrow('Frequency count is required');
    });

    it('should validate frequency count is non-negative', async () => {
      const plan = new SubscriptionPlan({
        ...validSubscriptionPlanData,
        brand: testBrand._id,
        frequencyLimit: {
          count: -1,
          period: 'week' as const,
          resetDay: 1
        }
      });
      
      await expect(plan.save()).rejects.toThrow('Frequency count cannot be negative');
    });

    it('should validate frequency count is integer', async () => {
      const plan = new SubscriptionPlan({
        ...validSubscriptionPlanData,
        brand: testBrand._id,
        frequencyLimit: {
          count: 5.5,
          period: 'week' as const,
          resetDay: 1
        }
      });
      
      await expect(plan.save()).rejects.toThrow('Frequency count must be a whole number');
    });

    it('should validate period values', async () => {
      const plan = new SubscriptionPlan({
        ...validSubscriptionPlanData,
        brand: testBrand._id,
        frequencyLimit: {
          count: 5,
          period: 'daily' as any,
          resetDay: 1
        }
      });
      
      await expect(plan.save()).rejects.toThrow('Period must be week or month');
    });

    it('should validate reset day for weekly period', async () => {
      const plan = new SubscriptionPlan({
        ...validSubscriptionPlanData,
        brand: testBrand._id,
        frequencyLimit: {
          count: 5,
          period: 'week' as const,
          resetDay: 8 // Invalid for week
        }
      });
      
      await expect(plan.save()).rejects.toThrow('Reset day must be 1-7 for weekly periods or 1-31 for monthly periods');
    });

    it('should validate reset day for monthly period', async () => {
      const plan = new SubscriptionPlan({
        ...validSubscriptionPlanData,
        brand: testBrand._id,
        frequencyLimit: {
          count: 10,
          period: 'month' as const,
          resetDay: 32 // Invalid for month
        }
      });
      
      await expect(plan.save()).rejects.toThrow('Reset day must be 1-7 for weekly periods or 1-31 for monthly periods');
    });

    it('should accept valid weekly frequency limit', async () => {
      const plan = new SubscriptionPlan({
        ...validSubscriptionPlanData,
        brand: testBrand._id,
        frequencyLimit: {
          count: 3,
          period: 'week' as const,
          resetDay: 1 // Monday
        }
      });
      
      const savedPlan = await plan.save();
      expect(savedPlan.frequencyLimit.count).toBe(3);
      expect(savedPlan.frequencyLimit.period).toBe('week');
      expect(savedPlan.frequencyLimit.resetDay).toBe(1);
    });

    it('should accept valid monthly frequency limit', async () => {
      const plan = new SubscriptionPlan({
        ...validSubscriptionPlanData,
        brand: testBrand._id,
        frequencyLimit: {
          count: 12,
          period: 'month' as const,
          resetDay: 15 // 15th of month
        }
      });
      
      const savedPlan = await plan.save();
      expect(savedPlan.frequencyLimit.count).toBe(12);
      expect(savedPlan.frequencyLimit.period).toBe('month');
      expect(savedPlan.frequencyLimit.resetDay).toBe(15);
    });
  });

  describe('Class Inclusion Rules', () => {
    it('should allow empty included classes array (all classes)', async () => {
      const plan = new SubscriptionPlan({
        ...validSubscriptionPlanData,
        brand: testBrand._id,
        includedClasses: []
      });
      
      const savedPlan = await plan.save();
      expect(savedPlan.includedClasses).toHaveLength(0);
    });

    it('should allow specific classes to be included', async () => {
      const plan = new SubscriptionPlan({
        ...validSubscriptionPlanData,
        brand: testBrand._id,
        includedClasses: [testClass1._id, testClass2._id]
      });
      
      const savedPlan = await plan.save();
      expect(savedPlan.includedClasses).toHaveLength(2);
      expect(savedPlan.includedClasses).toContain(testClass1._id);
      expect(savedPlan.includedClasses).toContain(testClass2._id);
    });

    it('should reject classes from different brands', async () => {
      // Create another brand and class
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

      const otherClass = await new Class({
        name: 'Other Class',
        brand: otherBrand._id,
        description: 'Class from other brand',
        category: 'other',
        difficulty: 'beginner',
        slots: 10,
        duration: 30,
        cancellationPolicy: 24
      }).save();

      const plan = new SubscriptionPlan({
        ...validSubscriptionPlanData,
        brand: testBrand._id,
        includedClasses: [testClass1._id, otherClass._id] // Mix of brands
      });
      
      await expect(plan.save()).rejects.toThrow('All included classes must belong to the same brand');
    });
  });

  describe('Instance Methods', () => {
    describe('isClassIncluded', () => {
      it('should return true for any class when includedClasses is empty', async () => {
        const plan = new SubscriptionPlan({
          ...validSubscriptionPlanData,
          brand: testBrand._id,
          includedClasses: []
        });
        
        const savedPlan = await plan.save();
        expect(savedPlan.isClassIncluded(testClass1._id)).toBe(true);
        expect(savedPlan.isClassIncluded(testClass2._id)).toBe(true);
        expect(savedPlan.isClassIncluded(new mongoose.Types.ObjectId())).toBe(true);
      });

      it('should return true only for included classes when specific classes are set', async () => {
        const plan = new SubscriptionPlan({
          ...validSubscriptionPlanData,
          brand: testBrand._id,
          includedClasses: [testClass1._id]
        });
        
        const savedPlan = await plan.save();
        expect(savedPlan.isClassIncluded(testClass1._id)).toBe(true);
        expect(savedPlan.isClassIncluded(testClass2._id)).toBe(false);
        expect(savedPlan.isClassIncluded(new mongoose.Types.ObjectId())).toBe(false);
      });

      it('should handle ObjectId comparison correctly', async () => {
        const plan = new SubscriptionPlan({
          ...validSubscriptionPlanData,
          brand: testBrand._id,
          includedClasses: [testClass1._id, testClass2._id]
        });
        
        const savedPlan = await plan.save();
        
        // Test with ObjectId objects
        expect(savedPlan.isClassIncluded(testClass1._id)).toBe(true);
        expect(savedPlan.isClassIncluded(testClass2._id)).toBe(true);
        
        // Test with string representation
        expect(savedPlan.isClassIncluded(new mongoose.Types.ObjectId(testClass1._id.toString()))).toBe(true);
      });
    });
  });

  describe('Indexes', () => {
    it('should have brand and status compound index', async () => {
      const indexes = await SubscriptionPlan.collection.getIndexes();
      expect(indexes).toHaveProperty('brand_1_status_1');
    });

    it('should have brand and name compound index', async () => {
      const indexes = await SubscriptionPlan.collection.getIndexes();
      expect(indexes).toHaveProperty('brand_1_name_1');
    });

    it('should have status index', async () => {
      const indexes = await SubscriptionPlan.collection.getIndexes();
      expect(indexes).toHaveProperty('status_1');
    });

    it('should have price index', async () => {
      const indexes = await SubscriptionPlan.collection.getIndexes();
      expect(indexes).toHaveProperty('price_1');
    });

    it('should have billing cycle index', async () => {
      const indexes = await SubscriptionPlan.collection.getIndexes();
      expect(indexes).toHaveProperty('billingCycle_1');
    });
  });

  describe('Business Rules', () => {
    it('should create unlimited plan with count 0', async () => {
      const plan = new SubscriptionPlan({
        ...validSubscriptionPlanData,
        brand: testBrand._id,
        name: 'Unlimited Plan',
        frequencyLimit: {
          count: 0,
          period: 'month' as const,
          resetDay: 1
        }
      });
      
      const savedPlan = await plan.save();
      expect(savedPlan.frequencyLimit.count).toBe(0);
    });

    it('should create limited plan with specific count', async () => {
      const plan = new SubscriptionPlan({
        ...validSubscriptionPlanData,
        brand: testBrand._id,
        name: '8 Classes Per Month',
        frequencyLimit: {
          count: 8,
          period: 'month' as const,
          resetDay: 1
        }
      });
      
      const savedPlan = await plan.save();
      expect(savedPlan.frequencyLimit.count).toBe(8);
    });

    it('should handle different billing cycles', async () => {
      const cycles = ['monthly', 'quarterly', 'yearly'] as const;
      
      for (const cycle of cycles) {
        const plan = new SubscriptionPlan({
          ...validSubscriptionPlanData,
          brand: testBrand._id,
          name: `${cycle} Plan`,
          billingCycle: cycle
        });
        
        const savedPlan = await plan.save();
        expect(savedPlan.billingCycle).toBe(cycle);
        
        // Clean up for next iteration
        await SubscriptionPlan.deleteOne({ _id: savedPlan._id });
      }
    });
  });
});