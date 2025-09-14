import mongoose, { Schema, Document } from 'mongoose';

type ObjectId = mongoose.Types.ObjectId;

// Interfaces
export interface FrequencyLimit {
  count: number; // 0 = unlimited
  period: 'week' | 'month';
  resetDay: number; // 1-7 for week (1=Monday), 1-31 for month
}

export interface ISubscriptionPlan extends Document {
  _id: ObjectId;
  brand: ObjectId;
  name: string;
  description?: string;
  price: number; // in cents
  billingCycle: 'monthly' | 'quarterly' | 'yearly';
  includedClasses: ObjectId[]; // empty array = all classes
  frequencyLimit: FrequencyLimit;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
  isClassIncluded(classId: ObjectId): boolean; // Instance method
}

// Frequency Limit Schema
const FrequencyLimitSchema = new Schema<FrequencyLimit>({
  count: { 
    type: Number, 
    required: [true, 'Frequency count is required'],
    min: [0, 'Frequency count cannot be negative'],
    max: [1000, 'Frequency count cannot exceed 1000'],
    validate: {
      validator: Number.isInteger,
      message: 'Frequency count must be a whole number'
    }
  },
  period: { 
    type: String, 
    required: [true, 'Frequency period is required'],
    enum: {
      values: ['week', 'month'],
      message: 'Period must be week or month'
    }
  },
  resetDay: { 
    type: Number, 
    required: [true, 'Reset day is required'],
    min: [1, 'Reset day must be at least 1'],
    validate: {
      validator: function(this: FrequencyLimit, value: number) {
        if (this.period === 'week') {
          return value >= 1 && value <= 7;
        } else if (this.period === 'month') {
          return value >= 1 && value <= 31;
        }
        return false;
      },
      message: 'Reset day must be 1-7 for weekly periods or 1-31 for monthly periods'
    }
  }
}, { _id: false });

// Subscription Plan Schema
const SubscriptionPlanSchema = new Schema<ISubscriptionPlan>({
  brand: { 
    type: Schema.Types.ObjectId, 
    ref: 'Brand',
    required: [true, 'Brand is required'],
    index: true
  },
  name: { 
    type: String, 
    required: [true, 'Plan name is required'],
    trim: true,
    minlength: [2, 'Plan name must be at least 2 characters'],
    maxlength: [100, 'Plan name cannot exceed 100 characters']
  },
  description: { 
    type: String, 
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  price: { 
    type: Number, 
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative'],
    max: [10000000, 'Price cannot exceed $100,000'], // $100,000 in cents
    validate: {
      validator: Number.isInteger,
      message: 'Price must be a whole number (in cents)'
    }
  },
  billingCycle: { 
    type: String, 
    required: [true, 'Billing cycle is required'],
    enum: {
      values: ['monthly', 'quarterly', 'yearly'],
      message: 'Billing cycle must be monthly, quarterly, or yearly'
    }
  },
  includedClasses: [{
    type: Schema.Types.ObjectId,
    ref: 'Class'
  }],
  frequencyLimit: { 
    type: FrequencyLimitSchema, 
    required: [true, 'Frequency limit is required']
  },
  status: { 
    type: String, 
    enum: {
      values: ['active', 'inactive'],
      message: 'Status must be active or inactive'
    },
    default: 'active'
  }
}, {
  timestamps: true
});

// Indexes
SubscriptionPlanSchema.index({ brand: 1, status: 1 });
SubscriptionPlanSchema.index({ brand: 1, name: 1 });
SubscriptionPlanSchema.index({ status: 1 });
SubscriptionPlanSchema.index({ price: 1 });
SubscriptionPlanSchema.index({ billingCycle: 1 });

// Pre-save validation middleware
SubscriptionPlanSchema.pre('save', async function(next) {
  // Validate that included classes belong to the same brand
  if (this.includedClasses && this.includedClasses.length > 0) {
    const Class = mongoose.model('Class');
    const classes = await Class.find({ 
      _id: { $in: this.includedClasses },
      brand: { $ne: this.brand }
    });
    
    if (classes.length > 0) {
      return next(new Error('All included classes must belong to the same brand'));
    }
  }
  
  next();
});

// Instance method to check if a class is included in the plan
SubscriptionPlanSchema.methods.isClassIncluded = function(classId: ObjectId): boolean {
  // Empty array means all classes are included
  if (this.includedClasses.length === 0) {
    return true;
  }
  
  // Check if specific class is included
  return this.includedClasses.some((id: ObjectId) => id.toString() === classId.toString());
};

export const SubscriptionPlan = mongoose.model<ISubscriptionPlan>('SubscriptionPlan', SubscriptionPlanSchema);