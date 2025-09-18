import { Request, Response } from 'express';
import CreditService from '../services/CreditService';
import paymentService from '../services/paymentService';
import { CreditPlan } from '../models/CreditPlan';
import { 
  creditPurchaseSchema, 
  creditBalanceQuerySchema 
} from '../validation/clientCredit';
import mongoose from 'mongoose';

class ClientCreditController {
  /**
   * Purchase credit plan
   */
  public static async purchaseCreditPlan(req: Request, res: Response): Promise<void> {
    try {
      // Validate request body
      const { error, value } = creditPurchaseSchema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_001',
            message: 'Invalid input data',
            details: error.details.map(detail => ({
              field: detail.path.join('.'),
              message: detail.message
            }))
          }
        });
        return;
      }

      const clientId = req.user!.id;
      const { creditPlanId, paymentMethodId } = value;

      // Validate credit plan exists and is active
      const creditPlan = await CreditPlan.findById(creditPlanId).populate('brand');
      if (!creditPlan) {
        res.status(404).json({
          success: false,
          error: {
            code: 'PLAN_001',
            message: 'Credit plan not found'
          }
        });
        return;
      }

      if (creditPlan.status !== 'active') {
        res.status(400).json({
          success: false,
          error: {
            code: 'PLAN_002',
            message: 'Credit plan is not active'
          }
        });
        return;
      }

      // Create PaymentIntent for credit purchase
      const paymentIntentData = await paymentService.createCreditPaymentIntent({
        clientId,
        creditPlanId,
        paymentMethodId
      });

      res.status(200).json({
        success: true,
        data: {
          paymentIntent: paymentIntentData,
          creditPlan: {
            id: creditPlan._id,
            name: creditPlan.name,
            price: creditPlan.price,
            creditAmount: creditPlan.creditAmount,
            bonusCredits: creditPlan.bonusCredits,
            totalCredits: creditPlan.getTotalCredits(),
            validityPeriod: creditPlan.validityPeriod,
            brand: creditPlan.brand
          }
        }
      });
    } catch (error: any) {
      console.error('Error purchasing credit plan:', error);
      
      if (error.code && error.statusCode) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message
          }
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_001',
          message: 'Internal server error'
        }
      });
    }
  }

  /**
   * Get client's credit balances
   */
  public static async getCreditBalances(req: Request, res: Response): Promise<void> {
    try {
      // Validate query parameters
      const { error, value } = creditBalanceQuerySchema.validate(req.query);
      if (error) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_001',
            message: 'Invalid query parameters',
            details: error.details.map(detail => ({
              field: detail.path.join('.'),
              message: detail.message
            }))
          }
        });
        return;
      }

      const clientId = req.user!.id;
      const { brandId } = value;

      if (brandId) {
        // Get credit balance for specific brand
        const creditBalance = await CreditService.getCreditBalance(clientId, brandId);
        
        res.status(200).json({
          success: true,
          data: {
            creditBalance
          }
        });
      } else {
        // Get all credit balances for client
        const creditBalances = await CreditService.getClientCreditBalances(clientId);
        
        res.status(200).json({
          success: true,
          data: {
            creditBalances
          }
        });
      }
    } catch (error: any) {
      console.error('Error fetching credit balances:', error);
      
      if (error.code && error.statusCode) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message
          }
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_001',
          message: 'Internal server error'
        }
      });
    }
  }

  /**
   * Get credit transaction history
   */
  public static async getCreditTransactionHistory(req: Request, res: Response): Promise<void> {
    try {
      const { brandId } = req.params;
      const clientId = req.user!.id;

      // Validate brandId format
      if (!mongoose.Types.ObjectId.isValid(brandId)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_001',
            message: 'Invalid brand ID format'
          }
        });
        return;
      }

      // Parse pagination parameters
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = (page - 1) * limit;

      const transactions = await CreditService.getCreditTransactionHistory(
        clientId, 
        brandId, 
        limit, 
        offset
      );

      res.status(200).json({
        success: true,
        data: {
          transactions,
          pagination: {
            page,
            limit,
            hasNext: transactions.length === limit,
            hasPrev: page > 1
          }
        }
      });
    } catch (error: any) {
      console.error('Error fetching credit transaction history:', error);
      
      if (error.code && error.statusCode) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message
          }
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_001',
          message: 'Internal server error'
        }
      });
    }
  }

  /**
   * Get credits expiring soon
   */
  public static async getExpiringCredits(req: Request, res: Response): Promise<void> {
    try {
      const clientId = req.user!.id;
      const days = parseInt(req.query.days as string) || 7;

      // Validate days parameter
      if (days < 1 || days > 365) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_001',
            message: 'Days parameter must be between 1 and 365'
          }
        });
        return;
      }

      const expiringCredits = await CreditService.getExpiringCredits(clientId, days);

      res.status(200).json({
        success: true,
        data: {
          expiringCredits,
          daysAhead: days,
          totalBrandsAffected: expiringCredits.length
        }
      });
    } catch (error: any) {
      console.error('Error fetching expiring credits:', error);
      
      if (error.code && error.statusCode) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message
          }
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_001',
          message: 'Internal server error'
        }
      });
    }
  }

  /**
   * Check credit eligibility for a specific class
   */
  public static async checkCreditEligibility(req: Request, res: Response): Promise<void> {
    try {
      const { brandId, classId } = req.params;
      const clientId = req.user!.id;
      const amount = parseInt(req.query.amount as string) || 1;

      // Validate ObjectId formats
      if (!mongoose.Types.ObjectId.isValid(brandId) || !mongoose.Types.ObjectId.isValid(classId)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_001',
            message: 'Invalid brand ID or class ID format'
          }
        });
        return;
      }

      // Validate amount
      if (amount < 1 || amount > 10) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_001',
            message: 'Amount must be between 1 and 10'
          }
        });
        return;
      }

      const eligibility = await CreditService.validateCreditEligibility(
        clientId, 
        brandId, 
        classId, 
        amount
      );

      res.status(200).json({
        success: true,
        data: {
          eligibility
        }
      });
    } catch (error: any) {
      console.error('Error checking credit eligibility:', error);
      
      if (error.code && error.statusCode) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message
          }
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_001',
          message: 'Internal server error'
        }
      });
    }
  }
}

export default ClientCreditController;