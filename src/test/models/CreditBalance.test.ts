import { CreditBalance, ICreditBalance } from '../../models/CreditBalance';
import { Brand } from '../../models/Brand';
import { Client } from '../../models/Client';
import { CreditPlan } from '../../models/CreditPlan';
import { Class } from '../../models/Class';
import { setupTestDB, teardownTestDB, clearTestDB } from './testSetup';
import mongoose from 'mongoose';

describe('CreditBalance Model', () => {
  let testBrand: any;
  let testClient: any;
  let testCreditPlan: any;
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

    // Create test credit plan
    testCreditPlan = await new CreditPlan({
      brand: testBrand._id,
      name: '10 Credit Package',
      price: 15000, // $150.00
      creditAmount: 10,
      validityPeriod: 90,
      bonusCredits: 2,
      includedClasses: []
    }).save();
  });

  const getValidCreditBalanceData = () => ({
    client: testClient._id,
    brand: testBrand._id,
    availableCredits: 0,
    totalCreditsEarned: 0,
    totalCreditsUsed: 0,
    creditPackages: [],
    transactions: [],
    status: 'active' as const
  });

  describe('Validation', () => {
    it('should create a valid credit balance', async () => {
      const balanceData = getValidCreditBalanceData();
      const balance = new CreditBalance(balanceData);
      const savedBalance = await balance.save();
      
      expect(savedBalance._id).toBeDefined();
      expect(savedBalance.client.toString()).toBe(testClient._id.toString());
      expect(savedBalance.brand.toString()).toBe(testBrand._id.toString());
      expect(savedBalance.availableCredits).toBe(0);
      expect(savedBalance.status).toBe('active');
    });

    it('should require client', async () => {
      const balanceData = getValidCreditBalanceData();
      delete (balanceData as any).client;
      
      const balance = new CreditBalance(balanceData);
      await expect(balance.save()).rejects.toThrow('Client is required');
    });

    it('should require brand', async () => {
      const balanceData = getValidCreditBalanceData();
      delete (balanceData as any).brand;
      
      const balance = new CreditBalance(balanceData);
      await expect(balance.save()).rejects.toThrow('Brand is required');
    });

    it('should validate available credits is non-negative', async () => {
      const balanceData = getValidCreditBalanceData();
      (balanceData as any).availableCredits = -5;
      
      const balance = new CreditBalance(balanceData);
      await expect(balance.save()).rejects.toThrow('Available credits cannot be negative');
    });

    it('should validate available credits is integer', async () => {
      const balanceData = getValidCreditBalanceData();
      (balanceData as any).availableCredits = 5.5;
      
      const balance = new CreditBalance(balanceData);
      await expect(balance.save()).rejects.toThrow('Available credits must be a whole number');
    });

    it('should enforce unique client-brand combination', async () => {
      const balanceData = getValidCreditBalanceData();
      
      // Create first balance
      const balance1 = new CreditBalance(balanceData);
      await balance1.save();
      
      // Try to create duplicate
      const balance2 = new CreditBalance(balanceData);
      await expect(balance2.save()).rejects.toThrow();
    });

    it('should reject non-existent client', async () => {
      const balanceData = getValidCreditBalanceData();
      balanceData.client = new mongoose.Types.ObjectId();
      
      const balance = new CreditBalance(balanceData);
      await expect(balance.save()).rejects.toThrow('Client not found');
    });

    it('should reject non-existent brand', async () => {
      const balanceData = getValidCreditBalanceData();
      balanceData.brand = new mongoose.Types.ObjectId();
      
      const balance = new CreditBalance(balanceData);
      await expect(balance.save()).rejects.toThrow('Brand not found');
    });
  });

  describe('Credit Package Validation', () => {
    it('should validate credit package fields', async () => {
      const balanceData = getValidCreditBalanceData();
      (balanceData as any).creditPackages = [{
        creditPlan: testCreditPlan._id,
        purchaseDate: new Date(),
        expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        originalCredits: 12,
        creditsRemaining: 15, // More than original - should fail
        status: 'active'
      }];
      
      const balance = new CreditBalance(balanceData);
      await expect(balance.save()).rejects.toThrow('Credits remaining cannot exceed original credits');
    });

    it('should auto-update package status when credits remaining is 0', async () => {
      const balanceData = getValidCreditBalanceData();
      (balanceData as any).creditPackages = [{
        creditPlan: testCreditPlan._id,
        purchaseDate: new Date(),
        expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        originalCredits: 12,
        creditsRemaining: 0,
        status: 'active'
      }];
      
      const balance = new CreditBalance(balanceData);
      const savedBalance = await balance.save();
      
      expect(savedBalance.creditPackages[0].status).toBe('consumed');
    });

    it('should auto-update package status when expired', async () => {
      const balanceData = getValidCreditBalanceData();
      (balanceData as any).creditPackages = [{
        creditPlan: testCreditPlan._id,
        purchaseDate: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
        expiryDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // Expired
        originalCredits: 12,
        creditsRemaining: 5,
        status: 'active'
      }];
      
      const balance = new CreditBalance(balanceData);
      const savedBalance = await balance.save();
      
      expect(savedBalance.creditPackages[0].status).toBe('expired');
    });
  });

  describe('Instance Methods', () => {
    describe('addCreditPackage', () => {
      it('should add credit package and update totals', async () => {
        const balance = new CreditBalance(getValidCreditBalanceData());
        const savedBalance = await balance.save();
        
        const newPackage = await savedBalance.addCreditPackage(testCreditPlan._id, 'pi_test123');
        
        expect(newPackage.creditPlan.toString()).toBe(testCreditPlan._id.toString());
        expect(newPackage.originalCredits).toBe(12); // 10 + 2 bonus
        expect(newPackage.creditsRemaining).toBe(12);
        expect(newPackage.paymentIntentId).toBe('pi_test123');
        expect(newPackage.status).toBe('active');
        
        expect(savedBalance.availableCredits).toBe(12);
        expect(savedBalance.totalCreditsEarned).toBe(12);
        expect(savedBalance.transactions).toHaveLength(1);
        expect(savedBalance.transactions[0].type).toBe('purchase');
      });

      it('should reject credit plan from different brand', async () => {
        // Create another brand and credit plan
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

        const otherPlan = await new CreditPlan({
          brand: otherBrand._id,
          name: 'Other Plan',
          price: 5000,
          creditAmount: 5,
          validityPeriod: 30,
          bonusCredits: 0,
          includedClasses: []
        }).save();

        const balance = new CreditBalance(getValidCreditBalanceData());
        const savedBalance = await balance.save();
        
        await expect(savedBalance.addCreditPackage(otherPlan._id)).rejects.toThrow('Credit plan must belong to the same brand');
      });

      it('should reject non-existent credit plan', async () => {
        const balance = new CreditBalance(getValidCreditBalanceData());
        const savedBalance = await balance.save();
        
        await expect(savedBalance.addCreditPackage(new mongoose.Types.ObjectId())).rejects.toThrow('Credit plan not found');
      });
    });

    describe('deductCredits', () => {
      beforeEach(async () => {
        // Add some credit packages for testing
      });

      it('should deduct credits using FIFO method', async () => {
        const balance = new CreditBalance(getValidCreditBalanceData());
        const savedBalance = await balance.save();
        
        // Add two packages with different purchase dates
        const package1 = await savedBalance.addCreditPackage(testCreditPlan._id);
        
        // Create another credit plan for second package
        const creditPlan2 = await new CreditPlan({
          brand: testBrand._id,
          name: '5 Credit Package',
          price: 7500,
          creditAmount: 5,
          validityPeriod: 60,
          bonusCredits: 0,
          includedClasses: []
        }).save();
        
        // Wait a bit to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));
        const package2 = await savedBalance.addCreditPackage(creditPlan2._id);
        
        // Deduct 8 credits (should use all of first package + 3 from second)
        const bookingId = new mongoose.Types.ObjectId();
        const transactions = await savedBalance.deductCredits(8, bookingId);
        
        expect(transactions).toHaveLength(2);
        expect(savedBalance.availableCredits).toBe(9); // 17 - 8 = 9
        expect(savedBalance.totalCreditsUsed).toBe(8);
        
        // First package should be consumed
        const firstPackage = savedBalance.creditPackages.find(pkg => 
          pkg._id?.toString() === package1._id?.toString()
        );
        expect(firstPackage?.creditsRemaining).toBe(0);
        expect(firstPackage?.status).toBe('consumed');
        
        // Second package should have 2 remaining
        const secondPackage = savedBalance.creditPackages.find(pkg => 
          pkg._id?.toString() === package2._id?.toString()
        );
        expect(secondPackage?.creditsRemaining).toBe(2);
        expect(secondPackage?.status).toBe('active');
      });

      it('should reject deduction when insufficient credits', async () => {
        const balance = new CreditBalance(getValidCreditBalanceData());
        const savedBalance = await balance.save();
        
        await savedBalance.addCreditPackage(testCreditPlan._id);
        
        await expect(savedBalance.deductCredits(20)).rejects.toThrow('Insufficient credits available');
      });

      it('should reject negative deduction amount', async () => {
        const balance = new CreditBalance(getValidCreditBalanceData());
        const savedBalance = await balance.save();
        
        await expect(savedBalance.deductCredits(-5)).rejects.toThrow('Deduction amount must be positive');
      });

      it('should skip expired packages', async () => {
        const balance = new CreditBalance(getValidCreditBalanceData());
        (balance as any).creditPackages = [{
          creditPlan: testCreditPlan._id,
          purchaseDate: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
          expiryDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // Expired
          originalCredits: 10,
          creditsRemaining: 10,
          status: 'active'
        }];
        balance.availableCredits = 10;
        
        const savedBalance = await balance.save();
        
        await expect(savedBalance.deductCredits(5)).rejects.toThrow('Insufficient credits available');
      });
    });

    describe('refundCredits', () => {
      it('should refund credits to original package', async () => {
        const balance = new CreditBalance(getValidCreditBalanceData());
        const savedBalance = await balance.save();
        
        const package1 = await savedBalance.addCreditPackage(testCreditPlan._id);
        const bookingId = new mongoose.Types.ObjectId();
        
        // Deduct some credits
        await savedBalance.deductCredits(5, bookingId);
        expect(savedBalance.availableCredits).toBe(7);
        
        // Refund credits
        const refundTransaction = await savedBalance.refundCredits(3, bookingId);
        
        expect(refundTransaction.type).toBe('refund');
        expect(refundTransaction.amount).toBe(3);
        expect(savedBalance.availableCredits).toBe(10);
        expect(savedBalance.totalCreditsUsed).toBe(2);
        
        // Package should have credits restored
        const restoredPackage = savedBalance.creditPackages.find(pkg => 
          pkg._id?.toString() === package1._id?.toString()
        );
        expect(restoredPackage?.creditsRemaining).toBe(10);
      });

      it('should reject negative refund amount', async () => {
        const balance = new CreditBalance(getValidCreditBalanceData());
        const savedBalance = await balance.save();
        
        await expect(savedBalance.refundCredits(-3)).rejects.toThrow('Refund amount must be positive');
      });

      it('should handle refund when original package is expired', async () => {
        const balance = new CreditBalance(getValidCreditBalanceData());
        const savedBalance = await balance.save();
        
        // Add package and deduct credits
        await savedBalance.addCreditPackage(testCreditPlan._id);
        const bookingId = new mongoose.Types.ObjectId();
        await savedBalance.deductCredits(5, bookingId);
        
        // Manually expire the package
        savedBalance.creditPackages[0].expiryDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
        await savedBalance.save();
        
        // Add another package
        await savedBalance.addCreditPackage(testCreditPlan._id);
        
        // Refund should go to newest non-expired package
        const refundTransaction = await savedBalance.refundCredits(3, bookingId);
        
        expect(refundTransaction.type).toBe('refund');
        expect(savedBalance.availableCredits).toBe(22); // 7 + 12 + 3 refund
      });
    });

    describe('getAvailableCreditsForClass', () => {
      it('should return total credits for unrestricted plans', async () => {
        const balance = new CreditBalance(getValidCreditBalanceData());
        const savedBalance = await balance.save();
        
        await savedBalance.addCreditPackage(testCreditPlan._id);
        
        const availableCredits = await savedBalance.getAvailableCreditsForClass(testClass._id);
        expect(availableCredits).toBe(12);
      });

      it('should return 0 for classes not included in restricted plans', async () => {
        // Create restricted plan
        const restrictedPlan = await new CreditPlan({
          brand: testBrand._id,
          name: 'Restricted Plan',
          price: 5000,
          creditAmount: 5,
          validityPeriod: 30,
          bonusCredits: 0,
          includedClasses: [new mongoose.Types.ObjectId()] // Different class
        }).save();

        const balance = new CreditBalance(getValidCreditBalanceData());
        const savedBalance = await balance.save();
        
        await savedBalance.addCreditPackage(restrictedPlan._id);
        
        const availableCredits = await savedBalance.getAvailableCreditsForClass(testClass._id);
        expect(availableCredits).toBe(0);
      });

      it('should only count credits from packages that include the class', async () => {
        // Create restricted plan that includes the test class
        const restrictedPlan = await new CreditPlan({
          brand: testBrand._id,
          name: 'Restricted Plan',
          price: 5000,
          creditAmount: 5,
          validityPeriod: 30,
          bonusCredits: 0,
          includedClasses: [testClass._id]
        }).save();

        const balance = new CreditBalance(getValidCreditBalanceData());
        const savedBalance = await balance.save();
        
        // Add both unrestricted and restricted packages
        await savedBalance.addCreditPackage(testCreditPlan._id); // 12 credits, unrestricted
        await savedBalance.addCreditPackage(restrictedPlan._id); // 5 credits, restricted to testClass
        
        const availableCredits = await savedBalance.getAvailableCreditsForClass(testClass._id);
        expect(availableCredits).toBe(17); // Both packages include the class
      });
    });

    describe('cleanupExpiredPackages', () => {
      it('should mark expired packages and create expiry transactions', async () => {
        const balance = new CreditBalance(getValidCreditBalanceData());
        (balance as any).creditPackages = [
          {
            creditPlan: testCreditPlan._id,
            purchaseDate: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
            expiryDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // Expired
            originalCredits: 10,
            creditsRemaining: 7,
            status: 'active'
          },
          {
            creditPlan: testCreditPlan._id,
            purchaseDate: new Date(),
            expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Not expired
            originalCredits: 5,
            creditsRemaining: 5,
            status: 'active'
          }
        ];
        balance.availableCredits = 12;
        
        const savedBalance = await balance.save();
        const expiryTransactions = await savedBalance.cleanupExpiredPackages();
        
        expect(expiryTransactions).toHaveLength(1);
        expect(expiryTransactions[0].type).toBe('expiry');
        expect(expiryTransactions[0].amount).toBe(7);
        
        expect(savedBalance.availableCredits).toBe(5);
        expect(savedBalance.creditPackages[0].status).toBe('expired');
        expect(savedBalance.creditPackages[0].creditsRemaining).toBe(0);
        expect(savedBalance.creditPackages[1].status).toBe('active');
      });

      it('should not affect non-expired packages', async () => {
        const balance = new CreditBalance(getValidCreditBalanceData());
        (balance as any).creditPackages = [{
          creditPlan: testCreditPlan._id,
          purchaseDate: new Date(),
          expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          originalCredits: 10,
          creditsRemaining: 8,
          status: 'active'
        }];
        balance.availableCredits = 8;
        
        const savedBalance = await balance.save();
        const expiryTransactions = await savedBalance.cleanupExpiredPackages();
        
        expect(expiryTransactions).toHaveLength(0);
        expect(savedBalance.availableCredits).toBe(8);
        expect(savedBalance.creditPackages[0].status).toBe('active');
      });
    });

    describe('getExpiringCredits', () => {
      it('should return packages expiring within specified days', async () => {
        const balance = new CreditBalance(getValidCreditBalanceData());
        (balance as any).creditPackages = [
          {
            creditPlan: testCreditPlan._id,
            purchaseDate: new Date(),
            expiryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // Expires in 5 days
            originalCredits: 10,
            creditsRemaining: 7,
            status: 'active'
          },
          {
            creditPlan: testCreditPlan._id,
            purchaseDate: new Date(),
            expiryDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // Expires in 15 days
            originalCredits: 5,
            creditsRemaining: 5,
            status: 'active'
          },
          {
            creditPlan: testCreditPlan._id,
            purchaseDate: new Date(),
            expiryDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // Already expired
            originalCredits: 3,
            creditsRemaining: 3,
            status: 'active'
          }
        ];
        
        const savedBalance = await balance.save();
        
        const expiringSoon = savedBalance.getExpiringCredits(7);
        expect(expiringSoon).toHaveLength(1);
        expect(expiringSoon[0].creditsRemaining).toBe(7);
        
        const expiringLater = savedBalance.getExpiringCredits(20);
        expect(expiringLater).toHaveLength(2);
      });

      it('should not include already expired or consumed packages', async () => {
        const balance = new CreditBalance(getValidCreditBalanceData());
        (balance as any).creditPackages = [
          {
            creditPlan: testCreditPlan._id,
            purchaseDate: new Date(),
            expiryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
            originalCredits: 10,
            creditsRemaining: 0, // Consumed
            status: 'consumed'
          },
          {
            creditPlan: testCreditPlan._id,
            purchaseDate: new Date(),
            expiryDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // Expired
            originalCredits: 5,
            creditsRemaining: 5,
            status: 'expired'
          }
        ];
        
        const savedBalance = await balance.save();
        const expiring = savedBalance.getExpiringCredits(10);
        
        expect(expiring).toHaveLength(0);
      });
    });
  });

  describe('Indexes', () => {
    it('should have client and brand unique compound index', async () => {
      const indexes = await CreditBalance.collection.getIndexes();
      expect(indexes).toHaveProperty('client_1_brand_1');
    });

    it('should have client and status compound index', async () => {
      const indexes = await CreditBalance.collection.getIndexes();
      expect(indexes).toHaveProperty('client_1_status_1');
    });

    it('should have available credits index', async () => {
      const indexes = await CreditBalance.collection.getIndexes();
      expect(indexes).toHaveProperty('availableCredits_1');
    });
  });
});