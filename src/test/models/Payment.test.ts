import { Payment, IPayment } from '../../models/Payment';
import { Brand } from '../../models/Brand';
import { Client } from '../../models/Client';
import { Subscription } from '../../models/Subscription';
import { CreditBalance } from '../../models/CreditBalance';
import { SubscriptionPlan } from '../../models/SubscriptionPlan';
import { setupTestDB, teardownTestDB, clearTestDB } from './testSetup';
import mongoose from 'mongoose';

describe('Payment Model', () => {
  let testBrand: any;
  let testClient: any;
  let testSubscription: any;
  let testCreditBalance: any;

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

    // Create test subscription plan
    const subscriptionPlan = await new SubscriptionPlan({
      brand: testBrand._id,
      name: 'Monthly Unlimited',
      price: 9900,
      billingCycle: 'monthly',
      includedClasses: [],
      frequencyLimit: {
        count: 0,
        period: 'month',
        resetDay: 1
      }
    }).save();

    // Create test subscription
    const now = new Date();
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + 1);
    
    testSubscription = await new Subscription({
      client: testClient._id,
      brand: testBrand._id,
      subscriptionPlan: subscriptionPlan._id,
      status: 'active',
      startDate: now,
      endDate: endDate,
      nextBillingDate: endDate,
      currentPeriodStart: now,
      currentPeriodEnd: endDate,
      frequencyUsed: 0,
      frequencyResetDate: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      autoRenew: true
    }).save();

    // Create test credit balance
    testCreditBalance = await new CreditBalance({
      client: testClient._id,
      brand: testBrand._id,
      availableCredits: 0,
      totalCreditsEarned: 0,
      totalCreditsUsed: 0,
      creditPackages: [],
      transactions: [],
      status: 'active'
    }).save();
  });

  const getValidPaymentData = (type: 'subscription' | 'credit_purchase' | 'refund' = 'subscription') => {
    const baseData = {
      client: testClient._id,
      brand: testBrand._id,
      type,
      status: 'pending' as const,
      amount: 9900, // $99.00
      currency: 'USD',
      paymentIntentId: 'pi_1234567890abcdef',
      metadata: {
        clientId: testClient._id,
        brandId: testBrand._id
      },
      stripeEvents: []
    };

    if (type === 'subscription') {
      return {
        ...baseData,
        subscriptionId: testSubscription._id,
        metadata: {
          ...baseData.metadata,
          subscriptionPlanId: testSubscription.subscriptionPlan
        }
      };
    } else if (type === 'credit_purchase') {
      return {
        ...baseData,
        creditBalanceId: testCreditBalance._id,
        metadata: {
          ...baseData.metadata,
          creditPlanId: new mongoose.Types.ObjectId()
        }
      };
    }

    return baseData;
  };

  describe('Validation', () => {
    it('should create a valid subscription payment', async () => {
      const paymentData = getValidPaymentData('subscription');
      const payment = new Payment(paymentData);
      const savedPayment = await payment.save();
      
      expect(savedPayment._id).toBeDefined();
      expect(savedPayment.client.toString()).toBe(testClient._id.toString());
      expect(savedPayment.brand.toString()).toBe(testBrand._id.toString());
      expect(savedPayment.type).toBe('subscription');
      expect(savedPayment.status).toBe('pending');
      expect(savedPayment.amount).toBe(9900);
      expect(savedPayment.currency).toBe('USD');
    });

    it('should create a valid credit purchase payment', async () => {
      const paymentData = getValidPaymentData('credit_purchase');
      const payment = new Payment(paymentData);
      const savedPayment = await payment.save();
      
      expect(savedPayment.type).toBe('credit_purchase');
      expect(savedPayment.creditBalanceId?.toString()).toBe(testCreditBalance._id.toString());
    });

    it('should require client', async () => {
      const paymentData = getValidPaymentData();
      delete (paymentData as any).client;
      
      const payment = new Payment(paymentData);
      await expect(payment.save()).rejects.toThrow('Client is required');
    });

    it('should require brand', async () => {
      const paymentData = getValidPaymentData();
      delete (paymentData as any).brand;
      
      const payment = new Payment(paymentData);
      await expect(payment.save()).rejects.toThrow('Brand is required');
    });

    it('should require payment type', async () => {
      const paymentData = getValidPaymentData();
      delete (paymentData as any).type;
      
      const payment = new Payment(paymentData);
      await expect(payment.save()).rejects.toThrow('Payment type is required');
    });

    it('should validate payment type enum', async () => {
      const paymentData = getValidPaymentData();
      (paymentData as any).type = 'invalid';
      
      const payment = new Payment(paymentData);
      await expect(payment.save()).rejects.toThrow('Type must be subscription, credit_purchase, or refund');
    });

    it('should validate status enum', async () => {
      const paymentData = getValidPaymentData();
      (paymentData as any).status = 'invalid';
      
      const payment = new Payment(paymentData);
      await expect(payment.save()).rejects.toThrow('Status must be pending, processing, succeeded, failed, cancelled, or refunded');
    });

    it('should require amount', async () => {
      const paymentData = getValidPaymentData();
      delete (paymentData as any).amount;
      
      const payment = new Payment(paymentData);
      await expect(payment.save()).rejects.toThrow('Amount is required');
    });

    it('should validate amount is non-negative', async () => {
      const paymentData = getValidPaymentData();
      (paymentData as any).amount = -100;
      
      const payment = new Payment(paymentData);
      await expect(payment.save()).rejects.toThrow('Amount cannot be negative');
    });

    it('should validate amount is integer', async () => {
      const paymentData = getValidPaymentData();
      (paymentData as any).amount = 99.50;
      
      const payment = new Payment(paymentData);
      await expect(payment.save()).rejects.toThrow('Amount must be a whole number (in cents)');
    });

    it('should require currency', async () => {
      const paymentData = getValidPaymentData();
      delete (paymentData as any).currency;
      
      const payment = new Payment(paymentData);
      await expect(payment.save()).rejects.toThrow('Currency is required');
    });

    it('should validate currency format', async () => {
      const paymentData = getValidPaymentData();
      (paymentData as any).currency = 'invalid';
      
      const payment = new Payment(paymentData);
      await expect(payment.save()).rejects.toThrow('Currency must be a valid 3-letter ISO code');
    });

    it('should require payment intent ID', async () => {
      const paymentData = getValidPaymentData();
      delete (paymentData as any).paymentIntentId;
      
      const payment = new Payment(paymentData);
      await expect(payment.save()).rejects.toThrow('Payment Intent ID is required');
    });

    it('should validate payment intent ID format', async () => {
      const paymentData = getValidPaymentData();
      (paymentData as any).paymentIntentId = 'invalid_id';
      
      const payment = new Payment(paymentData);
      await expect(payment.save()).rejects.toThrow('Invalid Stripe PaymentIntent ID format');
    });

    it('should enforce unique payment intent ID', async () => {
      const paymentData = getValidPaymentData();
      
      // Create first payment
      const payment1 = new Payment(paymentData);
      await payment1.save();
      
      // Try to create duplicate
      const payment2 = new Payment({
        ...paymentData,
        paymentIntentId: paymentData.paymentIntentId
      });
      await expect(payment2.save()).rejects.toThrow();
    });

    it('should validate Stripe PaymentMethod ID format', async () => {
      const paymentData = getValidPaymentData();
      (paymentData as any).paymentMethodId = 'invalid_id';
      
      const payment = new Payment(paymentData);
      await expect(payment.save()).rejects.toThrow('Invalid Stripe PaymentMethod ID format');
    });

    it('should validate Stripe Customer ID format', async () => {
      const paymentData = getValidPaymentData();
      (paymentData as any).stripeCustomerId = 'invalid_id';
      
      const payment = new Payment(paymentData);
      await expect(payment.save()).rejects.toThrow('Invalid Stripe Customer ID format');
    });

    it('should allow valid Stripe IDs', async () => {
      const paymentData = getValidPaymentData();
      (paymentData as any).paymentMethodId = 'pm_1234567890abcdef';
      (paymentData as any).stripeCustomerId = 'cus_1234567890abcdef';
      
      const payment = new Payment(paymentData);
      const savedPayment = await payment.save();
      
      expect(savedPayment.paymentMethodId).toBe('pm_1234567890abcdef');
      expect(savedPayment.stripeCustomerId).toBe('cus_1234567890abcdef');
    });
  });

  describe('Business Logic Validation', () => {
    it('should require subscription ID for subscription payments', async () => {
      const paymentData = getValidPaymentData('subscription');
      delete (paymentData as any).subscriptionId;
      
      const payment = new Payment(paymentData);
      await expect(payment.save()).rejects.toThrow('Subscription ID is required for subscription payments');
    });

    it('should require credit balance ID for credit purchase payments', async () => {
      const paymentData = getValidPaymentData('credit_purchase');
      delete (paymentData as any).creditBalanceId;
      
      const payment = new Payment(paymentData);
      await expect(payment.save()).rejects.toThrow('Credit Balance ID is required for credit purchase payments');
    });

    it('should reject non-existent client', async () => {
      const paymentData = getValidPaymentData();
      paymentData.client = new mongoose.Types.ObjectId();
      
      const payment = new Payment(paymentData);
      await expect(payment.save()).rejects.toThrow('Client not found');
    });

    it('should reject non-existent brand', async () => {
      const paymentData = getValidPaymentData();
      paymentData.brand = new mongoose.Types.ObjectId();
      
      const payment = new Payment(paymentData);
      await expect(payment.save()).rejects.toThrow('Brand not found');
    });

    it('should validate refunded amount does not exceed original amount', async () => {
      const paymentData = getValidPaymentData();
      (paymentData as any).refundedAmount = 15000; // More than original amount
      
      const payment = new Payment(paymentData);
      await expect(payment.save()).rejects.toThrow('Refunded amount cannot exceed original payment amount');
    });

    it('should auto-set processed date for completed payments', async () => {
      const paymentData = getValidPaymentData();
      (paymentData as any).status = 'succeeded';
      
      const payment = new Payment(paymentData);
      const savedPayment = await payment.save();
      
      expect(savedPayment.processedAt).toBeDefined();
      expect(savedPayment.processedAt).toBeInstanceOf(Date);
    });

    it('should auto-set refunded date for refunded payments', async () => {
      const paymentData = getValidPaymentData();
      (paymentData as any).status = 'refunded';
      (paymentData as any).refundedAmount = 5000;
      
      const payment = new Payment(paymentData);
      const savedPayment = await payment.save();
      
      expect(savedPayment.refundedAt).toBeDefined();
      expect(savedPayment.refundedAt).toBeInstanceOf(Date);
    });

    it('should validate refund reason only for refunded payments', async () => {
      const paymentData = getValidPaymentData();
      (paymentData as any).refundReason = 'Customer request';
      
      const payment = new Payment(paymentData);
      await expect(payment.save()).rejects.toThrow('Refund reason can only be set when payment is refunded');
    });

    it('should validate failure reason only for failed payments', async () => {
      const paymentData = getValidPaymentData();
      (paymentData as any).failureReason = 'Insufficient funds';
      
      const payment = new Payment(paymentData);
      await expect(payment.save()).rejects.toThrow('Failure reason can only be set when payment status is failed');
    });
  });

  describe('Instance Methods', () => {
    describe('isSuccessful', () => {
      it('should return true for succeeded payments', async () => {
        const paymentData = getValidPaymentData();
        (paymentData as any).status = 'succeeded';
        
        const payment = new Payment(paymentData);
        const savedPayment = await payment.save();
        
        expect(savedPayment.isSuccessful()).toBe(true);
      });

      it('should return false for non-succeeded payments', async () => {
        const statuses = ['pending', 'processing', 'failed', 'cancelled', 'refunded'];
        
        for (const status of statuses) {
          const paymentData = getValidPaymentData();
          paymentData.status = status as any;
          paymentData.paymentIntentId = `pi_test_${status}`;
          
          const payment = new Payment(paymentData);
          const savedPayment = await payment.save();
          
          expect(savedPayment.isSuccessful()).toBe(false);
          
          // Clean up for next iteration
          await Payment.deleteOne({ _id: savedPayment._id });
        }
      });
    });

    describe('canBeRefunded', () => {
      it('should return true for succeeded payments with no refunds', async () => {
        const paymentData = getValidPaymentData();
        (paymentData as any).status = 'succeeded';
        
        const payment = new Payment(paymentData);
        const savedPayment = await payment.save();
        
        expect(savedPayment.canBeRefunded()).toBe(true);
      });

      it('should return true for partially refunded payments', async () => {
        const paymentData = getValidPaymentData();
        (paymentData as any).status = 'succeeded';
        (paymentData as any).refundedAmount = 5000; // Partial refund
        
        const payment = new Payment(paymentData);
        const savedPayment = await payment.save();
        
        expect(savedPayment.canBeRefunded()).toBe(true);
      });

      it('should return false for fully refunded payments', async () => {
        const paymentData = getValidPaymentData();
        (paymentData as any).status = 'succeeded';
        (paymentData as any).refundedAmount = 9900; // Full refund
        
        const payment = new Payment(paymentData);
        const savedPayment = await payment.save();
        
        expect(savedPayment.canBeRefunded()).toBe(false);
      });

      it('should return false for non-succeeded payments', async () => {
        const paymentData = getValidPaymentData();
        (paymentData as any).status = 'failed';
        
        const payment = new Payment(paymentData);
        const savedPayment = await payment.save();
        
        expect(savedPayment.canBeRefunded()).toBe(false);
      });
    });

    describe('getRefundableAmount', () => {
      it('should return full amount for unrefunded succeeded payment', async () => {
        const paymentData = getValidPaymentData();
        (paymentData as any).status = 'succeeded';
        
        const payment = new Payment(paymentData);
        const savedPayment = await payment.save();
        
        expect(savedPayment.getRefundableAmount()).toBe(9900);
      });

      it('should return remaining amount for partially refunded payment', async () => {
        const paymentData = getValidPaymentData();
        (paymentData as any).status = 'succeeded';
        (paymentData as any).refundedAmount = 3000;
        
        const payment = new Payment(paymentData);
        const savedPayment = await payment.save();
        
        expect(savedPayment.getRefundableAmount()).toBe(6900);
      });

      it('should return 0 for fully refunded payment', async () => {
        const paymentData = getValidPaymentData();
        (paymentData as any).status = 'succeeded';
        (paymentData as any).refundedAmount = 9900;
        
        const payment = new Payment(paymentData);
        const savedPayment = await payment.save();
        
        expect(savedPayment.getRefundableAmount()).toBe(0);
      });

      it('should return 0 for non-refundable payment', async () => {
        const paymentData = getValidPaymentData();
        (paymentData as any).status = 'failed';
        
        const payment = new Payment(paymentData);
        const savedPayment = await payment.save();
        
        expect(savedPayment.getRefundableAmount()).toBe(0);
      });
    });

    describe('addStripeEvent', () => {
      it('should add new Stripe event', async () => {
        const paymentData = getValidPaymentData();
        const payment = new Payment(paymentData);
        const savedPayment = await payment.save();
        
        savedPayment.addStripeEvent('evt_test123', 'payment_intent.succeeded', { test: 'data' });
        
        expect(savedPayment.stripeEvents).toHaveLength(1);
        expect(savedPayment.stripeEvents[0].eventId).toBe('evt_test123');
        expect(savedPayment.stripeEvents[0].eventType).toBe('payment_intent.succeeded');
        expect(savedPayment.stripeEvents[0].data).toEqual({ test: 'data' });
        expect(savedPayment.stripeEvents[0].processedAt).toBeInstanceOf(Date);
      });

      it('should not add duplicate events', async () => {
        const paymentData = getValidPaymentData();
        const payment = new Payment(paymentData);
        const savedPayment = await payment.save();
        
        savedPayment.addStripeEvent('evt_test123', 'payment_intent.succeeded');
        savedPayment.addStripeEvent('evt_test123', 'payment_intent.succeeded'); // Duplicate
        
        expect(savedPayment.stripeEvents).toHaveLength(1);
      });

      it('should add multiple different events', async () => {
        const paymentData = getValidPaymentData();
        const payment = new Payment(paymentData);
        const savedPayment = await payment.save();
        
        savedPayment.addStripeEvent('evt_test123', 'payment_intent.created');
        savedPayment.addStripeEvent('evt_test456', 'payment_intent.succeeded');
        
        expect(savedPayment.stripeEvents).toHaveLength(2);
        expect(savedPayment.stripeEvents[0].eventId).toBe('evt_test123');
        expect(savedPayment.stripeEvents[1].eventId).toBe('evt_test456');
      });
    });
  });

  describe('Static Methods', () => {
    describe('findByPaymentIntentId', () => {
      it('should find payment by PaymentIntent ID', async () => {
        const paymentData = getValidPaymentData();
        const payment = new Payment(paymentData);
        await payment.save();
        
        const foundPayment = await Payment.findByPaymentIntentId('pi_1234567890abcdef');
        
        expect(foundPayment).toBeDefined();
        expect(foundPayment?._id.toString()).toBe(payment._id.toString());
      });

      it('should return null for non-existent PaymentIntent ID', async () => {
        const foundPayment = await Payment.findByPaymentIntentId('pi_nonexistent');
        expect(foundPayment).toBeNull();
      });
    });

    describe('getPaymentStats', () => {
      beforeEach(async () => {
        // Create test payments
        const payments = [
          { status: 'succeeded', amount: 10000 },
          { status: 'succeeded', amount: 15000 },
          { status: 'failed', amount: 5000 },
          { status: 'pending', amount: 8000 }
        ];

        for (let i = 0; i < payments.length; i++) {
          const paymentData = getValidPaymentData();
          paymentData.status = payments[i].status as any;
          paymentData.amount = payments[i].amount;
          paymentData.paymentIntentId = `pi_test_stats_${i}`;
          
          const payment = new Payment(paymentData);
          await payment.save();
        }
      });

      it('should return payment statistics for brand', async () => {
        const stats = await Payment.getPaymentStats(testBrand._id);
        
        expect(stats).toHaveLength(3); // 3 different statuses
        
        const succeededStats = stats.find((s: any) => s._id === 'succeeded');
        expect(succeededStats?.count).toBe(2);
        expect(succeededStats?.totalAmount).toBe(25000);
        expect(succeededStats?.avgAmount).toBe(12500);
        
        const failedStats = stats.find((s: any) => s._id === 'failed');
        expect(failedStats?.count).toBe(1);
        expect(failedStats?.totalAmount).toBe(5000);
        
        const pendingStats = stats.find((s: any) => s._id === 'pending');
        expect(pendingStats?.count).toBe(1);
        expect(pendingStats?.totalAmount).toBe(8000);
      });
    });

    describe('getClientPaymentStats', () => {
      beforeEach(async () => {
        // Create test payments with different types
        const payments = [
          { type: 'subscription', status: 'succeeded', amount: 10000 },
          { type: 'credit_purchase', status: 'succeeded', amount: 15000 },
          { type: 'subscription', status: 'failed', amount: 10000 }
        ];

        for (let i = 0; i < payments.length; i++) {
          const paymentData = getValidPaymentData(payments[i].type as any);
          paymentData.status = payments[i].status as any;
          paymentData.amount = payments[i].amount;
          paymentData.paymentIntentId = `pi_test_client_stats_${i}`;
          
          const payment = new Payment(paymentData);
          await payment.save();
        }
      });

      it('should return client payment statistics', async () => {
        const stats = await Payment.getClientPaymentStats(testClient._id);
        
        expect(stats).toHaveLength(3); // 3 different type-status combinations
        
        const subscriptionSucceeded = stats.find((s: any) => 
          s._id.type === 'subscription' && s._id.status === 'succeeded'
        );
        expect(subscriptionSucceeded?.count).toBe(1);
        expect(subscriptionSucceeded?.totalAmount).toBe(10000);
        
        const creditSucceeded = stats.find((s: any) => 
          s._id.type === 'credit_purchase' && s._id.status === 'succeeded'
        );
        expect(creditSucceeded?.count).toBe(1);
        expect(creditSucceeded?.totalAmount).toBe(15000);
        
        const subscriptionFailed = stats.find((s: any) => 
          s._id.type === 'subscription' && s._id.status === 'failed'
        );
        expect(subscriptionFailed?.count).toBe(1);
        expect(subscriptionFailed?.totalAmount).toBe(10000);
      });
    });
  });

  describe('Indexes', () => {
    it('should have client and status compound index', async () => {
      const indexes = await Payment.collection.getIndexes();
      expect(indexes).toHaveProperty('client_1_status_1');
    });

    it('should have brand and status compound index', async () => {
      const indexes = await Payment.collection.getIndexes();
      expect(indexes).toHaveProperty('brand_1_status_1');
    });

    it('should have unique paymentIntentId index', async () => {
      const indexes = await Payment.collection.getIndexes();
      expect(indexes).toHaveProperty('paymentIntentId_1');
    });

    it('should have status and createdAt compound index', async () => {
      const indexes = await Payment.collection.getIndexes();
      expect(indexes).toHaveProperty('status_1_createdAt_-1');
    });
  });
});