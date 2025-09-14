import mongoose, { Schema, Document } from 'mongoose';

type ObjectId = mongoose.Types.ObjectId;

// Interfaces
export interface ISubscription extends Document {
  _id: ObjectId;
  client: ObjectId;
  brand: ObjectId;
  subscriptionPlan: ObjectId;
  status: 'active' | 'cancelled' | 'expired' | 'pending';
  startDate: Date;
  endDate: Date;
  nextBillingDate: Date;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  frequencyUsed: number; // Current period usage count
  frequencyResetDate: Date; // When frequency counter resets
  paymentIntentId?: string; // Stripe PaymentIntent ID
  stripeSubscriptionId?: string; // Stripe Subscription ID (for recurring)
  cancelledAt?: Date;
  cancellationReason?: string;
  autoRenew: boolean;
  createdAt: Date;
  updatedAt: Date;
  isActive(): boolean; // Instance method
  isValidForBooking(): boolean; // Instance method
  canBookClass(classId: ObjectId): boolean; // Instance method
  incrementFrequencyUsage(): Promise<void>; // Instance method
  resetFrequencyUsage(): Promise<void>; // Instance method
  getRemainingFrequency(): number; // Instance method
}

// Subscription Schema
const SubscriptionSchema = new Schema<ISubscription>({
  client: { 
    type: Schema.Types.ObjectId, 
    ref: 'Client',
    required: [true, 'Client is required'],
    index: true
  },
  brand: { 
    type: Schema.Types.ObjectId, 
    ref: 'Brand',
    required: [true, 'Brand is required'],
    index: true
  },
  subscriptionPlan: { 
    type: Schema.Types.ObjectId, 
    ref: 'SubscriptionPlan',
    required: [true, 'Subscription plan is required'],
    index: true
  },
  status: { 
    type: String, 
    enum: {
      values: ['active', 'cancelled', 'expired', 'pending'],
      message: 'Status must be active, cancelled, expired, or pending'
    },
    default: 'pending',
    index: true
  },
  startDate: { 
    type: Date, 
    required: [true, 'Start date is required'],
    index: true
  },
  endDate: { 
    type: Date, 
    required: [true, 'End date is required'],
    index: true,
    validate: {
      validator: function(this: ISubscription, value: Date) {
        return value > this.startDate;
      },
      message: 'End date must be after start date'
    }
  },
  nextBillingDate: { 
    type: Date, 
    required: [true, 'Next billing date is required'],
    index: true
  },
  currentPeriodStart: { 
    type: Date, 
    required: [true, 'Current period start is required']
  },
  currentPeriodEnd: { 
    type: Date, 
    required: [true, 'Current period end is required'],
    validate: {
      validator: function(this: ISubscription, value: Date) {
        return value > this.currentPeriodStart;
      },
      message: 'Current period end must be after current period start'
    }
  },
  frequencyUsed: { 
    type: Number, 
    required: true,
    min: [0, 'Frequency used cannot be negative'],
    default: 0,
    validate: {
      validator: Number.isInteger,
      message: 'Frequency used must be a whole number'
    }
  },
  frequencyResetDate: { 
    type: Date, 
    required: [true, 'Frequency reset date is required'],
    index: true
  },
  paymentIntentId: { 
    type: String, 
    trim: true,
    validate: {
      validator: function(v: string) {
        return !v || /^pi_[a-zA-Z0-9_]+$/.test(v);
      },
      message: 'Invalid Stripe PaymentIntent ID format'
    }
  },
  stripeSubscriptionId: { 
    type: String, 
    trim: true,
    validate: {
      validator: function(v: string) {
        return !v || /^sub_[a-zA-Z0-9_]+$/.test(v);
      },
      message: 'Invalid Stripe Subscription ID format'
    }
  },
  cancelledAt: { 
    type: Date,
    validate: {
      validator: function(this: ISubscription, value: Date) {
        return !value || this.status === 'cancelled';
      },
      message: 'Cancelled date can only be set when status is cancelled'
    }
  },
  cancellationReason: { 
    type: String, 
    trim: true,
    maxlength: [500, 'Cancellation reason cannot exceed 500 characters'],
    validate: {
      validator: function(this: ISubscription, value: string) {
        return !value || this.status === 'cancelled';
      },
      message: 'Cancellation reason can only be set when status is cancelled'
    }
  },
  autoRenew: { 
    type: Boolean, 
    default: true
  }
}, {
  timestamps: true
});

