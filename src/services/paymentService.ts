import Stripe from 'stripe';
import mongoose from 'mongoose';
import config from '../config/environment';
import stripeService from './stripeService';
import { Payment, IPayment } from '../models/Payment';
import { SubscriptionPlan, ISubscriptionPlan } from '../models/SubscriptionPlan';
import { CreditPlan, ICreditPlan } from '../models/CreditPlan';
import { Subscription, ISubscription } from '../models/Subscription';
import { CreditBalance, ICreditBalance } from '../models/CreditBalance';
import { Brand } from '../models/Brand';
import { Client } from '../models/Client';

export interface PaymentIntentData {
  paymentIntentId: string;
  clientSecret: string;
  amount: number;
  currency: string;
  status: string;
}

export interface SubscriptionPurchaseRequest {
  clientId: string;
  subscriptionPlanId: string;
  paymentMethodId?: string;
}

export interface CreditPurchaseRequest {
  clientId: string;
  creditPlanId: string;
  paymentMethodId?: string;
}

export interface PaymentConfirmationRequest {
  paymentIntentId: string;
  clientId: string;
}

export interface PaymentProcessingError extends Error {
  code: string;
  statusCode: number;
}

class PaymentService {
  private stripe: Stripe;

  constructor() {
    if (!config.stripe.secretKey) {
      throw new Error('Stripe secret key is required');
    }
    
    this.stripe = new Stripe(config.stripe.secretKey, {
      apiVersion: '2023-10-16',
    });
  }

  /**
   * Create PaymentIntent for subscription purchase
   */
  async createSubscriptionPaymentIntent(request: SubscriptionPurchaseRequest): Promise<PaymentIntentData> {
    // Use transactions only if supported (not in test environment)
    const useTransactions = process.env.NODE_ENV !== 'test';
    let session: mongoose.ClientSession | undefined;
    
    if (useTransactions) {
      session = await mongoose.startSession();
      session.startTransaction();
    }

    try {
      // Validate client
      const clientQuery = Client.findById(request.clientId);
      if (session) clientQuery.session(session);
      const client = await clientQuery;
      if (!client) {
        throw this.createError('CLIENT_001', 'Client not found', 404);
      }

      // Validate subscription plan
      const planQuery = SubscriptionPlan.findById(request.subscriptionPlanId).populate('brand');
      if (session) planQuery.session(session);
      const subscriptionPlan = await planQuery;
      if (!subscriptionPlan) {
        throw this.createError('PLAN_001', 'Subscription plan not found', 404);
      }

      if (subscriptionPlan.status !== 'active') {
        throw this.createError('PLAN_002', 'Subscription plan is not active', 400);
      }

      const brand = subscriptionPlan.brand as any;
      if (!brand.stripeConnectAccountId || !brand.stripeOnboardingComplete) {
        throw this.createError('STRIPE_001', 'Brand Stripe account not properly configured', 400);
      }

      // Validate payment capability
      const canProcessPayments = await stripeService.validatePaymentCapability(brand.stripeConnectAccountId);
      if (!canProcessPayments) {
        throw this.createError('STRIPE_002', 'Brand cannot process payments at this time', 400);
      }

      // Check for existing active subscription
      const existingQuery = Subscription.findOne({
        client: request.clientId,
        brand: brand._id,
        status: 'active'
      });
      if (session) existingQuery.session(session);
      const existingSubscription = await existingQuery;

      if (existingSubscription) {
        throw this.createError('SUBSCRIPTION_001', 'Client already has an active subscription with this brand', 400);
      }

      // Create subscription record (pending status)
      const subscription = new Subscription({
        client: request.clientId,
        brand: brand._id,
        subscriptionPlan: request.subscriptionPlanId,
        status: 'pending',
        startDate: new Date(),
        endDate: this.calculateSubscriptionEndDate(new Date(), subscriptionPlan.billingCycle),
        nextBillingDate: this.calculateNextBillingDate(new Date(), subscriptionPlan.billingCycle),
        currentPeriodStart: new Date(),
        currentPeriodEnd: this.calculateCurrentPeriodEnd(new Date(), subscriptionPlan.billingCycle),
        frequencyUsed: 0,
        frequencyResetDate: this.calculateFrequencyResetDate(new Date(), subscriptionPlan.frequencyLimit),
        autoRenew: true
      });

      if (session) {
        await subscription.save({ session });
      } else {
        await subscription.save();
      }

      // Create PaymentIntent with Stripe
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: subscriptionPlan.price,
        currency: 'usd',
        payment_method: request.paymentMethodId,
        confirmation_method: 'manual',
        confirm: false,
        metadata: {
          type: 'subscription',
          clientId: request.clientId,
          brandId: brand._id.toString(),
          subscriptionPlanId: request.subscriptionPlanId,
          subscriptionId: subscription._id.toString()
        },
        transfer_data: {
          destination: brand.stripeConnectAccountId,
        },
      });

