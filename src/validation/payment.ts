import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';

// Validation schemas
const subscriptionPaymentIntentSchema = Joi.object({
  subscriptionPlanId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Subscription plan ID must be a valid MongoDB ObjectId',
      'any.required': 'Subscription plan ID is required'
    }),
  paymentMethodId: Joi.string()
    .pattern(/^pm_[a-zA-Z0-9_]+$/)
    .optional()
    .messages({
      'string.pattern.base': 'Payment method ID must be a valid Stripe PaymentMethod ID'
    })
});

const creditPaymentIntentSchema = Joi.object({
  creditPlanId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Credit plan ID must be a valid MongoDB ObjectId',
      'any.required': 'Credit plan ID is required'
    }),
  paymentMethodId: Joi.string()
    .pattern(/^pm_[a-zA-Z0-9_]+$/)
    .optional()
    .messages({
      'string.pattern.base': 'Payment method ID must be a valid Stripe PaymentMethod ID'
    })
});

const paymentConfirmationSchema = Joi.object({
  paymentIntentId: Joi.string()
    .pattern(/^pi_[a-zA-Z0-9_]+$/)
    .required()
    .messages({
      'string.pattern.base': 'Payment intent ID must be a valid Stripe PaymentIntent ID',
      'any.required': 'Payment intent ID is required'
    })
});

const paymentHistoryQuerySchema = Joi.object({
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(20)
    .messages({
      'number.base': 'Limit must be a number',
      'number.integer': 'Limit must be an integer',
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 100'
    }),
  offset: Joi.number()
    .integer()
    .min(0)
    .default(0)
    .messages({
      'number.base': 'Offset must be a number',
      'number.integer': 'Offset must be an integer',
      'number.min': 'Offset cannot be negative'
    }),
  status: Joi.string()
    .valid('pending', 'processing', 'succeeded', 'failed', 'cancelled', 'refunded')
    .optional()
    .messages({
      'any.only': 'Status must be one of: pending, processing, succeeded, failed, cancelled, refunded'
    }),
  type: Joi.string()
    .valid('subscription', 'credit_purchase', 'refund')
    .optional()
    .messages({
      'any.only': 'Type must be one of: subscription, credit_purchase, refund'
    }),
  startDate: Joi.date()
    .iso()
    .optional()
    .messages({
      'date.format': 'Start date must be a valid ISO date'
    }),
  endDate: Joi.date()
    .iso()
    .min(Joi.ref('startDate'))
    .optional()
    .messages({
      'date.format': 'End date must be a valid ISO date',
      'date.min': 'End date must be after start date'
    })
});

const paymentIdParamSchema = Joi.object({
  paymentId: Joi.alternatives()
    .try(
      Joi.string().pattern(/^[0-9a-fA-F]{24}$/), // MongoDB ObjectId
      Joi.string().pattern(/^pi_[a-zA-Z0-9_]+$/) // Stripe PaymentIntent ID
    )
    .required()
    .messages({
      'alternatives.match': 'Payment ID must be a valid MongoDB ObjectId or Stripe PaymentIntent ID',
      'any.required': 'Payment ID is required'
    })
});

// Validation middleware functions
export const validateSubscriptionPaymentIntent = (req: Request, res: Response, next: NextFunction): void => {
  const { error } = subscriptionPaymentIntentSchema.validate(req.body);
  
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
  
  next();
};

export const validateCreditPaymentIntent = (req: Request, res: Response, next: NextFunction): void => {
  const { error } = creditPaymentIntentSchema.validate(req.body);
  
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
  
  next();
};

export const validatePaymentConfirmation = (req: Request, res: Response, next: NextFunction): void => {
  const { error } = paymentConfirmationSchema.validate(req.body);
  
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
  
  next();
};

export const validatePaymentHistoryQuery = (req: Request, res: Response, next: NextFunction): void => {
  const { error, value } = paymentHistoryQuerySchema.validate(req.query);
  
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
  
  // Replace query with validated values
  req.query = value;
  next();
};

export const validatePaymentIdParam = (req: Request, res: Response, next: NextFunction): void => {
  const { error } = paymentIdParamSchema.validate(req.params);
  
  if (error) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_001',
        message: 'Invalid payment ID',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      }
    });
    return;
  }
  
  next();
};

// Webhook validation (raw body required)
export const validateWebhookSignature = (req: Request, res: Response, next: NextFunction): void => {
  const signature = req.headers['stripe-signature'];
  
  if (!signature) {
    res.status(400).json({
      success: false,
      error: {
        code: 'WEBHOOK_001',
        message: 'Missing Stripe signature header'
      }
    });
    return;
  }
  
  if (typeof signature !== 'string') {
    res.status(400).json({
      success: false,
      error: {
        code: 'WEBHOOK_001',
        message: 'Invalid Stripe signature format'
      }
    });
    return;
  }
  
  // Validate that we have raw body for webhook verification
  if (!req.body || typeof req.body !== 'string') {
    res.status(400).json({
      success: false,
      error: {
        code: 'WEBHOOK_002',
        message: 'Webhook requires raw body'
      }
    });
    return;
  }
  
  next();
};

// Additional validation helpers
export const validatePaymentAmount = (amount: number): boolean => {
  return Number.isInteger(amount) && amount > 0 && amount <= 10000000; // Max $100,000
};

export const validateCurrency = (currency: string): boolean => {
  const supportedCurrencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];
  return supportedCurrencies.includes(currency.toUpperCase());
};

export const validatePaymentMethodType = (type: string): boolean => {
  const supportedTypes = ['card', 'bank_account', 'sepa_debit'];
  return supportedTypes.includes(type);
};

// Business rule validation
export const validateSubscriptionEligibility = async (clientId: string, brandId: string): Promise<{ valid: boolean; reason?: string }> => {
  try {
    // Import here to avoid circular dependencies
    const { Subscription } = await import('../models/Subscription');
    
    // Check for existing active subscription
    const existingSubscription = await Subscription.findOne({
      client: clientId,
      brand: brandId,
      status: 'active'
    });
    
    if (existingSubscription) {
      return {
        valid: false,
        reason: 'Client already has an active subscription with this brand'
      };
    }
    
    return { valid: true };
  } catch (error) {
    console.error('Error validating subscription eligibility:', error);
    return {
      valid: false,
      reason: 'Unable to validate subscription eligibility'
    };
  }
};

export const validateCreditPurchaseEligibility = async (clientId: string, brandId: string): Promise<{ valid: boolean; reason?: string }> => {
  try {
    // Import here to avoid circular dependencies
    const { Client } = await import('../models/Client');
    const { Brand } = await import('../models/Brand');
    
    // Validate client exists and is active
    const client = await Client.findById(clientId);
    if (!client || client.status !== 'active') {
      return {
        valid: false,
        reason: 'Client not found or inactive'
      };
    }
    
    // Validate brand exists and is active
    const brand = await Brand.findById(brandId);
    if (!brand || brand.status !== 'active') {
      return {
        valid: false,
        reason: 'Brand not found or inactive'
      };
    }
    
    return { valid: true };
  } catch (error) {
    console.error('Error validating credit purchase eligibility:', error);
    return {
      valid: false,
      reason: 'Unable to validate credit purchase eligibility'
    };
  }
};

// Export validation schemas for testing
export const validationSchemas = {
  subscriptionPaymentIntentSchema,
  creditPaymentIntentSchema,
  paymentConfirmationSchema,
  paymentHistoryQuerySchema,
  paymentIdParamSchema
};