import Joi from 'joi';

// Credit plan purchase validation
export const creditPurchaseSchema = Joi.object({
  creditPlanId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Credit plan ID must be a valid ObjectId',
      'any.required': 'Credit plan ID is required'
    }),
  
  paymentMethodId: Joi.string()
    .pattern(/^pm_[a-zA-Z0-9_]+$/)
    .optional()
    .messages({
      'string.pattern.base': 'Invalid Stripe payment method ID format'
    })
});

// Credit balance query validation
export const creditBalanceQuerySchema = Joi.object({
  brandId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Brand ID must be a valid ObjectId'
    })
});

// Credit transaction history query validation
export const creditTransactionHistorySchema = Joi.object({
  page: Joi.number()
    .integer()
    .min(1)
    .max(1000)
    .default(1)
    .messages({
      'number.base': 'Page must be a number',
      'number.integer': 'Page must be an integer',
      'number.min': 'Page must be at least 1',
      'number.max': 'Page cannot exceed 1000'
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
    })
});

// Expiring credits query validation
export const expiringCreditsQuerySchema = Joi.object({
  days: Joi.number()
    .integer()
    .min(1)
    .max(365)
    .default(7)
    .messages({
      'number.base': 'Days must be a number',
      'number.integer': 'Days must be an integer',
      'number.min': 'Days must be at least 1',
      'number.max': 'Days cannot exceed 365'
    })
});

// Credit eligibility check validation
export const creditEligibilityQuerySchema = Joi.object({
  amount: Joi.number()
    .integer()
    .min(1)
    .max(10)
    .default(1)
    .messages({
      'number.base': 'Amount must be a number',
      'number.integer': 'Amount must be an integer',
      'number.min': 'Amount must be at least 1',
      'number.max': 'Amount cannot exceed 10'
    })
});