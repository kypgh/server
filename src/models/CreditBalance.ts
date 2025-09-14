import mongoose, { Schema, Document } from 'mongoose';

type ObjectId = mongoose.Types.ObjectId;

// Interfaces
export interface CreditPackage {
  _id?: ObjectId;
  creditPlan: ObjectId;
  purchaseDate: Date;
  expiryDate: Date;
  originalCredits: number;
  creditsRemaining: number;
  paymentIntentId?: string;
  status: 'active' | 'expired' | 'consumed';
}

export interface CreditTransaction {
  _id?: ObjectId;
  type: 'purchase' | 'deduction' | 'refund' | 'expiry';
  amount: number;
  packageId?: ObjectId;
  bookingId?: ObjectId;
  description: string;
  timestamp: Date;
}

export interface ICreditBalance extends Document {
  _id: ObjectId;
  client: ObjectId;
  brand: ObjectId;
  availableCredits: number;
  totalCreditsEarned: number;
  totalCreditsUsed: number;
  creditPackages: CreditPackage[];
  transactions: CreditTransaction[];
  status: 'active' | 'inactive';
  lastActivityDate: Date;
  createdAt: Date;
  updatedAt: Date;
  addCreditPackage(creditPlan: ObjectId, paymentIntentId?: string): Promise<CreditPackage>; // Instance method
  deductCredits(amount: number, bookingId?: ObjectId): Promise<CreditTransaction[]>; // Instance method
  refundCredits(amount: number, bookingId?: ObjectId): Promise<CreditTransaction>; // Instance method
  getAvailableCreditsForClass(classId: ObjectId): Promise<number>; // Instance method
  cleanupExpiredPackages(): Promise<CreditTransaction[]>; // Instance method
  getExpiringCredits(days: number): CreditPackage[]; // Instance method
}

// Credit Package Schema
const CreditPackageSchema = new Schema<CreditPackage>({
  creditPlan: { 
    type: Schema.Types.ObjectId, 
    ref: 'CreditPlan',
    required: [true, 'Credit plan is required']
  },
  purchaseDate: { 
    type: Date, 
    required: [true, 'Purchase date is required'],
    default: Date.now
  },
  expiryDate: { 
    type: Date, 
    required: [true, 'Expiry date is required'],
    validate: {
      validator: function(this: CreditPackage, value: Date) {
        return value > this.purchaseDate;
      },
      message: 'Expiry date must be after purchase date'
    }
  },
  originalCredits: { 
    type: Number, 
    required: [true, 'Original credits is required'],
    min: [1, 'Original credits must be at least 1'],
    validate: {
      validator: Number.isInteger,
      message: 'Original credits must be a whole number'
    }
  },
  creditsRemaining: { 
    type: Number, 
    required: [true, 'Credits remaining is required'],
    min: [0, 'Credits remaining cannot be negative'],
    validate: {
      validator: Number.isInteger,
      message: 'Credits remaining must be a whole number'
    }
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
  status: { 
    type: String, 
    enum: {
      values: ['active', 'expired', 'consumed'],
      message: 'Status must be active, expired, or consumed'
    },
    default: 'active'
  }
}, { 
  timestamps: false,
  _id: true 
});

// Credit Transaction Schema
const CreditTransactionSchema = new Schema<CreditTransaction>({
  type: { 
    type: String, 
    enum: {
      values: ['purchase', 'deduction', 'refund', 'expiry'],
      message: 'Type must be purchase, deduction, refund, or expiry'
    },
    required: [true, 'Transaction type is required']
  },
  amount: { 
    type: Number, 
    required: [true, 'Amount is required'],
    validate: {
      validator: Number.isInteger,
      message: 'Amount must be a whole number'
    }
  },
  packageId: { 
    type: Schema.Types.ObjectId,
    validate: {
      validator: function(this: CreditTransaction, value: ObjectId) {
        // Package ID is required for deduction, refund, and expiry transactions
        return this.type === 'purchase' || !!value;
      },
      message: 'Package ID is required for deduction, refund, and expiry transactions'
    }
  },
  bookingId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Booking'
  },
  description: { 
    type: String, 
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [200, 'Description cannot exceed 200 characters']
  },
  timestamp: { 
    type: Date, 
    required: [true, 'Timestamp is required'],
    default: Date.now
  }
}, { 
  timestamps: false,
  _id: true 
});

