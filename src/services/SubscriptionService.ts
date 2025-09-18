import mongoose from 'mongoose';
import { Subscription, ISubscription } from '../models/Subscription';
import { SubscriptionPlan, ISubscriptionPlan } from '../models/SubscriptionPlan';
import { Client } from '../models/Client';
import { Brand } from '../models/Brand';
// import { Booking } from '../models/Booking'; // Will be implemented in future task

type ObjectId = mongoose.Types.ObjectId;

export interface SubscriptionEligibility {
  eligible: boolean;
  reasons: string[];
  subscription?: {
    id: string;
    status: string;
    remainingFrequency: number;
    frequencyResetDate: Date;
    currentPeriodEnd: Date;
  };
}

export interface FrequencyValidation {
  hasFrequencyRemaining: boolean;
  remainingCount: number;
  resetDate: Date;
  usedCount: number;
  limitCount: number;
}

class SubscriptionService {
  /**
   * Validate subscription eligibility for booking
   */
  async validateBookingEligibility(
    clientId: string, 
    brandId: string, 
    classId?: string
  ): Promise<SubscriptionEligibility> {
    try {
      // Find active subscription for client and brand
      const subscription = await Subscription.findOne({
        client: clientId,
        brand: brandId,
        status: 'active'
      }).populate('subscriptionPlan');

      if (!subscription) {
        return {
          eligible: false,
          reasons: ['No active subscription found with this brand']
        };
      }

      const eligibility: SubscriptionEligibility = {
        eligible: true,
        reasons: [],
        subscription: {
          id: subscription._id.toString(),
          status: subscription.status,
          remainingFrequency: await subscription.getRemainingFrequency(),
          frequencyResetDate: subscription.frequencyResetDate,
          currentPeriodEnd: subscription.currentPeriodEnd
        }
      };

      // Check if subscription is valid for booking
      if (!subscription.isValidForBooking()) {
        eligibility.eligible = false;
        eligibility.reasons.push('Subscription is not active or outside billing period');
      }

      // Check frequency limits
      const remainingFrequency = await subscription.getRemainingFrequency();
      if (remainingFrequency <= 0) {
        eligibility.eligible = false;
        eligibility.reasons.push('Frequency limit reached for current period');
      }

      // Check class inclusion if classId provided
      if (classId && eligibility.eligible) {
        const canBookClass = await subscription.canBookClass(new mongoose.Types.ObjectId(classId));
        if (!canBookClass) {
          eligibility.eligible = false;
          eligibility.reasons.push('Class is not included in your subscription plan');
        }
      }

      return eligibility;
    } catch (error) {
      console.error('Error validating booking eligibility:', error);
      return {
        eligible: false,
        reasons: ['Unable to validate subscription eligibility']
      };
    }
  }

  /**
   * Validate frequency limits for a subscription
   */
  async validateFrequencyLimits(subscriptionId: string): Promise<FrequencyValidation> {
    const subscription = await Subscription.findById(subscriptionId).populate('subscriptionPlan');
    
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const plan = subscription.subscriptionPlan as any as ISubscriptionPlan;
    if (!plan) {
      throw new Error('Subscription plan not found');
    }
    
    const remainingCount = await subscription.getRemainingFrequency();
    
    return {
      hasFrequencyRemaining: remainingCount > 0,
      remainingCount,
      resetDate: subscription.frequencyResetDate,
      usedCount: subscription.frequencyUsed,
      limitCount: plan.frequencyLimit.count
    };
  }

  /**
   * Process subscription usage (increment frequency counter)
   */
  async processSubscriptionUsage(subscriptionId: string): Promise<void> {
    const subscription = await Subscription.findById(subscriptionId);
    
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    if (!subscription.isValidForBooking()) {
      throw new Error('Subscription is not valid for booking');
    }

    const remainingFrequency = await subscription.getRemainingFrequency();
    if (remainingFrequency <= 0) {
      throw new Error('Frequency limit exceeded');
    }

    await subscription.incrementFrequencyUsage();
  }

  /**
   * Check if frequency reset is needed and process it
   */
  async processFrequencyReset(subscriptionId: string): Promise<boolean> {
    const subscription = await Subscription.findById(subscriptionId);
    
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const now = new Date();
    
    // Check if reset date has passed
    if (subscription.frequencyResetDate <= now) {
      await subscription.resetFrequencyUsage();
      return true;
    }
    
    return false;
  }