      // Create payment record
      const payment = new Payment({
        client: request.clientId,
        brand: brand._id,
        type: 'subscription',
        status: 'pending',
        amount: subscriptionPlan.price,
        currency: 'USD',
        paymentIntentId: paymentIntent.id,
        paymentMethodId: request.paymentMethodId,
        subscriptionId: subscription._id,
        metadata: {
          subscriptionPlanId: request.subscriptionPlanId,
          clientId: request.clientId,
          brandId: brand._id
        }
      });

      if (session) {
        await payment.save({ session });
      } else {
        await payment.save();
      }

      // Update subscription with payment intent ID
      subscription.paymentIntentId = paymentIntent.id;
      if (session) {
        await subscription.save({ session });
      } else {
        await subscription.save();
      }

      if (session) {
        await session.commitTransaction();
      }

      return {
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret!,
        amount: subscriptionPlan.price,
        currency: 'USD',
        status: paymentIntent.status
      };

    } catch (error) {
      if (session) {
        await session.abortTransaction();
      }
      throw error;
    } finally {
      if (session) {
        session.endSession();
      }
    }
  }

  /**
   * Create PaymentIntent for credit plan purchase
   */
  async createCreditPaymentIntent(request: CreditPurchaseRequest): Promise<PaymentIntentData> {
    // Use transactions only if supported (not in test environment)
    const useTransactions = process.env.NODE_ENV !== 'test';
    let session: mongoose.ClientSession | undefined;
    
    if (useTransactions) {
      session = await mongoose.startSession();
      session.startTransaction();
    }

    try {
      // Validate client
      const clientQuery = Client.findById(request.clientId);
      if (session) clientQuery.session(session);
      const client = await clientQuery;
      if (!client) {
        throw this.createError('CLIENT_001', 'Client not found', 404);
      }

      // Validate credit plan
      const planQuery = CreditPlan.findById(request.creditPlanId).populate('brand');
      if (session) planQuery.session(session);
      const creditPlan = await planQuery;
      if (!creditPlan) {
        throw this.createError('PLAN_001', 'Credit plan not found', 404);
      }

      if (creditPlan.status !== 'active') {
        throw this.createError('PLAN_002', 'Credit plan is not active', 400);
      }

      const brand = creditPlan.brand as any;
      if (!brand.stripeConnectAccountId || !brand.stripeOnboardingComplete) {
        throw this.createError('STRIPE_001', 'Brand Stripe account not properly configured', 400);
      }

      // Validate payment capability
      const canProcessPayments = await stripeService.validatePaymentCapability(brand.stripeConnectAccountId);
      if (!canProcessPayments) {
        throw this.createError('STRIPE_002', 'Brand cannot process payments at this time', 400);
      }

      // Get or create credit balance
      const balanceQuery = CreditBalance.findOne({
        client: request.clientId,
        brand: brand._id
      });
      if (session) balanceQuery.session(session);
      let creditBalance = await balanceQuery;

      if (!creditBalance) {
        creditBalance = new CreditBalance({
          client: request.clientId,
          brand: brand._id,
          availableCredits: 0,
          totalCreditsEarned: 0,
          totalCreditsUsed: 0,
          creditPackages: [],
          transactions: [],
          status: 'active',
          lastActivityDate: new Date()
        });
        if (session) {
          await creditBalance.save({ session });
        } else {
          await creditBalance.save();
        }
      }

      // Create PaymentIntent with Stripe
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: creditPlan.price,
        currency: 'usd',
        payment_method: request.paymentMethodId,
        confirmation_method: 'manual',
        confirm: false,
        metadata: {
          type: 'credit_purchase',
          clientId: request.clientId,
          brandId: brand._id.toString(),
          creditPlanId: request.creditPlanId,
          creditBalanceId: creditBalance._id.toString()
        },
        transfer_data: {
          destination: brand.stripeConnectAccountId,
        },
      });

      // Create payment record
      const payment = new Payment({
        client: request.clientId,
        brand: brand._id,
        type: 'credit_purchase',
        status: 'pending',
        amount: creditPlan.price,
        currency: 'USD',
        paymentIntentId: paymentIntent.id,
        paymentMethodId: request.paymentMethodId,
        creditBalanceId: creditBalance._id,
        metadata: {
          creditPlanId: request.creditPlanId,
          clientId: request.clientId,
          brandId: brand._id
        }
      });

      if (session) {
        await payment.save({ session });
      } else {
        await payment.save();
      }

      if (session) {
        await session.commitTransaction();
      }

      return {
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret!,
        amount: creditPlan.price,
        currency: 'USD',
        status: paymentIntent.status
      };

    } catch (error) {
      if (session) {
        await session.abortTransaction();
      }
      throw error;
    } finally {
      if (session) {
        session.endSession();
      }
    }
  }

  /**
   * Confirm payment and complete purchase
   */
  async confirmPayment(request: PaymentConfirmationRequest): Promise<{ success: boolean; payment: IPayment }> {
    // Use transactions only if supported (not in test environment)
    const useTransactions = process.env.NODE_ENV !== 'test';
    let session: mongoose.ClientSession | undefined;
    
    if (useTransactions) {
      session = await mongoose.startSession();
      session.startTransaction();
    }

    try {
      // Find payment record
      const paymentQuery = Payment.findOne({
        paymentIntentId: request.paymentIntentId,
        client: request.clientId
      });
      if (session) paymentQuery.session(session);
      const payment = await paymentQuery;

      if (!payment) {
        throw this.createError('PAYMENT_001', 'Payment not found', 404);
      }

      if (payment.status !== 'pending') {
        throw this.createError('PAYMENT_002', 'Payment already processed', 400);
      }

      // Retrieve PaymentIntent from Stripe
      const paymentIntent = await this.stripe.paymentIntents.retrieve(request.paymentIntentId);

      if (paymentIntent.status === 'succeeded') {
        // Payment succeeded - complete the purchase
        await this.completePayment(payment, session);
        
        payment.status = 'succeeded';
        payment.processedAt = new Date();
        payment.addStripeEvent(paymentIntent.id, 'payment_intent.succeeded', paymentIntent);
        if (session) {
          await payment.save({ session });
        } else {
          await payment.save();
        }

      } else if (paymentIntent.status === 'requires_action') {
        // Payment requires additional action (3D Secure, etc.)
        payment.status = 'processing';
        payment.addStripeEvent(paymentIntent.id, 'payment_intent.requires_action', paymentIntent);
        if (session) {
          await payment.save({ session });
        } else {
          await payment.save();
        }

      } else if (['canceled', 'payment_failed'].includes(paymentIntent.status)) {
        // Payment failed
        await this.handleFailedPayment(payment, paymentIntent.last_payment_error?.message || 'Payment failed', session);
        
        payment.status = 'failed';
        payment.failureReason = paymentIntent.last_payment_error?.message || 'Payment failed';
        payment.processedAt = new Date();
        payment.addStripeEvent(paymentIntent.id, 'payment_intent.payment_failed', paymentIntent);
        if (session) {
          await payment.save({ session });
        } else {
          await payment.save();
        }
      }

      if (session) {
        await session.commitTransaction();
      }

      return {
        success: payment.status === 'succeeded',
        payment
      };

    } catch (error) {
      if (session) {
        await session.abortTransaction();
      }
      throw error;
    } finally {
      if (session) {
        session.endSession();
      }
    }
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
          break;
        
        case 'payment_intent.payment_failed':
          await this.handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
          break;
        
        case 'payment_intent.canceled':
          await this.handlePaymentIntentCanceled(event.data.object as Stripe.PaymentIntent);
          break;
        
        default:
          console.log(`Unhandled webhook event type: ${event.type}`);
      }
    } catch (error) {
      console.error('Error handling webhook event:', error);
      throw error;
    }
  }

  /**
   * Get payment by PaymentIntent ID
   */
  async getPaymentByIntentId(paymentIntentId: string): Promise<IPayment | null> {
    return Payment.findByPaymentIntentId(paymentIntentId);
  }

  /**
   * Get client's payment history
   */
  async getClientPaymentHistory(clientId: string, limit: number = 20, offset: number = 0): Promise<IPayment[]> {
    return Payment.find({ client: clientId })
      .populate('brand', 'name')
      .populate('subscriptionId')
      .populate('creditBalanceId')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(offset);
  }

  /**
   * Get brand's payment history
   */
  async getBrandPaymentHistory(brandId: string, limit: number = 20, offset: number = 0): Promise<IPayment[]> {
    return Payment.find({ brand: brandId })
      .populate('client', 'firstName lastName email')
      .populate('subscriptionId')
      .populate('creditBalanceId')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(offset);
  }

  // Private helper methods

  private async completePayment(payment: IPayment, session?: mongoose.ClientSession): Promise<void> {
    if (payment.type === 'subscription') {
      await this.completeSubscriptionPayment(payment, session);
    } else if (payment.type === 'credit_purchase') {
      await this.completeCreditPayment(payment, session);
    }
  }

  private async completeSubscriptionPayment(payment: IPayment, session?: mongoose.ClientSession): Promise<void> {
    if (!payment.subscriptionId) {
      throw new Error('Subscription ID not found in payment');
    }

    const subscriptionQuery = Subscription.findById(payment.subscriptionId);
    if (session) subscriptionQuery.session(session);
    const subscription = await subscriptionQuery;
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    // Activate subscription
    subscription.status = 'active';
    if (session) {
      await subscription.save({ session });
    } else {
      await subscription.save();
    }
  }

  private async completeCreditPayment(payment: IPayment, session?: mongoose.ClientSession): Promise<void> {
    if (!payment.creditBalanceId) {
      throw new Error('Credit balance ID not found in payment');
    }

    const balanceQuery = CreditBalance.findById(payment.creditBalanceId);
    if (session) balanceQuery.session(session);
    const creditBalance = await balanceQuery;
    if (!creditBalance) {
      throw new Error('Credit balance not found');
    }

    const creditPlanId = payment.metadata.creditPlanId;
    if (!creditPlanId) {
      throw new Error('Credit plan ID not found in payment metadata');
    }

    // Add credit package to balance
    await creditBalance.addCreditPackage(creditPlanId, payment.paymentIntentId);
  }

  private async handleFailedPayment(payment: IPayment, errorMessage: string, session?: mongoose.ClientSession): Promise<void> {
    if (payment.type === 'subscription' && payment.subscriptionId) {
      // Cancel pending subscription
      const subscriptionQuery = Subscription.findById(payment.subscriptionId);
      if (session) subscriptionQuery.session(session);
      const subscription = await subscriptionQuery;
      if (subscription && subscription.status === 'pending') {
        subscription.status = 'cancelled';
        subscription.cancelledAt = new Date();
        subscription.cancellationReason = 'Payment failed';
        if (session) {
          await subscription.save({ session });
        } else {
          await subscription.save();
        }
      }
    }
    // For credit purchases, no additional cleanup needed as credits weren't added yet
  }

  private async handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const payment = await Payment.findByPaymentIntentId(paymentIntent.id);
    if (!payment) {
      console.error(`Payment not found for PaymentIntent: ${paymentIntent.id}`);
      return;
    }

    if (payment.status === 'succeeded') {
      // Already processed
      return;
    }

    // Use transactions only if supported (not in test environment)
    const useTransactions = process.env.NODE_ENV !== 'test';
    let session: mongoose.ClientSession | undefined;
    
    if (useTransactions) {
      session = await mongoose.startSession();
      session.startTransaction();
    }

    try {
      await this.completePayment(payment, session);
      
      payment.status = 'succeeded';
      payment.processedAt = new Date();
      payment.addStripeEvent(paymentIntent.id, 'payment_intent.succeeded', paymentIntent);
      if (session) {
        await payment.save({ session });
      } else {
        await payment.save();
      }

      if (session) {
        await session.commitTransaction();
      }
    } catch (error) {
      if (session) {
        await session.abortTransaction();
      }
      throw error;
    } finally {
      if (session) {
        session.endSession();
      }
    }
  }

  private async handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const payment = await Payment.findByPaymentIntentId(paymentIntent.id);
    if (!payment) {
      console.error(`Payment not found for PaymentIntent: ${paymentIntent.id}`);
      return;
    }

    // Use transactions only if supported (not in test environment)
    const useTransactions = process.env.NODE_ENV !== 'test';
    let session: mongoose.ClientSession | undefined;
    
    if (useTransactions) {
      session = await mongoose.startSession();
      session.startTransaction();
    }

    try {
      await this.handleFailedPayment(payment, paymentIntent.last_payment_error?.message || 'Payment failed', session);
      
      payment.status = 'failed';
      payment.failureReason = paymentIntent.last_payment_error?.message || 'Payment failed';
      payment.processedAt = new Date();
      payment.addStripeEvent(paymentIntent.id, 'payment_intent.payment_failed', paymentIntent);
      if (session) {
        await payment.save({ session });
      } else {
        await payment.save();
      }

      if (session) {
        await session.commitTransaction();
      }
    } catch (error) {
      if (session) {
        await session.abortTransaction();
      }
      throw error;
    } finally {
      if (session) {
        session.endSession();
      }
    }
  }

  private async handlePaymentIntentCanceled(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const payment = await Payment.findByPaymentIntentId(paymentIntent.id);
    if (!payment) {
      console.error(`Payment not found for PaymentIntent: ${paymentIntent.id}`);
      return;
    }

    // Use transactions only if supported (not in test environment)
    const useTransactions = process.env.NODE_ENV !== 'test';
    let session: mongoose.ClientSession | undefined;
    
    if (useTransactions) {
      session = await mongoose.startSession();
      session.startTransaction();
    }

    try {
      await this.handleFailedPayment(payment, 'Payment canceled', session);
      
      payment.status = 'cancelled';
      payment.processedAt = new Date();
      payment.addStripeEvent(paymentIntent.id, 'payment_intent.canceled', paymentIntent);
      if (session) {
        await payment.save({ session });
      } else {
        await payment.save();
      }

      if (session) {
        await session.commitTransaction();
      }
    } catch (error) {
      if (session) {
        await session.abortTransaction();
      }
      throw error;
    } finally {
      if (session) {
        session.endSession();
      }
    }
  }

  private calculateSubscriptionEndDate(startDate: Date, billingCycle: string): Date {
    const endDate = new Date(startDate);
    switch (billingCycle) {
      case 'monthly':
        endDate.setMonth(endDate.getMonth() + 1);
        break;
      case 'quarterly':
        endDate.setMonth(endDate.getMonth() + 3);
        break;
      case 'yearly':
        endDate.setFullYear(endDate.getFullYear() + 1);
        break;
    }
    return endDate;
  }

  private calculateNextBillingDate(startDate: Date, billingCycle: string): Date {
    return this.calculateSubscriptionEndDate(startDate, billingCycle);
  }

  private calculateCurrentPeriodEnd(startDate: Date, billingCycle: string): Date {
    return this.calculateSubscriptionEndDate(startDate, billingCycle);
  }

  private calculateFrequencyResetDate(startDate: Date, frequencyLimit: any): Date {
    const resetDate = new Date(startDate);
    if (frequencyLimit.period === 'week') {
      const daysUntilReset = (frequencyLimit.resetDay - startDate.getDay() + 7) % 7;
      resetDate.setDate(resetDate.getDate() + daysUntilReset);
    } else if (frequencyLimit.period === 'month') {
      resetDate.setDate(frequencyLimit.resetDay);
      if (resetDate <= startDate) {
        resetDate.setMonth(resetDate.getMonth() + 1);
      }
    }
    return resetDate;
  }

  private createError(code: string, message: string, statusCode: number): PaymentProcessingError {
    const error = new Error(message) as PaymentProcessingError;
    error.code = code;
    error.statusCode = statusCode;
    return error;
  }
}

export default new PaymentService();