import mongoose from 'mongoose';
import { CreditBalance, ICreditBalance, CreditPackage, CreditTransaction } from '../models/CreditBalance';
import { CreditPlan, ICreditPlan } from '../models/CreditPlan';
import { Client } from '../models/Client';
import { Brand } from '../models/Brand';

type ObjectId = mongoose.Types.ObjectId;

export interface CreditDeductionResult {
  success: boolean;
  transactions: CreditTransaction[];
  remainingCredits: number;
}

export interface CreditPurchaseResult {
  success: boolean;
  creditBalance: ICreditBalance;
  creditPackage: CreditPackage;
}

export interface CreditBalanceInfo {
  availableCredits: number;
  totalCreditsEarned: number;
  totalCreditsUsed: number;
  creditPackages: CreditPackage[];
  expiringCredits: CreditPackage[];
}

export interface CreditServiceError extends Error {
  code: string;
  statusCode: number;
}

class CreditService {
  /**
   * Purchase credit plan and create credit balance
   */
  async purchaseCreditPlan(
    clientId: string, 
    creditPlanId: string, 
    paymentIntentId?: string
  ): Promise<CreditPurchaseResult> {
    // Use transactions only if supported (not in test environment)
    const useTransactions = process.env.NODE_ENV !== 'test';
    let session: mongoose.ClientSession | undefined;
    
    if (useTransactions) {
      session = await mongoose.startSession();
      session.startTransaction();
    }

    try {
      // Validate client exists
      const clientQuery = Client.findById(clientId);
      if (session) clientQuery.session(session);
      const client = await clientQuery;
      if (!client) {
        throw this.createError('CLIENT_001', 'Client not found', 404);
      }

      // Validate credit plan exists and is active
      const planQuery = CreditPlan.findById(creditPlanId).populate('brand');
      if (session) planQuery.session(session);
      const creditPlan = await planQuery;
      if (!creditPlan) {
        throw this.createError('PLAN_001', 'Credit plan not found', 404);
      }

      if (creditPlan.status !== 'active') {
        throw this.createError('PLAN_002', 'Credit plan is not active', 400);
      }

      const brand = creditPlan.brand as any;

      // Get or create credit balance for client-brand combination
      const balanceQuery = CreditBalance.findOne({
        client: clientId,
        brand: brand._id
      });
      if (session) balanceQuery.session(session);
      let creditBalance = await balanceQuery;

      if (!creditBalance) {
        creditBalance = new CreditBalance({
          client: clientId,
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

      // Add credit package to balance
      const creditPlanObjectId = new mongoose.Types.ObjectId(creditPlanId);
      const creditPackage = await creditBalance.addCreditPackage(creditPlanObjectId, paymentIntentId);

      if (session) {
        await session.commitTransaction();
      }

      return {
        success: true,
        creditBalance,
        creditPackage
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
   * Deduct credits using FIFO algorithm
   */
  async deductCredits(
    clientId: string, 
    brandId: string, 
    amount: number = 1, 
    bookingId?: string
  ): Promise<CreditDeductionResult> {
    // Use transactions only if supported (not in test environment)
    const useTransactions = process.env.NODE_ENV !== 'test';
    let session: mongoose.ClientSession | undefined;
    
    if (useTransactions) {
      session = await mongoose.startSession();
      session.startTransaction();
    }

    try {
      // Find credit balance
      const balanceQuery = CreditBalance.findOne({
        client: clientId,
        brand: brandId
      });
      if (session) balanceQuery.session(session);
      const creditBalance = await balanceQuery;

      if (!creditBalance) {
        throw this.createError('CREDIT_001', 'No credit balance found for this brand', 404);
      }

      if (creditBalance.availableCredits < amount) {
        throw this.createError('CREDIT_002', 'Insufficient credits available', 400);
      }

      // Cleanup expired packages first
      await creditBalance.cleanupExpiredPackages();

      // Deduct credits using FIFO
      const bookingObjectId = bookingId ? new mongoose.Types.ObjectId(bookingId) : undefined;
      const transactions = await creditBalance.deductCredits(amount, bookingObjectId);

      if (session) {
        await session.commitTransaction();
      }

      return {
        success: true,
        transactions,
        remainingCredits: creditBalance.availableCredits
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
   * Refund credits (restore to original package if possible)
   */
  async refundCredits(
    clientId: string, 
    brandId: string, 
    amount: number, 
    bookingId?: string
  ): Promise<CreditTransaction> {
    // Use transactions only if supported (not in test environment)
    const useTransactions = process.env.NODE_ENV !== 'test';
    let session: mongoose.ClientSession | undefined;
    
    if (useTransactions) {
      session = await mongoose.startSession();
      session.startTransaction();
    }

    try {
      // Find credit balance
      const balanceQuery = CreditBalance.findOne({
        client: clientId,
        brand: brandId
      });
      if (session) balanceQuery.session(session);
      const creditBalance = await balanceQuery;

      if (!creditBalance) {
        throw this.createError('CREDIT_001', 'No credit balance found for this brand', 404);
      }

      // Refund credits
      const bookingObjectId = bookingId ? new mongoose.Types.ObjectId(bookingId) : undefined;
      const transaction = await creditBalance.refundCredits(amount, bookingObjectId);

      if (session) {
        await session.commitTransaction();
      }

      return transaction;

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
   * Get credit balance information for a client and brand
   */
  async getCreditBalance(clientId: string, brandId: string): Promise<CreditBalanceInfo> {
    const creditBalance = await CreditBalance.findOne({
      client: clientId,
      brand: brandId
    }).populate([
      { path: 'client', select: 'firstName lastName email' },
      { path: 'brand', select: 'name' },
      { path: 'creditPackages.creditPlan', select: 'name creditAmount bonusCredits validityPeriod' }
    ]);

    if (!creditBalance) {
      throw this.createError('CREDIT_001', 'No credit balance found for this brand', 404);
    }

    // Cleanup expired packages
    await creditBalance.cleanupExpiredPackages();

    // Get credits expiring in next 7 days
    const expiringCredits = creditBalance.getExpiringCredits(7);

    return {
      availableCredits: creditBalance.availableCredits,
      totalCreditsEarned: creditBalance.totalCreditsEarned,
      totalCreditsUsed: creditBalance.totalCreditsUsed,
      creditPackages: creditBalance.creditPackages.filter(pkg => 
        pkg.status === 'active' && pkg.creditsRemaining > 0
      ),
      expiringCredits
    };
  }

  /**
   * Get all credit balances for a client
   */
  async getClientCreditBalances(clientId: string): Promise<ICreditBalance[]> {
    const creditBalances = await CreditBalance.find({
      client: clientId,
      status: 'active'
    }).populate([
      { path: 'brand', select: 'name logo' },
      { path: 'creditPackages.creditPlan', select: 'name creditAmount bonusCredits validityPeriod' }
    ]);

    // Cleanup expired packages for all balances
    for (const balance of creditBalances) {
      await balance.cleanupExpiredPackages();
    }

    return creditBalances.filter(balance => balance.availableCredits > 0);
  }

  /**
   * Get available credits for a specific class
   */
  async getAvailableCreditsForClass(
    clientId: string, 
    brandId: string, 
    classId: string
  ): Promise<number> {
    const creditBalance = await CreditBalance.findOne({
      client: clientId,
      brand: brandId
    });

    if (!creditBalance) {
      return 0;
    }

    // Cleanup expired packages first
    await creditBalance.cleanupExpiredPackages();

    const classObjectId = new mongoose.Types.ObjectId(classId);
    return creditBalance.getAvailableCreditsForClass(classObjectId);
  }

  /**
   * Cleanup expired credit packages across all balances
   */
  async cleanupExpiredPackages(): Promise<void> {
    const expiredBalances = await CreditBalance.find({
      'creditPackages.expiryDate': { $lte: new Date() },
      'creditPackages.status': 'active'
    });

    for (const balance of expiredBalances) {
      await balance.cleanupExpiredPackages();
    }
  }

  /**
   * Get credit transaction history for a client and brand
   */
  async getCreditTransactionHistory(
    clientId: string, 
    brandId: string, 
    limit: number = 20, 
    offset: number = 0
  ): Promise<CreditTransaction[]> {
    const creditBalance = await CreditBalance.findOne({
      client: clientId,
      brand: brandId
    });

    if (!creditBalance) {
      return [];
    }

    // Sort transactions by timestamp (newest first) and apply pagination
    return creditBalance.transactions
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(offset, offset + limit);
  }

  /**
   * Validate credit eligibility for booking
   */
  async validateCreditEligibility(
    clientId: string, 
    brandId: string, 
    classId: string, 
    amount: number = 1
  ): Promise<{ eligible: boolean; availableCredits: number; message?: string }> {
    try {
      const availableCredits = await this.getAvailableCreditsForClass(clientId, brandId, classId);
      
      if (availableCredits < amount) {
        return {
          eligible: false,
          availableCredits,
          message: `Insufficient credits. You have ${availableCredits} credits available, but need ${amount}.`
        };
      }

      return {
        eligible: true,
        availableCredits
      };
    } catch (error) {
      return {
        eligible: false,
        availableCredits: 0,
        message: 'Unable to validate credit eligibility'
      };
    }
  }

  /**
   * Get credits expiring soon for a client
   */
  async getExpiringCredits(clientId: string, days: number = 7): Promise<{
    brand: any;
    expiringPackages: CreditPackage[];
    totalExpiringCredits: number;
  }[]> {
    const creditBalances = await CreditBalance.find({
      client: clientId,
      status: 'active'
    }).populate('brand', 'name logo');

    const result = [];

    for (const balance of creditBalances) {
      const expiringPackages = balance.getExpiringCredits(days);
      if (expiringPackages.length > 0) {
        const totalExpiringCredits = expiringPackages.reduce(
          (sum, pkg) => sum + pkg.creditsRemaining, 
          0
        );
        
        result.push({
          brand: balance.brand,
          expiringPackages,
          totalExpiringCredits
        });
      }
    }

    return result;
  }

  private createError(code: string, message: string, statusCode: number): CreditServiceError {
    const error = new Error(message) as CreditServiceError;
    error.code = code;
    error.statusCode = statusCode;
    return error;
  }
}

export default new CreditService();