  /**
   * Get subscription usage statistics
   */
  async getSubscriptionStats(subscriptionId: string): Promise<{
    totalBookings: number;
    currentPeriodBookings: number;
    remainingFrequency: number;
    utilizationRate: number;
  }> {
    const subscription = await Subscription.findById(subscriptionId).populate('subscriptionPlan');
    
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const plan = subscription.subscriptionPlan as any as ISubscriptionPlan;
    if (!plan) {
      throw new Error('Subscription plan not found');
    }
    
    // Count total bookings for this subscription
    // TODO: Implement when Booking model is available
    const totalBookings = 0;

    // Count current period bookings
    // TODO: Implement when Booking model is available
    const currentPeriodBookings = 0;

    const remainingFrequency = await subscription.getRemainingFrequency();
    
    // Calculate utilization rate (used / total available in current period)
    let utilizationRate = 0;
    if (plan.frequencyLimit.count > 0) {
      utilizationRate = (subscription.frequencyUsed / plan.frequencyLimit.count) * 100;
    }

    return {
      totalBookings,
      currentPeriodBookings,
      remainingFrequency,
      utilizationRate: Math.round(utilizationRate * 100) / 100 // Round to 2 decimal places
    };
  }

  /**
   * Check for expired subscriptions and update their status
   */
  async processExpiredSubscriptions(): Promise<number> {
    const now = new Date();
    
    const result = await Subscription.updateMany(
      {
        status: 'active',
        endDate: { $lte: now }
      },
      {
        $set: { status: 'expired' }
      }
    );

    return result.modifiedCount;
  }

  /**
   * Get subscriptions that need frequency reset
   */
  async getSubscriptionsNeedingReset(): Promise<ISubscription[]> {
    const now = new Date();
    
    return Subscription.find({
      status: 'active',
      frequencyResetDate: { $lte: now },
      frequencyUsed: { $gt: 0 }
    });
  }

  /**
   * Validate subscription plan compatibility with client's existing subscriptions
   */
  async validateSubscriptionCompatibility(
    clientId: string, 
    subscriptionPlanId: string
  ): Promise<{ compatible: boolean; reason?: string }> {
    const subscriptionPlan = await SubscriptionPlan.findById(subscriptionPlanId);
    
    if (!subscriptionPlan) {
      return { compatible: false, reason: 'Subscription plan not found' };
    }

    // Check for existing active subscription with the same brand
    const existingSubscription = await Subscription.findOne({
      client: clientId,
      brand: subscriptionPlan.brand,
      status: 'active'
    });

    if (existingSubscription) {
      return { 
        compatible: false, 
        reason: 'Client already has an active subscription with this brand' 
      };
    }

    // Check if client exists and is active
    const client = await Client.findById(clientId);
    if (!client || client.status !== 'active') {
      return { compatible: false, reason: 'Client not found or inactive' };
    }

    // Check if brand exists and is active
    const brand = await Brand.findById(subscriptionPlan.brand);
    if (!brand || brand.status !== 'active') {
      return { compatible: false, reason: 'Brand not found or inactive' };
    }

    return { compatible: true };
  }

  /**
   * Calculate subscription renewal date
   */
  calculateRenewalDate(startDate: Date, billingCycle: string): Date {
    const renewalDate = new Date(startDate);
    
    switch (billingCycle) {
      case 'monthly':
        renewalDate.setMonth(renewalDate.getMonth() + 1);
        break;
      case 'quarterly':
        renewalDate.setMonth(renewalDate.getMonth() + 3);
        break;
      case 'yearly':
        renewalDate.setFullYear(renewalDate.getFullYear() + 1);
        break;
      default:
        throw new Error(`Invalid billing cycle: ${billingCycle}`);
    }
    
    return renewalDate;
  }

  /**
   * Calculate frequency reset date based on plan settings
   */
  calculateFrequencyResetDate(
    startDate: Date, 
    frequencyLimit: { period: string; resetDay: number }
  ): Date {
    const resetDate = new Date(startDate);
    
    if (frequencyLimit.period === 'week') {
      // Calculate next reset day (1=Monday, 7=Sunday)
      const daysUntilReset = (frequencyLimit.resetDay - startDate.getDay() + 7) % 7;
      // If it's the same day, move to next week
      const daysToAdd = daysUntilReset === 0 ? 7 : daysUntilReset;
      resetDate.setDate(resetDate.getDate() + daysToAdd);
    } else if (frequencyLimit.period === 'month') {
      // Set to specific day of month
      resetDate.setDate(frequencyLimit.resetDay);
      
      // If the reset day has already passed this month, move to next month
      if (resetDate <= startDate) {
        resetDate.setMonth(resetDate.getMonth() + 1);
      }
    }
    
    return resetDate;
  }
}

export default new SubscriptionService();