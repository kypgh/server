import Joi from 'joi';

// Frequency limit validation schema
const frequencyLimitSchema = Joi.object({
  count: Joi.number()
    .integer()
    .min(0)
    .max(1000)
    .required()
    .messages({
      'number.base': 'Frequency count must be a number',
      'number.integer': 'Frequency count must be a whole number',
      'number.min': 'Frequency count cannot be negative (use 0 for unlimited)',
      'number.max': 'Frequency count cannot exceed 1000',
      'any.required': 'Frequency count is required'
    }),

  period: Joi.string()
    .valid('week', 'month')
    .required()
    .messages({
      'any.only': 'Period must be week or month',
      'any.required': 'Frequency period is required'
    }),

  resetDay: Joi.number()
    .integer()
    .min(1)
    .when('period', {
      is: 'week',
      then: Joi.number().max(7).messages({
        'number.max': 'Reset day must be 1-7 for weekly periods (1=Monday, 7=Sunday)'
      }),
      otherwise: Joi.number().max(31).messages({
        'number.max': 'Reset day must be 1-31 for monthly periods'
      })
    })
    .required()
    .messages({
      'number.base': 'Reset day must be a number',
      'number.integer': 'Reset day must be a whole number',
      'number.min': 'Reset day must be at least 1',
      'any.required': 'Reset day is required'
    })
});

// Subscription plan creation validation schema
export const subscriptionPlanCreationSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .required()
    .messages({
      'string.empty': 'Plan name is required',
      'string.min': 'Plan name must be at least 2 characters',
      'string.max': 'Plan name cannot exceed 100 characters',
      'any.required': 'Plan name is required'
    }),

  description: Joi.string()
    .trim()
    .max(500)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Description cannot exceed 500 characters'
    }),

  price: Joi.number()
    .integer()
    .min(0)
    .max(10000000)
    .required()
    .messages({
      'number.base': 'Price must be a number',
      'number.integer': 'Price must be a whole number (in cents)',
      'number.min': 'Price cannot be negative',
      'number.max': 'Price cannot exceed $100,000',
      'any.required': 'Price is required'
    }),

  billingCycle: Joi.string()
    .valid('monthly', 'quarterly', 'yearly')
    .required()
    .messages({
      'any.only': 'Billing cycle must be monthly, quarterly, or yearly',
      'any.required': 'Billing cycle is required'
    }),

  includedClasses: Joi.array()
    .items(
      Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .messages({
          'string.pattern.base': 'Each class ID must be a valid MongoDB ObjectId'
        })
    )
    .default([])
    .messages({
      'array.base': 'Included classes must be an array'
    }),

  frequencyLimit: frequencyLimitSchema.required(),

  status: Joi.string()
    .valid('active', 'inactive')
    .default('active')
    .messages({
      'any.only': 'Status must be active or inactive'
    })
});

// Subscription plan update validation schema
export const subscriptionPlanUpdateSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .optional()
    .messages({
      'string.min': 'Plan name must be at least 2 characters',
      'string.max': 'Plan name cannot exceed 100 characters'
    }),

  description: Joi.string()
    .trim()
    .max(500)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Description cannot exceed 500 characters'
    }),

  price: Joi.number()
    .integer()
    .min(0)
    .max(10000000)
    .optional()
    .messages({
      'number.base': 'Price must be a number',
      'number.integer': 'Price must be a whole number (in cents)',
      'number.min': 'Price cannot be negative',
      'number.max': 'Price cannot exceed $100,000'
    }),

  billingCycle: Joi.string()
    .valid('monthly', 'quarterly', 'yearly')
    .optional()
    .messages({
      'any.only': 'Billing cycle must be monthly, quarterly, or yearly'
    }),

  includedClasses: Joi.array()
    .items(
      Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .messages({
          'string.pattern.base': 'Each class ID must be a valid MongoDB ObjectId'
        })
    )
    .optional()
    .messages({
      'array.base': 'Included classes must be an array'
    }),

  frequencyLimit: frequencyLimitSchema.optional(),

  status: Joi.string()
    .valid('active', 'inactive')
    .optional()
    .messages({
      'any.only': 'Status must be active or inactive'
    })
});

// Subscription plan query validation schema
export const subscriptionPlanQuerySchema = Joi.object({
  status: Joi.string()
    .valid('active', 'inactive')
    .optional(),

  billingCycle: Joi.string()
    .valid('monthly', 'quarterly', 'yearly')
    .optional(),

  minPrice: Joi.number()
    .integer()
    .min(0)
    .optional()
    .messages({
      'number.base': 'Minimum price must be a number',
      'number.integer': 'Minimum price must be a whole number',
      'number.min': 'Minimum price cannot be negative'
    }),

  maxPrice: Joi.number()
    .integer()
    .min(0)
    .optional()
    .when('minPrice', {
      is: Joi.exist(),
      then: Joi.number().min(Joi.ref('minPrice')).messages({
        'number.min': 'Maximum price must be greater than or equal to minimum price'
      })
    })
    .messages({
      'number.base': 'Maximum price must be a number',
      'number.integer': 'Maximum price must be a whole number',
      'number.min': 'Maximum price cannot be negative'
    }),

  search: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .optional()
    .messages({
      'string.min': 'Search term must be at least 1 character',
      'string.max': 'Search term cannot exceed 100 characters'
    }),

  page: Joi.number()
    .integer()
    .min(1)
    .default(1)
    .optional()
    .messages({
      'number.base': 'Page must be a number',
      'number.integer': 'Page must be a whole number',
      'number.min': 'Page must be at least 1'
    }),

  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(10)
    .optional()
    .messages({
      'number.base': 'Limit must be a number',
      'number.integer': 'Limit must be a whole number',
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 100'
    }),

  sortBy: Joi.string()
    .valid('name', 'price', 'billingCycle', 'createdAt', 'updatedAt')
    .default('createdAt')
    .optional(),

  sortOrder: Joi.string()
    .valid('asc', 'desc')
    .default('desc')
    .optional()
});