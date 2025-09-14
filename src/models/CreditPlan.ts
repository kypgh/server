import mongoose, { Schema, Document } from 'mongoose';

type ObjectId = mongoose.Types.ObjectId;

// Interfaces
export interface ICreditPlan extends Document {
  _id: ObjectId;
  brand: ObjectId;
  name: string;
  description?: string;
  price: number; // in cents
  creditAmount: number;
  validityPeriod: number; // days
  bonusCredits: number;
  includedClasses: ObjectId[]; // empty array = all classes
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
  getTotalCredits(): number; // Instance method
  isClassIncluded(classId: ObjectId): boolean; // Instance method
  getExpiryDate(purchaseDate?: Date): Date; // Instance method
}

// Credit Plan Schema
const CreditPlanSchema = new Schema<ICreditPlan>({
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
  creditAmount: { 
    type: Number, 
    required: [true, 'Credit amount is required'],
    min: [1, 'Credit amount must be at least 1'],
    max: [1000, 'Credit amount cannot exceed 1000'],
    validate: {
      validator: Number.isInteger,
      message: 'Credit amount must be a whole number'
    }
  },
  validityPeriod: { 
    type: Number, 
    required: [true, 'Validity period is required'],
    min: [1, 'Validity period must be at least 1 day'],
    max: [3650, 'Validity period cannot exceed 10 years'], // 10 years in days
    validate: {
      validator: Number.isInteger,
      message: 'Validity period must be a whole number of days'
    }
  },
  bonusCredits: { 
    type: Number, 
    required: true,
    min: [0, 'Bonus credits cannot be negative'],
    max: [1000, 'Bonus credits cannot exceed 1000'],
    default: 0,
    validate: {
      validator: Number.isInteger,
      message: 'Bonus credits must be a whole number'
    }
  },
  includedClasses: [{
    type: Schema.Types.ObjectId,
    ref: 'Class'
  }],
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
CreditPlanSchema.index({ brand: 1, status: 1 });
CreditPlanSchema.index({ brand: 1, name: 1 });
CreditPlanSchema.index({ status: 1 });
CreditPlanSchema.index({ price: 1 });
CreditPlanSchema.index({ creditAmount: 1 });
CreditPlanSchema.index({ validityPeriod: 1 });

// Pre-save validation middleware
CreditPlanSchema.pre('save', async function(next) {
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
  
  // Validate bonus credits logic
  if (this.bonusCredits > this.creditAmount) {
    return next(new Error('Bonus credits cannot exceed base credit amount'));
  }
  
  next();
});

// Instance method to get total credits (base + bonus)
CreditPlanSchema.methods.getTotalCredits = function(): number {
  return this.creditAmount + this.bonusCredits;
};

// Instance method to check if a class is included in the plan
CreditPlanSchema.methods.isClassIncluded = function(classId: ObjectId): boolean {
  // Empty array means all classes are included
  if (this.includedClasses.length === 0) {
    return true;
  }
  
  // Check if specific class is included
  return this.includedClasses.some((id: ObjectId) => id.toString() === classId.toString());
};

// Instance method to calculate expiry date from purchase date
CreditPlanSchema.methods.getExpiryDate = function(purchaseDate?: Date): Date {
  const baseDate = purchaseDate || new Date();
  const expiryDate = new Date(baseDate);
  expiryDate.setDate(expiryDate.getDate() + this.validityPeriod);
  return expiryDate;
};

export const CreditPlan = mongoose.model<ICreditPlan>('CreditPlan', CreditPlanSchema);