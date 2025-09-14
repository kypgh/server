import { CreditPlan, ICreditPlan } from '../../models/CreditPlan';
import { Brand } from '../../models/Brand';
import { Class } from '../../models/Class';
import { setupTestDB, teardownTestDB, clearTestDB } from './testSetup';
import mongoose from 'mongoose';

describe('CreditPlan Model', () => {
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

  const validCreditPlanData = {
    name: '10 Credit Package',
    description: '10 credits valid for 90 days',
    price: 15000, // $150.00
    creditAmount: 10,
    validityPeriod: 90,
    bonusCredits: 2,
    includedClasses: []
  };

  describe('Validation', () => {
    it('should create a valid credit plan', async () => {
      const plan = new CreditPlan({
        ...validCreditPlanData,
        brand: testBrand._id
      });
      const savedPlan = await plan.save();
      
      expect(savedPlan._id).toBeDefined();
      expect(savedPlan.name).toBe(validCreditPlanData.name);
      expect(savedPlan.price).toBe(validCreditPlanData.price);
      expect(savedPlan.creditAmount).toBe(validCreditPlanData.creditAmount);
      expect(savedPlan.bonusCredits).toBe(validCreditPlanData.bonusCredits);
      expect(savedPlan.status).toBe('active');
    });

    it('should require brand', async () => {
      const plan = new CreditPlan(validCreditPlanData);
      await expect(plan.save()).rejects.toThrow('Brand is required');
    });

    it('should require name', async () => {
      const planData = { ...validCreditPlanData, brand: testBrand._id };
      delete (planData as any).name;
      
      const plan = new CreditPlan(planData);
      await expect(plan.save()).rejects.toThrow('Plan name is required');
    });

    it('should validate name length', async () => {
      const plan = new CreditPlan({
        ...validCreditPlanData,
        brand: testBrand._id,
        name: 'A' // Too short
      });
      
      await expect(plan.save()).rejects.toThrow('Plan name must be at least 2 characters');
    });

    it('should validate name max length', async () => {
      const plan = new CreditPlan({
        ...validCreditPlanData,
        brand: testBrand._id,
        name: 'A'.repeat(101) // Too long
      });
      
      await expect(plan.save()).rejects.toThrow('Plan name cannot exceed 100 characters');
    });

    it('should require price', async () => {
      const planData = { ...validCreditPlanData, brand: testBrand._id };
      delete (planData as any).price;
      
      const plan = new CreditPlan(planData);
      await expect(plan.save()).rejects.toThrow('Price is required');
    });

    it('should validate price is non-negative', async () => {
      const plan = new CreditPlan({
        ...validCreditPlanData,
        brand: testBrand._id,
        price: -100
      });
      
      await expect(plan.save()).rejects.toThrow('Price cannot be negative');
    });

    it('should validate price is integer', async () => {
      const plan = new CreditPlan({
        ...validCreditPlanData,
        brand: testBrand._id,
        price: 150.50 // Should be in cents
      });
      
      await expect(plan.save()).rejects.toThrow('Price must be a whole number (in cents)');
    });

    it('should require credit amount', async () => {
      const planData = { ...validCreditPlanData, brand: testBrand._id };
      delete (planData as any).creditAmount;
      
      const plan = new CreditPlan(planData);
      await expect(plan.save()).rejects.toThrow('Credit amount is required');
    });

    it('should validate credit amount minimum', async () => {
      const plan = new CreditPlan({
        ...validCreditPlanData,
        brand: testBrand._id,
        creditAmount: 0
      });
      
      await expect(plan.save()).rejects.toThrow('Credit amount must be at least 1');
    });

    it('should validate credit amount is integer', async () => {
      const plan = new CreditPlan({
        ...validCreditPlanData,
        brand: testBrand._id,
        creditAmount: 10.5
      });
      
      await expect(plan.save()).rejects.toThrow('Credit amount must be a whole number');
    });

    it('should require validity period', async () => {
      const planData = { ...validCreditPlanData, brand: testBrand._id };
      delete (planData as any).validityPeriod;
      
      const plan = new CreditPlan(planData);
      await expect(plan.save()).rejects.toThrow('Validity period is required');
    });

    it('should validate validity period minimum', async () => {
      const plan = new CreditPlan({
        ...validCreditPlanData,
        brand: testBrand._id,
        validityPeriod: 0
      });
      
      await expect(plan.save()).rejects.toThrow('Validity period must be at least 1 day');
    });

    it('should validate validity period maximum', async () => {
      const plan = new CreditPlan({
        ...validCreditPlanData,
        brand: testBrand._id,
        validityPeriod: 4000 // More than 10 years
      });
      
      await expect(plan.save()).rejects.toThrow('Validity period cannot exceed 10 years');
    });

    it('should validate validity period is integer', async () => {
      const plan = new CreditPlan({
        ...validCreditPlanData,
        brand: testBrand._id,
        validityPeriod: 90.5
      });
      
      await expect(plan.save()).rejects.toThrow('Validity period must be a whole number of days');
    });

    it('should validate bonus credits is non-negative', async () => {
      const plan = new CreditPlan({
        ...validCreditPlanData,
        brand: testBrand._id,
        bonusCredits: -1
      });
      
      await expect(plan.save()).rejects.toThrow('Bonus credits cannot be negative');
    });

    it('should validate bonus credits is integer', async () => {
      const plan = new CreditPlan({
        ...validCreditPlanData,
        brand: testBrand._id,
        bonusCredits: 2.5
      });
      
      await expect(plan.save()).rejects.toThrow('Bonus credits must be a whole number');
    });

    it('should default bonus credits to 0', async () => {
      const planData = { ...validCreditPlanData, brand: testBrand._id };
      delete (planData as any).bonusCredits;
      
      const plan = new CreditPlan(planData);
      const savedPlan = await plan.save();
      
      expect(savedPlan.bonusCredits).toBe(0);
    });

    it('should validate description max length', async () => {
      const plan = new CreditPlan({
        ...validCreditPlanData,
        brand: testBrand._id,
        description: 'A'.repeat(501) // Too long
      });
      
      await expect(plan.save()).rejects.toThrow('Description cannot exceed 500 characters');
    });
  });

  describe('Business Logic Validation', () => {
    it('should reject bonus credits exceeding base credit amount', async () => {
      const plan = new CreditPlan({
        ...validCreditPlanData,
        brand: testBrand._id,
        creditAmount: 5,
        bonusCredits: 10 // More than base amount
      });
      
      await expect(plan.save()).rejects.toThrow('Bonus credits cannot exceed base credit amount');
    });

    it('should allow bonus credits equal to base credit amount', async () => {
      const plan = new CreditPlan({
        ...validCreditPlanData,
        brand: testBrand._id,
        creditAmount: 10,
        bonusCredits: 10 // Equal to base amount
      });
      
      const savedPlan = await plan.save();
      expect(savedPlan.bonusCredits).toBe(10);
    });

    it('should allow bonus credits less than base credit amount', async () => {
      const plan = new CreditPlan({
        ...validCreditPlanData,
        brand: testBrand._id,
        creditAmount: 10,
        bonusCredits: 5 // Less than base amount
      });
      
      const savedPlan = await plan.save();
      expect(savedPlan.bonusCredits).toBe(5);
    });
  });

  describe('Class Inclusion Rules', () => {
    it('should allow empty included classes array (all classes)', async () => {
      const plan = new CreditPlan({
        ...validCreditPlanData,
        brand: testBrand._id,
        includedClasses: []
      });
      
      const savedPlan = await plan.save();
      expect(savedPlan.includedClasses).toHaveLength(0);
    });

    it('should allow specific classes to be included', async () => {
      const plan = new CreditPlan({
        ...validCreditPlanData,
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

      const plan = new CreditPlan({
        ...validCreditPlanData,
        brand: testBrand._id,
        includedClasses: [testClass1._id, otherClass._id] // Mix of brands
      });
      
      await expect(plan.save()).rejects.toThrow('All included classes must belong to the same brand');
    });
  });

  describe('Instance Methods', () => {
    describe('getTotalCredits', () => {
      it('should return sum of base credits and bonus credits', async () => {
        const plan = new CreditPlan({
          ...validCreditPlanData,
          brand: testBrand._id,
          creditAmount: 10,
          bonusCredits: 3
        });
        
        const savedPlan = await plan.save();
        expect(savedPlan.getTotalCredits()).toBe(13);
      });

      it('should return base credits when no bonus credits', async () => {
        const plan = new CreditPlan({
          ...validCreditPlanData,
          brand: testBrand._id,
          creditAmount: 10,
          bonusCredits: 0
        });
        
        const savedPlan = await plan.save();
        expect(savedPlan.getTotalCredits()).toBe(10);
      });
    });

    describe('isClassIncluded', () => {
      it('should return true for any class when includedClasses is empty', async () => {
        const plan = new CreditPlan({
          ...validCreditPlanData,
          brand: testBrand._id,
          includedClasses: []
        });
        
        const savedPlan = await plan.save();
        expect(savedPlan.isClassIncluded(testClass1._id)).toBe(true);
        expect(savedPlan.isClassIncluded(testClass2._id)).toBe(true);
        expect(savedPlan.isClassIncluded(new mongoose.Types.ObjectId())).toBe(true);
      });

      it('should return true only for included classes when specific classes are set', async () => {
        const plan = new CreditPlan({
          ...validCreditPlanData,
          brand: testBrand._id,
          includedClasses: [testClass1._id]
        });
        
        const savedPlan = await plan.save();
        expect(savedPlan.isClassIncluded(testClass1._id)).toBe(true);
        expect(savedPlan.isClassIncluded(testClass2._id)).toBe(false);
        expect(savedPlan.isClassIncluded(new mongoose.Types.ObjectId())).toBe(false);
      });

      it('should handle ObjectId comparison correctly', async () => {
        const plan = new CreditPlan({
          ...validCreditPlanData,
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

    describe('getExpiryDate', () => {
      it('should calculate expiry date from current date when no purchase date provided', async () => {
        const plan = new CreditPlan({
          ...validCreditPlanData,
          brand: testBrand._id,
          validityPeriod: 30
        });
        
        const savedPlan = await plan.save();
        const expiryDate = savedPlan.getExpiryDate();
        const expectedDate = new Date();
        expectedDate.setDate(expectedDate.getDate() + 30);
        
        // Allow for small time differences in test execution
        const timeDiff = Math.abs(expiryDate.getTime() - expectedDate.getTime());
        expect(timeDiff).toBeLessThan(1000); // Less than 1 second difference
      });

      it('should calculate expiry date from provided purchase date', async () => {
        const plan = new CreditPlan({
          ...validCreditPlanData,
          brand: testBrand._id,
          validityPeriod: 90
        });
        
        const savedPlan = await plan.save();
        const purchaseDate = new Date('2024-01-01');
        const expiryDate = savedPlan.getExpiryDate(purchaseDate);
        
        expect(expiryDate).toEqual(new Date('2024-03-31')); // 90 days from Jan 1
      });

      it('should handle leap year calculations', async () => {
        const plan = new CreditPlan({
          ...validCreditPlanData,
          brand: testBrand._id,
          validityPeriod: 60
        });
        
        const savedPlan = await plan.save();
        const purchaseDate = new Date('2024-01-01'); // 2024 is a leap year
        const expiryDate = savedPlan.getExpiryDate(purchaseDate);
        
        expect(expiryDate).toEqual(new Date('2024-03-01')); // 60 days from Jan 1 in leap year
      });

      it('should handle month boundary crossings', async () => {
        const plan = new CreditPlan({
          ...validCreditPlanData,
          brand: testBrand._id,
          validityPeriod: 45
        });
        
        const savedPlan = await plan.save();
        const purchaseDate = new Date('2024-01-15');
        const expiryDate = savedPlan.getExpiryDate(purchaseDate);
        
        expect(expiryDate).toEqual(new Date('2024-02-29')); // 45 days from Jan 15 in leap year
      });
    });
  });

  describe('Indexes', () => {
    it('should have brand and status compound index', async () => {
      const indexes = await CreditPlan.collection.getIndexes();
      expect(indexes).toHaveProperty('brand_1_status_1');
    });

    it('should have brand and name compound index', async () => {
      const indexes = await CreditPlan.collection.getIndexes();
      expect(indexes).toHaveProperty('brand_1_name_1');
    });

    it('should have status index', async () => {
      const indexes = await CreditPlan.collection.getIndexes();
      expect(indexes).toHaveProperty('status_1');
    });

    it('should have price index', async () => {
      const indexes = await CreditPlan.collection.getIndexes();
      expect(indexes).toHaveProperty('price_1');
    });

    it('should have credit amount index', async () => {
      const indexes = await CreditPlan.collection.getIndexes();
      expect(indexes).toHaveProperty('creditAmount_1');
    });

    it('should have validity period index', async () => {
      const indexes = await CreditPlan.collection.getIndexes();
      expect(indexes).toHaveProperty('validityPeriod_1');
    });
  });

  describe('Business Rules', () => {
    it('should create plan with no bonus credits', async () => {
      const plan = new CreditPlan({
        ...validCreditPlanData,
        brand: testBrand._id,
        bonusCredits: 0
      });
      
      const savedPlan = await plan.save();
      expect(savedPlan.bonusCredits).toBe(0);
      expect(savedPlan.getTotalCredits()).toBe(savedPlan.creditAmount);
    });

    it('should create plan with bonus credits', async () => {
      const plan = new CreditPlan({
        ...validCreditPlanData,
        brand: testBrand._id,
        creditAmount: 20,
        bonusCredits: 5
      });
      
      const savedPlan = await plan.save();
      expect(savedPlan.bonusCredits).toBe(5);
      expect(savedPlan.getTotalCredits()).toBe(25);
    });

    it('should handle different validity periods', async () => {
      const periods = [30, 60, 90, 180, 365];
      
      for (const period of periods) {
        const plan = new CreditPlan({
          ...validCreditPlanData,
          brand: testBrand._id,
          name: `${period} Day Plan`,
          validityPeriod: period
        });
        
        const savedPlan = await plan.save();
        expect(savedPlan.validityPeriod).toBe(period);
        
        // Clean up for next iteration
        await CreditPlan.deleteOne({ _id: savedPlan._id });
      }
    });

    it('should handle different credit amounts', async () => {
      const amounts = [1, 5, 10, 20, 50, 100];
      
      for (const amount of amounts) {
        const plan = new CreditPlan({
          ...validCreditPlanData,
          brand: testBrand._id,
          name: `${amount} Credit Plan`,
          creditAmount: amount,
          bonusCredits: Math.floor(amount * 0.1) // 10% bonus
        });
        
        const savedPlan = await plan.save();
        expect(savedPlan.creditAmount).toBe(amount);
        expect(savedPlan.getTotalCredits()).toBe(amount + Math.floor(amount * 0.1));
        
        // Clean up for next iteration
        await CreditPlan.deleteOne({ _id: savedPlan._id });
      }
    });
  });
});