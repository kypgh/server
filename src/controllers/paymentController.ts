import { Request, Response, NextFunction } from 'express';
import paymentService, { 
  SubscriptionPurchaseRequest, 
  CreditPurchaseRequest, 
  PaymentConfirmationRequest,
  PaymentProcessingError 
} from '../services/paymentService';
import { AuthenticatedRequest } from '../middleware/auth';
import Stripe from 'stripe';
import config from '../config/environment';

export class PaymentController {
  /**
   * Create PaymentIntent for subscription purchase
   */
  async createSubscriptionPaymentIntent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = req.user?.id;
      
      if (!clientId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTH_003',
            message: 'Unauthorized access'
          }
        });
        return;
      }

      const { subscriptionPlanId, paymentMethodId } = req.body;

      if (!subscriptionPlanId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_001',
            message: 'Subscription plan ID is required'
          }
        });
        return;
      }

      const request: SubscriptionPurchaseRequest = {
        clientId,
        subscriptionPlanId,
        paymentMethodId
      };

      const paymentIntentData = await paymentService.createSubscriptionPaymentIntent(request);

      res.status(201).json({
        success: true,
        data: {
          paymentIntent: paymentIntentData,
          message: 'Subscription payment intent created successfully'
        }
      });
    } catch (error) {
      console.error('Error in createSubscriptionPaymentIntent:', error);
      this.handlePaymentError(error, res, next);
    }
  }

  /**
   * Create PaymentIntent for credit plan purchase
   */
  async createCreditPaymentIntent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = req.user?.id;
      
      if (!clientId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTH_003',
            message: 'Unauthorized access'
          }
        });
        return;
      }

      const { creditPlanId, paymentMethodId } = req.body;

      if (!creditPlanId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_001',
            message: 'Credit plan ID is required'
          }
        });
        return;
      }

      const request: CreditPurchaseRequest = {
        clientId,
        creditPlanId,
        paymentMethodId
      };

      const paymentIntentData = await paymentService.createCreditPaymentIntent(request);

      res.status(201).json({
        success: true,
        data: {
          paymentIntent: paymentIntentData,
          message: 'Credit purchase payment intent created successfully'
        }
      });
    } catch (error) {
      console.error('Error in createCreditPaymentIntent:', error);
      this.handlePaymentError(error, res, next);
    }
  }

  /**
   * Confirm payment completion
   */
  async confirmPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = req.user?.id;
      
      if (!clientId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTH_003',
            message: 'Unauthorized access'
          }
        });
        return;
      }

      const { paymentIntentId } = req.body;

      if (!paymentIntentId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_001',
            message: 'Payment intent ID is required'
          }
        });
        return;
      }

      const request: PaymentConfirmationRequest = {
        paymentIntentId,
        clientId
      };

      const result = await paymentService.confirmPayment(request);

      if (result.success) {
        res.status(200).json({
          success: true,
          data: {
            payment: {
              id: result.payment._id,
              status: result.payment.status,
              amount: result.payment.amount,
              currency: result.payment.currency,
              type: result.payment.type,
              processedAt: result.payment.processedAt
            },
            message: 'Payment confirmed successfully'
          }
        });
      } else {
        res.status(400).json({
          success: false,
          error: {
            code: 'PAYMENT_003',
            message: 'Payment confirmation failed',
            details: {
              status: result.payment.status,
              failureReason: result.payment.failureReason
            }
          }
        });
      }
    } catch (error) {
      console.error('Error in confirmPayment:', error);
      this.handlePaymentError(error, res, next);
    }
  }

  /**
   * Get client's payment history
   */
  async getClientPaymentHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = req.user?.id;
      
      if (!clientId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTH_003',
            message: 'Unauthorized access'
          }
        });
        return;
      }

      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;

      if (limit > 100) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_001',
            message: 'Limit cannot exceed 100'
          }
        });
        return;
      }

      const payments = await paymentService.getClientPaymentHistory(clientId, limit, offset);

      res.status(200).json({
        success: true,
        data: {
          payments: payments.map(payment => ({
            id: payment._id,
            type: payment.type,
            status: payment.status,
            amount: payment.amount,
            currency: payment.currency,
            brand: payment.brand,
            createdAt: payment.createdAt,
            processedAt: payment.processedAt,
            failureReason: payment.failureReason
          })),
          pagination: {
            limit,
            offset,
            hasMore: payments.length === limit
          }
        }
      });
    } catch (error) {
      console.error('Error in getClientPaymentHistory:', error);
      next(error);
    }
  }

  /**
   * Get brand's payment history
   */
  async getBrandPaymentHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const brandId = req.user?.id;
      
      if (!brandId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTH_003',
            message: 'Unauthorized access'
          }
        });
        return;
      }

      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;

      if (limit > 100) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_001',
            message: 'Limit cannot exceed 100'
          }
        });
        return;
      }

      const payments = await paymentService.getBrandPaymentHistory(brandId, limit, offset);

      res.status(200).json({
        success: true,
        data: {
          payments: payments.map(payment => ({
            id: payment._id,
            type: payment.type,
            status: payment.status,
            amount: payment.amount,
            currency: payment.currency,
            client: payment.client,
            createdAt: payment.createdAt,
            processedAt: payment.processedAt,
            failureReason: payment.failureReason
          })),
          pagination: {
            limit,
            offset,
            hasMore: payments.length === limit
          }
        }
      });
    } catch (error) {
      console.error('Error in getBrandPaymentHistory:', error);
      next(error);
    }
  }

  /**
   * Handle Stripe webhooks
   */
  async handleWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sig = req.headers['stripe-signature'] as string;
      
      if (!sig) {
        res.status(400).json({
          success: false,
          error: {
            code: 'WEBHOOK_001',
            message: 'Missing Stripe signature'
          }
        });
        return;
      }

      if (!config.stripe.webhookSecret) {
        console.error('Stripe webhook secret not configured');
        res.status(500).json({
          success: false,
          error: {
            code: 'WEBHOOK_002',
            message: 'Webhook configuration error'
          }
        });
        return;
      }

      let event: Stripe.Event;

      try {
        const stripe = new Stripe(config.stripe.secretKey, {
          apiVersion: '2023-10-16',
        });
        
        event = stripe.webhooks.constructEvent(req.body, sig, config.stripe.webhookSecret);
      } catch (err) {
        console.error('Webhook signature verification failed:', err);
        res.status(400).json({
          success: false,
          error: {
            code: 'WEBHOOK_003',
            message: 'Invalid webhook signature'
          }
        });
        return;
      }

      // Handle the event
      await paymentService.handleWebhookEvent(event);

      res.status(200).json({
        success: true,
        message: 'Webhook processed successfully'
      });
    } catch (error) {
      console.error('Error in handleWebhook:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'WEBHOOK_004',
          message: 'Webhook processing failed'
        }
      });
    }
  }

  /**
   * Get payment details by ID
   */
  async getPaymentDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = req.user?.id;
      const { paymentId } = req.params;
      
      if (!clientId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTH_003',
            message: 'Unauthorized access'
          }
        });
        return;
      }

      if (!paymentId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_001',
            message: 'Payment ID is required'
          }
        });
        return;
      }

      const payment = await paymentService.getPaymentByIntentId(paymentId);
      
      if (!payment) {
        res.status(404).json({
          success: false,
          error: {
            code: 'PAYMENT_001',
            message: 'Payment not found'
          }
        });
        return;
      }

      // Verify payment belongs to the requesting client
      if (payment.client.toString() !== clientId) {
        res.status(403).json({
          success: false,
          error: {
            code: 'AUTH_003',
            message: 'Access denied'
          }
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          payment: {
            id: payment._id,
            type: payment.type,
            status: payment.status,
            amount: payment.amount,
            currency: payment.currency,
            paymentIntentId: payment.paymentIntentId,
            createdAt: payment.createdAt,
            processedAt: payment.processedAt,
            failureReason: payment.failureReason,
            metadata: payment.metadata
          }
        }
      });
    } catch (error) {
      console.error('Error in getPaymentDetails:', error);
      next(error);
    }
  }

  /**
   * Handle payment-specific errors
   */
  private handlePaymentError(error: any, res: Response, next: NextFunction): void {
    if (error.code && error.statusCode) {
      // Custom payment error
      const paymentError = error as PaymentProcessingError;
      res.status(paymentError.statusCode).json({
        success: false,
        error: {
          code: paymentError.code,
          message: paymentError.message
        }
      });
    } else if (error.type && error.type.startsWith('Stripe')) {
      // Stripe error
      res.status(400).json({
        success: false,
        error: {
          code: 'STRIPE_ERROR',
          message: error.message || 'Payment processing error'
        }
      });
    } else {
      // Generic error
      next(error);
    }
  }
}

export default new PaymentController();