// Compound Indexes for efficient queries
SubscriptionSchema.index({ client: 1, brand: 1 });
SubscriptionSchema.index({ client: 1, status: 1 });
SubscriptionSchema.index({ brand: 1, status: 1 });
SubscriptionSchema.index({ status: 1, endDate: 1 });
SubscriptionSchema.index({ status: 1, nextBillingDate: 1 });
SubscriptionSchema.index({ frequencyResetDate: 1, status: 1 });
SubscriptionSchema.index({ paymentIntentId: 1 }, { sparse: true });
SubscriptionSchema.index({ stripeSubscriptionId: 1 }, { sparse: true });

// Pre-save validation middleware
SubscriptionSchema.pre('save', async function(next) {
  // Validate client-brand relationship
  const Client = mongoose.model('Client');
  const client = await Client.findById(this.client);
  if (!client) {
    return next(new Error('Client not found'));
  }

  // Validate subscription plan belongs to the brand
  const SubscriptionPlan = mongoose.model('SubscriptionPlan');
  const plan = await SubscriptionPlan.findById(this.subscriptionPlan);
  if (!plan) {
    return next(new Error('Subscription plan not found'));
  }
  if (plan.brand.toString() !== this.brand.toString()) {
    return next(new Error('Subscription plan must belong to the specified brand'));
  }

  // Validate date consistency
  if (this.currentPeriodStart >= this.currentPeriodEnd) {
    return next(new Error('Current period start must be before current period end'));
  }
  if (this.startDate >= this.endDate) {
    return next(new Error('Start date must be before end date'));
  }

  // Validate cancellation fields
  if (this.status === 'cancelled') {
    if (!this.cancelledAt) {
      this.cancelledAt = new Date();
    }
  } else {
    if (this.cancelledAt || this.cancellationReason) {
      return next(new Error('Cancellation fields can only be set when status is cancelled'));
    }
  }

  next();
});

// Instance method to check if subscription is active
SubscriptionSchema.methods.isActive = function(): boolean {
  const now = new Date();
  return this.status === 'active' && 
         this.startDate <= now && 
         this.endDate > now;
};

// Instance method to check if subscription is valid for booking
SubscriptionSchema.methods.isValidForBooking = function(): boolean {
  if (!this.isActive()) {
    return false;
  }
  
  // Check if within current billing period
  const now = new Date();
  return this.currentPeriodStart <= now && this.currentPeriodEnd > now;
};

// Instance method to check if subscription can book a specific class
SubscriptionSchema.methods.canBookClass = async function(classId: ObjectId): Promise<boolean> {
  if (!this.isValidForBooking()) {
    return false;
  }
  
  // Get the subscription plan to check class inclusion
  const SubscriptionPlan = mongoose.model('SubscriptionPlan');
  const plan = await SubscriptionPlan.findById(this.subscriptionPlan);
  if (!plan) {
    return false;
  }
  
  return plan.isClassIncluded(classId);
};

// Instance method to increment frequency usage
SubscriptionSchema.methods.incrementFrequencyUsage = async function(): Promise<void> {
  this.frequencyUsed += 1;
  await this.save();
};

// Instance method to reset frequency usage
SubscriptionSchema.methods.resetFrequencyUsage = async function(): Promise<void> {
  this.frequencyUsed = 0;
  
  // Calculate next reset date based on subscription plan
  const SubscriptionPlan = mongoose.model('SubscriptionPlan');
  const plan = await SubscriptionPlan.findById(this.subscriptionPlan);
  if (plan) {
    const now = new Date();
    if (plan.frequencyLimit.period === 'week') {
      // Calculate next week reset
      const daysUntilReset = (plan.frequencyLimit.resetDay - now.getDay() + 7) % 7;
      this.frequencyResetDate = new Date(now.getTime() + daysUntilReset * 24 * 60 * 60 * 1000);
    } else if (plan.frequencyLimit.period === 'month') {
      // Calculate next month reset
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, plan.frequencyLimit.resetDay);
      this.frequencyResetDate = nextMonth;
    }
  }
  
  await this.save();
};

// Instance method to get remaining frequency for current period
SubscriptionSchema.methods.getRemainingFrequency = async function(): Promise<number> {
  const SubscriptionPlan = mongoose.model('SubscriptionPlan');
  const plan = await SubscriptionPlan.findById(this.subscriptionPlan);
  if (!plan) {
    return 0;
  }
  
  // If unlimited (count = 0), return a large number
  if (plan.frequencyLimit.count === 0) {
    return Number.MAX_SAFE_INTEGER;
  }
  
  return Math.max(0, plan.frequencyLimit.count - this.frequencyUsed);
};

export const Subscription = mongoose.model<ISubscription>('Subscription', SubscriptionSchema);