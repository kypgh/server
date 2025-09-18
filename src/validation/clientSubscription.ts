import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';

// Validation schemas
const subscriptionPurchaseSchema = Joi.object({
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

const subscriptionQuerySchema = Joi.object({
  status: Joi.string()
    .valid('active', 'cancelled', 'expired', 'pending')
    .optional()
    .messages({
      'any.only': 'Status must be one of: active, cancelled, expired, pending'
    }),
  brandId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Brand ID must be a valid MongoDB ObjectId'
    }),
  page: Joi.number()
    .integer()
    .min(1)
    .default(1)
    .messages({
      'number.base': 'Page must be a number',
      'number.integer': 'Page must be an integer',
      'number.min': 'Page must be at least 1'
    }),
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
  sortBy: Joi.string()
    .valid('createdAt', 'startDate', 'endDate', 'nextBillingDate', 'status')
    .default('createdAt')
    .messages({
      'any.only': 'Sort by must be one of: createdAt, startDate, endDate, nextBillingDate, status'
    }),
  sortOrder: Joi.string()
    .valid('asc', 'desc')
    .default('desc')
    .messages({
      'any.only': 'Sort order must be asc or desc'
    })
});

const subscriptionCancellationSchema = Joi.object({
  reason: Joi.string()
    .trim()
    .max(500)
    .optional()
    .messages({
      'string.max': 'Cancellation reason cannot exceed 500 characters'
    })
});

const subscriptionIdParamSchema = Joi.object({
  subscriptionId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Subscription ID must be a valid MongoDB ObjectId',
      'any.required': 'Subscription ID is required'
    })
});

const bookingEligibilityQuerySchema = Joi.object({
  classId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Class ID must be a valid MongoDB ObjectId'
    })
});

// Validation middleware functions
export const validateSubscriptionPurchase = (req: Request, res: Response, next: NextFunction): void => {
  const { error } = subscriptionPurchaseSchema.validate(req.body);
  
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

export const validateSubscriptionQuery = (req: Request, res: Response, next: NextFunction): void => {
  const { error, value } = subscriptionQuerySchema.validate(req.query);
  
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

export const validateSubscriptionCancellation = (req: Request, res: Response, next: NextFunction): void => {
  const { error } = subscriptionCancellationSchema.validate(req.body);
  
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

export const validateSubscriptionIdParam = (req: Request, res: Response, next: NextFunction): void => {
  const { error } = subscriptionIdParamSchema.validate(req.params);
  
  if (error) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_001',
        message: 'Invalid subscription ID',
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

export const validateBookingEligibilityQuery = (req: Request, res: Response, next: NextFunction): void => {
  const { error, value } = bookingEligibilityQuerySchema.validate(req.query);
  
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

// Business validation helpers
export const validateSubscriptionStatus = (status: string): boolean => {
  const validStatuses = ['active', 'cancelled', 'expired', 'pending'];
  return validStatuses.includes(status);
};

export const validateBillingCycle = (cycle: string): boolean => {
  const validCycles = ['monthly', 'quarterly', 'yearly'];
  return validCycles.includes(cycle);
};

export const validateFrequencyPeriod = (period: string): boolean => {
  const validPeriods = ['week', 'month'];
  return validPeriods.includes(period);
};

// Export validation schemas for testing
export const validationSchemas = {
  subscriptionPurchaseSchema,
  subscriptionQuerySchema,
  subscriptionCancellationSchema,
  subscriptionIdParamSchema,
  bookingEligibilityQuerySchema
};