// Credit Balance Schema
const CreditBalanceSchema = new Schema<ICreditBalance>({
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
  availableCredits: { 
    type: Number, 
    required: true,
    min: [0, 'Available credits cannot be negative'],
    default: 0,
    validate: {
      validator: Number.isInteger,
      message: 'Available credits must be a whole number'
    }
  },
  totalCreditsEarned: { 
    type: Number, 
    required: true,
    min: [0, 'Total credits earned cannot be negative'],
    default: 0,
    validate: {
      validator: Number.isInteger,
      message: 'Total credits earned must be a whole number'
    }
  },
  totalCreditsUsed: { 
    type: Number, 
    required: true,
    min: [0, 'Total credits used cannot be negative'],
    default: 0,
    validate: {
      validator: Number.isInteger,
      message: 'Total credits used must be a whole number'
    }
  },
  creditPackages: [CreditPackageSchema],
  transactions: [CreditTransactionSchema],
  status: { 
    type: String, 
    enum: {
      values: ['active', 'inactive'],
      message: 'Status must be active or inactive'
    },
    default: 'active'
  },
  lastActivityDate: { 
    type: Date, 
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Compound Indexes for efficient queries
CreditBalanceSchema.index({ client: 1, brand: 1 }, { unique: true });
CreditBalanceSchema.index({ client: 1, status: 1 });
CreditBalanceSchema.index({ brand: 1, status: 1 });
CreditBalanceSchema.index({ availableCredits: 1 });
CreditBalanceSchema.index({ 'creditPackages.expiryDate': 1, status: 1 });
CreditBalanceSchema.index({ 'creditPackages.status': 1 });
CreditBalanceSchema.index({ 'transactions.timestamp': -1 });
CreditBalanceSchema.index({ 'transactions.type': 1 });

// Pre-save validation middleware
CreditBalanceSchema.pre('save', async function(next) {
  // Validate client exists
  const Client = mongoose.model('Client');
  const client = await Client.findById(this.client);
  if (!client) {
    return next(new Error('Client not found'));
  }

  // Validate brand exists
  const Brand = mongoose.model('Brand');
  const brand = await Brand.findById(this.brand);
  if (!brand) {
    return next(new Error('Brand not found'));
  }

  // Validate credit package consistency
  for (const pkg of this.creditPackages) {
    if (pkg.creditsRemaining > pkg.originalCredits) {
      return next(new Error('Credits remaining cannot exceed original credits'));
    }
    if (pkg.creditsRemaining === 0 && pkg.status === 'active') {
      pkg.status = 'consumed';
    }
    if (pkg.expiryDate <= new Date() && pkg.status === 'active') {
      pkg.status = 'expired';
    }
  }

  // Update last activity date
  this.lastActivityDate = new Date();

  next();
});

// Instance method to add a new credit package
CreditBalanceSchema.methods.addCreditPackage = async function(creditPlanId: ObjectId, paymentIntentId?: string): Promise<CreditPackage> {
  const CreditPlan = mongoose.model('CreditPlan');
  const plan = await CreditPlan.findById(creditPlanId);
  if (!plan) {
    throw new Error('Credit plan not found');
  }
  
  if (plan.brand.toString() !== this.brand.toString()) {
    throw new Error('Credit plan must belong to the same brand');
  }

  const totalCredits = plan.getTotalCredits();
  const expiryDate = plan.getExpiryDate();
  
  const newPackage: CreditPackage = {
    creditPlan: creditPlanId,
    purchaseDate: new Date(),
    expiryDate: expiryDate,
    originalCredits: totalCredits,
    creditsRemaining: totalCredits,
    paymentIntentId: paymentIntentId,
    status: 'active'
  };

  this.creditPackages.push(newPackage);
  this.availableCredits += totalCredits;
  this.totalCreditsEarned += totalCredits;

  // Add purchase transaction
  const transaction: CreditTransaction = {
    type: 'purchase',
    amount: totalCredits,
    description: `Purchased ${plan.name} - ${totalCredits} credits`,
    timestamp: new Date()
  };
  this.transactions.push(transaction);

  await this.save();
  return newPackage;
};

// Instance method to deduct credits using FIFO
CreditBalanceSchema.methods.deductCredits = async function(amount: number, bookingId?: ObjectId): Promise<CreditTransaction[]> {
  if (amount <= 0) {
    throw new Error('Deduction amount must be positive');
  }
  
  if (this.availableCredits < amount) {
    throw new Error('Insufficient credits available');
  }

  // Sort packages by purchase date (FIFO) and filter active, non-expired packages
  const availablePackages = this.creditPackages
    .filter((pkg: CreditPackage) => 
      pkg.status === 'active' && 
      pkg.creditsRemaining > 0 && 
      pkg.expiryDate > new Date()
    )
    .sort((a: CreditPackage, b: CreditPackage) => 
      a.purchaseDate.getTime() - b.purchaseDate.getTime()
    );

  let remainingToDeduct = amount;
  const transactions: CreditTransaction[] = [];

  for (const pkg of availablePackages) {
    if (remainingToDeduct <= 0) break;

    const deductFromPackage = Math.min(remainingToDeduct, pkg.creditsRemaining);
    pkg.creditsRemaining -= deductFromPackage;
    remainingToDeduct -= deductFromPackage;

    // Update package status if fully consumed
    if (pkg.creditsRemaining === 0) {
      pkg.status = 'consumed';
    }

    // Create transaction record
    const transaction: CreditTransaction = {
      type: 'deduction',
      amount: deductFromPackage,
      packageId: pkg._id,
      bookingId: bookingId,
      description: `Used ${deductFromPackage} credits for booking`,
      timestamp: new Date()
    };
    this.transactions.push(transaction);
    transactions.push(transaction);
  }

  // Update totals
  this.availableCredits -= amount;
  this.totalCreditsUsed += amount;

  await this.save();
  return transactions;
};

// Instance method to refund credits (restore to original package if possible)
CreditBalanceSchema.methods.refundCredits = async function(amount: number, bookingId?: ObjectId): Promise<CreditTransaction> {
  if (amount <= 0) {
    throw new Error('Refund amount must be positive');
  }

  // Try to find the original deduction transaction to restore to the same package
  let targetPackage: CreditPackage | null = null;
  
  if (bookingId) {
    const deductionTransaction = this.transactions
      .filter((t: CreditTransaction) => t.type === 'deduction' && t.bookingId?.toString() === bookingId.toString())
      .sort((a: CreditTransaction, b: CreditTransaction) => b.timestamp.getTime() - a.timestamp.getTime())[0];
    
    if (deductionTransaction && deductionTransaction.packageId) {
      targetPackage = this.creditPackages.find((pkg: CreditPackage) => 
        pkg._id?.toString() === deductionTransaction.packageId?.toString() &&
        pkg.expiryDate > new Date()
      ) || null;
    }
  }

  // If no target package found, add to the newest non-expired package
  if (!targetPackage) {
    targetPackage = this.creditPackages
      .filter((pkg: CreditPackage) => pkg.expiryDate > new Date())
      .sort((a: CreditPackage, b: CreditPackage) => b.purchaseDate.getTime() - a.purchaseDate.getTime())[0] || null;
  }

  if (targetPackage) {
    // Restore to existing package (but don't exceed original amount)
    const maxRestoration = targetPackage.originalCredits - targetPackage.creditsRemaining;
    const actualRefund = Math.min(amount, maxRestoration);
    
    if (actualRefund > 0) {
      targetPackage.creditsRemaining += actualRefund;
      if (targetPackage.status === 'consumed' && targetPackage.creditsRemaining > 0) {
        targetPackage.status = 'active';
      }
    }
    
    // If there's remaining refund amount, we'll lose it (business decision)
    // In a real system, you might want to create a new package or handle differently
  }

  // Update totals
  this.availableCredits += amount;
  this.totalCreditsUsed = Math.max(0, this.totalCreditsUsed - amount);

  // Create refund transaction
  const transaction: CreditTransaction = {
    type: 'refund',
    amount: amount,
    packageId: targetPackage?._id,
    bookingId: bookingId,
    description: `Refunded ${amount} credits from cancelled booking`,
    timestamp: new Date()
  };
  this.transactions.push(transaction);

  await this.save();
  return transaction;
};

// Instance method to get available credits for a specific class
CreditBalanceSchema.methods.getAvailableCreditsForClass = async function(classId: ObjectId): Promise<number> {
  // Get all active, non-expired packages
  const availablePackages = this.creditPackages.filter((pkg: CreditPackage) => 
    pkg.status === 'active' && 
    pkg.creditsRemaining > 0 && 
    pkg.expiryDate > new Date()
  );

  let totalAvailable = 0;

  for (const pkg of availablePackages) {
    const CreditPlan = mongoose.model('CreditPlan');
    const plan = await CreditPlan.findById(pkg.creditPlan);
    if (plan && plan.isClassIncluded(classId)) {
      totalAvailable += pkg.creditsRemaining;
    }
  }

  return totalAvailable;
};

// Instance method to cleanup expired packages
CreditBalanceSchema.methods.cleanupExpiredPackages = async function(): Promise<CreditTransaction[]> {
  const now = new Date();
  const transactions: CreditTransaction[] = [];
  let expiredCredits = 0;

  for (const pkg of this.creditPackages) {
    if (pkg.status === 'active' && pkg.expiryDate <= now && pkg.creditsRemaining > 0) {
      expiredCredits += pkg.creditsRemaining;
      pkg.status = 'expired';
      
      // Create expiry transaction
      const transaction: CreditTransaction = {
        type: 'expiry',
        amount: pkg.creditsRemaining,
        packageId: pkg._id,
        description: `${pkg.creditsRemaining} credits expired`,
        timestamp: now
      };
      this.transactions.push(transaction);
      transactions.push(transaction);
      
      // Set remaining credits to 0
      pkg.creditsRemaining = 0;
    }
  }

  if (expiredCredits > 0) {
    this.availableCredits = Math.max(0, this.availableCredits - expiredCredits);
    await this.save();
  }

  return transactions;
};

// Instance method to get credits expiring within specified days
CreditBalanceSchema.methods.getExpiringCredits = function(days: number): CreditPackage[] {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() + days);

  return this.creditPackages.filter((pkg: CreditPackage) => 
    pkg.status === 'active' && 
    pkg.creditsRemaining > 0 && 
    pkg.expiryDate <= cutoffDate &&
    pkg.expiryDate > new Date()
  );
};

export const CreditBalance = mongoose.model<ICreditBalance>('CreditBalance', CreditBalanceSchema);