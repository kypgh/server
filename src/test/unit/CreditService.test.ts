import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import CreditService from '../../services/CreditService';
import { CreditBalance } from '../../models/CreditBalance';
import { CreditPlan } from '../../models/CreditPlan';
import { Brand } from '../../models/Brand';
import { Client } from '../../models/Client';

describe('CreditService', () => {
  let mongoServer: MongoMemoryServer;
  let testBrand: any;
  let testClient: any;
  let testCreditPlan1: any;
  let testCreditPlan2: any;

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
      CreditBalance.deleteMany({}),
      CreditPlan.deleteMany({}),
      Brand.deleteMany({}),
      Client.deleteMany({})
    ]);

    // Create test brand
    testBrand = await Brand.create({
      name: 'Test Fitness Studio',
      email: 'test@studio.com',
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

    // Create test credit plans
    testCreditPlan1 = await CreditPlan.create({
      brand: testBrand._id,
      name: '10 Credit Package',
      description: 'Basic credit package',
      price: 10000, // $100 in cents
      creditAmount: 10,
      validityPeriod: 30, // 30 days
      bonusCredits: 2,
      includedClasses: [], // All classes
      status: 'active'
    });

    testCreditPlan2 = await CreditPlan.create({
      brand: testBrand._id,
      name: '5 Credit Package',
      description: 'Small credit package',
      price: 5000, // $50 in cents
      creditAmount: 5,
      validityPeriod: 15, // 15 days
      bonusCredits: 0,
      includedClasses: [], // All classes
      status: 'active'
    });
  });

  describe('purchaseCreditPlan', () => {
    it('should successfully purchase a credit plan and create credit balance', async () => {
      const result = await CreditService.purchaseCreditPlan(
        testClient._id.toString(),
        testCreditPlan1._id.toString(),
        'pi_test123'
      );

      expect(result.success).toBe(true);
      expect(result.creditBalance).toBeDefined();
      expect(result.creditPackage).toBeDefined();
      expect(result.creditBalance.availableCredits).toBe(12); // 10 + 2 bonus
      expect(result.creditBalance.totalCreditsEarned).toBe(12);
      expect(result.creditPackage.originalCredits).toBe(12);
      expect(result.creditPackage.creditsRemaining).toBe(12);
    });

    it('should add credit package to existing balance', async () => {
      // First purchase
      await CreditService.purchaseCreditPlan(
        testClient._id.toString(),
        testCreditPlan1._id.toString(),
        'pi_test123'
      );

      // Second purchase
      const result = await CreditService.purchaseCreditPlan(
        testClient._id.toString(),
        testCreditPlan2._id.toString(),
        'pi_test456'
      );

      expect(result.success).toBe(true);
      expect(result.creditBalance.availableCredits).toBe(17); // 12 + 5
      expect(result.creditBalance.totalCreditsEarned).toBe(17);
      expect(result.creditBalance.creditPackages).toHaveLength(2);
    });

    it('should throw error for non-existent client', async () => {
      const fakeClientId = new mongoose.Types.ObjectId().toString();
      
      await expect(
        CreditService.purchaseCreditPlan(
          fakeClientId,
          testCreditPlan1._id.toString()
        )
      ).rejects.toThrow('Client not found');
    });

    it('should throw error for non-existent credit plan', async () => {
      const fakePlanId = new mongoose.Types.ObjectId().toString();
      
      await expect(
        CreditService.purchaseCreditPlan(
          testClient._id.toString(),
          fakePlanId
        )
      ).rejects.toThrow('Credit plan not found');
    });

    it('should throw error for inactive credit plan', async () => {
      testCreditPlan1.status = 'inactive';
      await testCreditPlan1.save();
      
      await expect(
        CreditService.purchaseCreditPlan(
          testClient._id.toString(),
          testCreditPlan1._id.toString()
        )
      ).rejects.toThrow('Credit plan is not active');
    });
  });

  describe('deductCredits - FIFO Algorithm', () => {
    beforeEach(async () => {
      // Create credit balance with multiple packages
      const creditBalance = new CreditBalance({
        client: testClient._id,
        brand: testBrand._id,
        availableCredits: 0,
        totalCreditsEarned: 0,
        totalCreditsUsed: 0,
        creditPackages: [],
        transactions: [],
        status: 'active'
      });

      // Add first package (older, expires later) - use future dates
      const now = new Date();
      const package1Date = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      const package1ExpiryDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
      creditBalance.creditPackages.push({
        creditPlan: testCreditPlan1._id,
        purchaseDate: package1Date,
        expiryDate: package1ExpiryDate,
        originalCredits: 10,
        creditsRemaining: 10,
        status: 'active'
      });

      // Add second package (newer, expires sooner)
      const package2Date = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000); // 15 days ago
      const package2ExpiryDate = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000); // 15 days from now
      creditBalance.creditPackages.push({
        creditPlan: testCreditPlan2._id,
        purchaseDate: package2Date,
        expiryDate: package2ExpiryDate,
        originalCredits: 5,
        creditsRemaining: 5,
        status: 'active'
      });

      creditBalance.availableCredits = 15;
      creditBalance.totalCreditsEarned = 15;
      await creditBalance.save();
    });

    it('should deduct credits from oldest package first (FIFO)', async () => {
      const result = await CreditService.deductCredits(
        testClient._id.toString(),
        testBrand._id.toString(),
        3
      );

      expect(result.success).toBe(true);
      expect(result.transactions).toHaveLength(1);
      expect(result.remainingCredits).toBe(12);

      // Check that credits were deducted from the first (oldest) package
      const updatedBalance = await CreditBalance.findOne({
        client: testClient._id,
        brand: testBrand._id
      });

      expect(updatedBalance!.creditPackages[0].creditsRemaining).toBe(7); // 10 - 3
      expect(updatedBalance!.creditPackages[1].creditsRemaining).toBe(5); // unchanged
    });

    it('should deduct from multiple packages when first package is insufficient', async () => {
      const result = await CreditService.deductCredits(
        testClient._id.toString(),
        testBrand._id.toString(),
        12 // More than first package has
      );

      expect(result.success).toBe(true);
      expect(result.transactions).toHaveLength(2); // Two packages used
      expect(result.remainingCredits).toBe(3);

      const updatedBalance = await CreditBalance.findOne({
        client: testClient._id,
        brand: testBrand._id
      });

      expect(updatedBalance!.creditPackages[0].creditsRemaining).toBe(0); // Fully consumed
      expect(updatedBalance!.creditPackages[0].status).toBe('consumed');
      expect(updatedBalance!.creditPackages[1].creditsRemaining).toBe(3); // 5 - 2
    });

    it('should throw error when insufficient credits available', async () => {
      await expect(
        CreditService.deductCredits(
          testClient._id.toString(),
          testBrand._id.toString(),
          20 // More than available (15)
        )
      ).rejects.toThrow('Insufficient credits available');
    });

    it('should skip expired packages during deduction', async () => {
      // Manually expire the first package
      const creditBalance = await CreditBalance.findOne({
        client: testClient._id,
        brand: testBrand._id
      });

      // Update the first package to be expired
      creditBalance!.creditPackages[0].status = 'expired';
      creditBalance!.creditPackages[0].creditsRemaining = 0;
      creditBalance!.availableCredits = 5; // Only second package
      await creditBalance!.save();

      const result = await CreditService.deductCredits(
        testClient._id.toString(),
        testBrand._id.toString(),
        3
      );

      expect(result.success).toBe(true);
      expect(result.remainingCredits).toBe(2);

      const updatedBalance = await CreditBalance.findOne({
        client: testClient._id,
        brand: testBrand._id
      });

      // First package should remain unchanged (expired)
      expect(updatedBalance!.creditPackages[0].creditsRemaining).toBe(0);
      // Second package should be used
      expect(updatedBalance!.creditPackages[1].creditsRemaining).toBe(2);
    });

    it('should create proper transaction records', async () => {
      const bookingId = new mongoose.Types.ObjectId().toString();
      
      const result = await CreditService.deductCredits(
        testClient._id.toString(),
        testBrand._id.toString(),
        3,
        bookingId
      );

      expect(result.transactions[0].type).toBe('deduction');
      expect(result.transactions[0].amount).toBe(3);
      expect(result.transactions[0].bookingId?.toString()).toBe(bookingId);
      expect(result.transactions[0].description).toContain('Used 3 credits');
    });
  });

  describe('refundCredits', () => {
    let creditBalance: any;
    let bookingId: string;

    beforeEach(async () => {
      bookingId = new mongoose.Types.ObjectId().toString();
      
      // Create and purchase credits
      await CreditService.purchaseCreditPlan(
        testClient._id.toString(),
        testCreditPlan1._id.toString()
      );

      // Deduct some credits
      await CreditService.deductCredits(
        testClient._id.toString(),
        testBrand._id.toString(),
        5,
        bookingId
      );

      creditBalance = await CreditBalance.findOne({
        client: testClient._id,
        brand: testBrand._id
      });
    });

    it('should refund credits to original package', async () => {
      const transaction = await CreditService.refundCredits(
        testClient._id.toString(),
        testBrand._id.toString(),
        3,
        bookingId
      );

      expect(transaction.type).toBe('refund');
      expect(transaction.amount).toBe(3);

      const updatedBalance = await CreditBalance.findOne({
        client: testClient._id,
        brand: testBrand._id
      });

      expect(updatedBalance!.availableCredits).toBe(10); // 7 + 3 refunded
      expect(updatedBalance!.creditPackages[0].creditsRemaining).toBe(10); // 7 + 3
    });

    it('should not exceed original package amount during refund', async () => {
      // Try to refund more than was deducted from the package
      const transaction = await CreditService.refundCredits(
        testClient._id.toString(),
        testBrand._id.toString(),
        10, // More than the 5 that were deducted
        bookingId
      );

      expect(transaction.amount).toBe(10); // Full refund amount recorded

      const updatedBalance = await CreditBalance.findOne({
        client: testClient._id,
        brand: testBrand._id
      });

      // Should not exceed original package size
      expect(updatedBalance!.creditPackages[0].creditsRemaining).toBe(12); // Back to original
      expect(updatedBalance!.availableCredits).toBe(17); // 7 + 10 refunded
    });
  });

  describe('getCreditBalance', () => {
    beforeEach(async () => {
      await CreditService.purchaseCreditPlan(
        testClient._id.toString(),
        testCreditPlan1._id.toString()
      );
    });

    it('should return credit balance information', async () => {
      const balance = await CreditService.getCreditBalance(
        testClient._id.toString(),
        testBrand._id.toString()
      );

      expect(balance.availableCredits).toBe(12);
      expect(balance.totalCreditsEarned).toBe(12);
      expect(balance.totalCreditsUsed).toBe(0);
      expect(balance.creditPackages).toHaveLength(1);
      expect(balance.expiringCredits).toHaveLength(0); // Not expiring within 7 days
    });

    it('should throw error for non-existent balance', async () => {
      const fakeBrandId = new mongoose.Types.ObjectId().toString();
      
      await expect(
        CreditService.getCreditBalance(
          testClient._id.toString(),
          fakeBrandId
        )
      ).rejects.toThrow('No credit balance found for this brand');
    });
  });

  describe('cleanupExpiredPackages', () => {
    beforeEach(async () => {
      // Create credit balance with expired package
      const now = new Date();
      const expiredDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Yesterday
      const purchaseDate = new Date(now.getTime() - 32 * 24 * 60 * 60 * 1000); // 32 days ago
      
      const creditBalance = new CreditBalance({
        client: testClient._id,
        brand: testBrand._id,
        availableCredits: 10,
        totalCreditsEarned: 10,
        totalCreditsUsed: 0,
        creditPackages: [{
          creditPlan: testCreditPlan1._id,
          purchaseDate: purchaseDate,
          expiryDate: expiredDate, // Expired yesterday
          originalCredits: 10,
          creditsRemaining: 10,
          status: 'active'
        }],
        transactions: [],
        status: 'active'
      });

      await creditBalance.save();
    });

    it('should cleanup expired packages and update available credits', async () => {
      // First, let's manually create a balance with an active package that will expire
      const creditBalance = await CreditBalance.findOne({
        client: testClient._id,
        brand: testBrand._id
      });

      // Manually set the expiry date to past without triggering pre-save middleware
      await CreditBalance.updateOne(
        { _id: creditBalance!._id, 'creditPackages._id': creditBalance!.creditPackages[0]._id },
        { 
          $set: { 
            'creditPackages.$.expiryDate': new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
            'creditPackages.$.status': 'active' // Keep it active
          }
        }
      );

      await CreditService.cleanupExpiredPackages();

      const updatedBalance = await CreditBalance.findOne({
        client: testClient._id,
        brand: testBrand._id
      });

      expect(updatedBalance!.availableCredits).toBe(0);
      expect(updatedBalance!.creditPackages[0].status).toBe('expired');
      expect(updatedBalance!.creditPackages[0].creditsRemaining).toBe(0);
      expect(updatedBalance!.transactions.length).toBeGreaterThan(0);
      
      // Find the expiry transaction
      const expiryTransaction = updatedBalance!.transactions.find(t => t.type === 'expiry');
      expect(expiryTransaction).toBeDefined();
    });
  });

  describe('validateCreditEligibility', () => {
    beforeEach(async () => {
      await CreditService.purchaseCreditPlan(
        testClient._id.toString(),
        testCreditPlan1._id.toString()
      );
    });

    it('should return eligible when sufficient credits available', async () => {
      const fakeClassId = new mongoose.Types.ObjectId().toString();
      
      const eligibility = await CreditService.validateCreditEligibility(
        testClient._id.toString(),
        testBrand._id.toString(),
        fakeClassId,
        5
      );

      expect(eligibility.eligible).toBe(true);
      expect(eligibility.availableCredits).toBe(12);
    });

    it('should return not eligible when insufficient credits', async () => {
      const fakeClassId = new mongoose.Types.ObjectId().toString();
      
      const eligibility = await CreditService.validateCreditEligibility(
        testClient._id.toString(),
        testBrand._id.toString(),
        fakeClassId,
        15 // More than available
      );

      expect(eligibility.eligible).toBe(false);
      expect(eligibility.availableCredits).toBe(12);
      expect(eligibility.message).toContain('Insufficient credits');
    });
  });
});