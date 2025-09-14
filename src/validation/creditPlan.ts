import Joi from 'joi';

// Credit plan creation validation schema
export const creditPlanCreationSchema = Joi.object({
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

  creditAmount: Joi.number()
    .integer()
    .min(1)
    .max(1000)
    .required()
    .messages({
      'number.base': 'Credit amount must be a number',
      'number.integer': 'Credit amount must be a whole number',
      'number.min': 'Credit amount must be at least 1',
      'number.max': 'Credit amount cannot exceed 1000',
      'any.required': 'Credit amount is required'
    }),

  validityPeriod: Joi.number()
    .integer()
    .min(1)
    .max(3650)
    .required()
    .messages({
      'number.base': 'Validity period must be a number',
      'number.integer': 'Validity period must be a whole number of days',
      'number.min': 'Validity period must be at least 1 day',
      'number.max': 'Validity period cannot exceed 10 years (3650 days)',
      'any.required': 'Validity period is required'
    }),

  bonusCredits: Joi.number()
    .integer()
    .min(0)
    .max(1000)
    .default(0)
    .custom((value, helpers) => {
      const creditAmount = helpers.state.ancestors[0].creditAmount;
      if (creditAmount && value > creditAmount) {
        return helpers.error('bonusCredits.exceedsBase');
      }
      return value;
    })
    .messages({
      'number.base': 'Bonus credits must be a number',
      'number.integer': 'Bonus credits must be a whole number',
      'number.min': 'Bonus credits cannot be negative',
      'number.max': 'Bonus credits cannot exceed 1000',
      'bonusCredits.exceedsBase': 'Bonus credits cannot exceed base credit amount'
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

  status: Joi.string()
    .valid('active', 'inactive')
    .default('active')
    .messages({
      'any.only': 'Status must be active or inactive'
    })
});

// Credit plan update validation schema
export const creditPlanUpdateSchema = Joi.object({
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

  creditAmount: Joi.number()
    .integer()
    .min(1)
    .max(1000)
    .optional()
    .messages({
      'number.base': 'Credit amount must be a number',
      'number.integer': 'Credit amount must be a whole number',
      'number.min': 'Credit amount must be at least 1',
      'number.max': 'Credit amount cannot exceed 1000'
    }),

  validityPeriod: Joi.number()
    .integer()
    .min(1)
    .max(3650)
    .optional()
    .messages({
      'number.base': 'Validity period must be a number',
      'number.integer': 'Validity period must be a whole number of days',
      'number.min': 'Validity period must be at least 1 day',
      'number.max': 'Validity period cannot exceed 10 years (3650 days)'
    }),

  bonusCredits: Joi.number()
    .integer()
    .min(0)
    .max(1000)
    .optional()
    .custom((value, helpers) => {
      const creditAmount = helpers.state.ancestors[0].creditAmount;
      if (creditAmount && value > creditAmount) {
        return helpers.error('bonusCredits.exceedsBase');
      }
      return value;
    })
    .messages({
      'number.base': 'Bonus credits must be a number',
      'number.integer': 'Bonus credits must be a whole number',
      'number.min': 'Bonus credits cannot be negative',
      'number.max': 'Bonus credits cannot exceed 1000',
      'bonusCredits.exceedsBase': 'Bonus credits cannot exceed base credit amount'
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

  status: Joi.string()
    .valid('active', 'inactive')
    .optional()
    .messages({
      'any.only': 'Status must be active or inactive'
    })
});

// Credit plan query validation schema
export const creditPlanQuerySchema = Joi.object({
  status: Joi.string()
    .valid('active', 'inactive')
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

  minCredits: Joi.number()
    .integer()
    .min(1)
    .optional()
    .messages({
      'number.base': 'Minimum credits must be a number',
      'number.integer': 'Minimum credits must be a whole number',
      'number.min': 'Minimum credits must be at least 1'
    }),

  maxCredits: Joi.number()
    .integer()
    .min(1)
    .optional()
    .when('minCredits', {
      is: Joi.exist(),
      then: Joi.number().min(Joi.ref('minCredits')).messages({
        'number.min': 'Maximum credits must be greater than or equal to minimum credits'
      })
    })
    .messages({
      'number.base': 'Maximum credits must be a number',
      'number.integer': 'Maximum credits must be a whole number',
      'number.min': 'Maximum credits must be at least 1'
    }),

  minValidityPeriod: Joi.number()
    .integer()
    .min(1)
    .optional()
    .messages({
      'number.base': 'Minimum validity period must be a number',
      'number.integer': 'Minimum validity period must be a whole number',
      'number.min': 'Minimum validity period must be at least 1 day'
    }),

  maxValidityPeriod: Joi.number()
    .integer()
    .min(1)
    .optional()
    .when('minValidityPeriod', {
      is: Joi.exist(),
      then: Joi.number().min(Joi.ref('minValidityPeriod')).messages({
        'number.min': 'Maximum validity period must be greater than or equal to minimum validity period'
      })
    })
    .messages({
      'number.base': 'Maximum validity period must be a number',
      'number.integer': 'Maximum validity period must be a whole number',
      'number.min': 'Maximum validity period must be at least 1 day'
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
    .valid('name', 'price', 'creditAmount', 'validityPeriod', 'createdAt', 'updatedAt')
    .default('createdAt')
    .optional(),

  sortOrder: Joi.string()
    .valid('asc', 'desc')
    .default('desc')
    .optional()
});