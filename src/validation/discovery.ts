import Joi from 'joi';

// Brand discovery query validation schema
export const brandDiscoverySchema = Joi.object({
  search: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .optional()
    .messages({
      'string.min': 'Search term must be at least 1 character',
      'string.max': 'Search term cannot exceed 100 characters'
    }),

  city: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .optional()
    .messages({
      'string.min': 'City must be at least 2 characters',
      'string.max': 'City cannot exceed 50 characters'
    }),

  state: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .optional()
    .messages({
      'string.min': 'State must be at least 2 characters',
      'string.max': 'State cannot exceed 50 characters'
    }),

  status: Joi.string()
    .valid('active', 'inactive')
    .default('active')
    .optional(),

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
    .max(50)
    .default(10)
    .optional()
    .messages({
      'number.base': 'Limit must be a number',
      'number.integer': 'Limit must be a whole number',
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 50'
    }),

  sortBy: Joi.string()
    .valid('name', 'createdAt', 'updatedAt')
    .default('name')
    .optional(),

  sortOrder: Joi.string()
    .valid('asc', 'desc')
    .default('asc')
    .optional()
});

// Class discovery query validation schema
export const classDiscoverySchema = Joi.object({
  search: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .optional()
    .messages({
      'string.min': 'Search term must be at least 1 character',
      'string.max': 'Search term cannot exceed 100 characters'
    }),

  category: Joi.string()
    .trim()
    .lowercase()
    .optional(),

  difficulty: Joi.string()
    .valid('beginner', 'intermediate', 'advanced')
    .optional(),

  brand: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Brand ID must be a valid ObjectId'
    }),

  city: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .optional()
    .messages({
      'string.min': 'City must be at least 2 characters',
      'string.max': 'City cannot exceed 50 characters'
    }),

  state: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .optional()
    .messages({
      'string.min': 'State must be at least 2 characters',
      'string.max': 'State cannot exceed 50 characters'
    }),

  minDuration: Joi.number()
    .integer()
    .min(15)
    .max(480)
    .optional()
    .messages({
      'number.base': 'Minimum duration must be a number',
      'number.integer': 'Minimum duration must be a whole number',
      'number.min': 'Minimum duration must be at least 15 minutes',
      'number.max': 'Minimum duration cannot exceed 480 minutes'
    }),

  maxDuration: Joi.number()
    .integer()
    .min(15)
    .max(480)
    .optional()
    .messages({
      'number.base': 'Maximum duration must be a number',
      'number.integer': 'Maximum duration must be a whole number',
      'number.min': 'Maximum duration must be at least 15 minutes',
      'number.max': 'Maximum duration cannot exceed 480 minutes'
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
    .max(50)
    .default(10)
    .optional()
    .messages({
      'number.base': 'Limit must be a number',
      'number.integer': 'Limit must be a whole number',
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 50'
    }),

  sortBy: Joi.string()
    .valid('name', 'category', 'difficulty', 'duration', 'createdAt')
    .default('name')
    .optional(),

  sortOrder: Joi.string()
    .valid('asc', 'desc')
    .default('asc')
    .optional()
});

// Session discovery query validation schema
export const sessionDiscoverySchema = Joi.object({
  search: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .optional()
    .messages({
      'string.min': 'Search term must be at least 1 character',
      'string.max': 'Search term cannot exceed 100 characters'
    }),

  brand: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Brand ID must be a valid ObjectId'
    }),

  class: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Class ID must be a valid ObjectId'
    }),

  category: Joi.string()
    .trim()
    .lowercase()
    .optional(),

  difficulty: Joi.string()
    .valid('beginner', 'intermediate', 'advanced')
    .optional(),

  startDate: Joi.date()
    .iso()
    .optional()
    .messages({
      'date.format': 'Start date must be in ISO format (YYYY-MM-DD)'
    }),

  endDate: Joi.date()
    .iso()
    .min(Joi.ref('startDate'))
    .optional()
    .messages({
      'date.format': 'End date must be in ISO format (YYYY-MM-DD)',
      'date.min': 'End date must be after start date'
    }),

  availableOnly: Joi.boolean()
    .default(true)
    .optional(),

  city: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .optional()
    .messages({
      'string.min': 'City must be at least 2 characters',
      'string.max': 'City cannot exceed 50 characters'
    }),

  state: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .optional()
    .messages({
      'string.min': 'State must be at least 2 characters',
      'string.max': 'State cannot exceed 50 characters'
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
    .max(50)
    .default(10)
    .optional()
    .messages({
      'number.base': 'Limit must be a number',
      'number.integer': 'Limit must be a whole number',
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 50'
    }),

  sortBy: Joi.string()
    .valid('dateTime', 'capacity', 'availableSpots', 'createdAt')
    .default('dateTime')
    .optional(),

  sortOrder: Joi.string()
    .valid('asc', 'desc')
    .default('asc')
    .optional()
});

// Brand ID parameter validation
export const brandIdParamSchema = Joi.object({
  brandId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Brand ID must be a valid ObjectId',
      'any.required': 'Brand ID is required'
    })
});