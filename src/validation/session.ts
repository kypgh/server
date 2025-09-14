import Joi from 'joi';

// Session creation validation schema
export const sessionCreationSchema = Joi.object({
  class: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Class ID must be a valid ObjectId',
      'any.required': 'Class ID is required'
    }),

  dateTime: Joi.date()
    .iso()
    .min('now')
    .required()
    .messages({
      'date.base': 'Date and time must be a valid date',
      'date.iso': 'Date and time must be in ISO format',
      'date.min': 'Session date and time must be in the future',
      'any.required': 'Date and time is required'
    }),

  capacity: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .optional()
    .messages({
      'number.base': 'Capacity must be a number',
      'number.integer': 'Capacity must be a whole number',
      'number.min': 'Session capacity must be at least 1',
      'number.max': 'Session capacity cannot exceed 100'
    }),

  status: Joi.string()
    .valid('scheduled', 'in-progress', 'completed', 'cancelled')
    .default('scheduled')
    .optional()
    .messages({
      'any.only': 'Status must be scheduled, in-progress, completed, or cancelled'
    })
});

// Session update validation schema
export const sessionUpdateSchema = Joi.object({
  dateTime: Joi.date()
    .iso()
    .min('now')
    .optional()
    .messages({
      'date.base': 'Date and time must be a valid date',
      'date.iso': 'Date and time must be in ISO format',
      'date.min': 'Session date and time must be in the future'
    }),

  capacity: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .optional()
    .messages({
      'number.base': 'Capacity must be a number',
      'number.integer': 'Capacity must be a whole number',
      'number.min': 'Session capacity must be at least 1',
      'number.max': 'Session capacity cannot exceed 100'
    }),

  status: Joi.string()
    .valid('scheduled', 'in-progress', 'completed', 'cancelled')
    .optional()
    .messages({
      'any.only': 'Status must be scheduled, in-progress, completed, or cancelled'
    })
});

// Bulk session creation validation schema
export const bulkSessionCreationSchema = Joi.object({
  class: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Class ID must be a valid ObjectId',
      'any.required': 'Class ID is required'
    }),

  startDate: Joi.date()
    .iso()
    .min('now')
    .required()
    .messages({
      'date.base': 'Start date must be a valid date',
      'date.iso': 'Start date must be in ISO format',
      'date.min': 'Start date must be in the future',
      'any.required': 'Start date is required'
    }),

  endDate: Joi.date()
    .iso()
    .min(Joi.ref('startDate'))
    .required()
    .messages({
      'date.base': 'End date must be a valid date',
      'date.iso': 'End date must be in ISO format',
      'date.min': 'End date must be after start date',
      'any.required': 'End date is required'
    }),

  capacity: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .optional()
    .messages({
      'number.base': 'Capacity must be a number',
      'number.integer': 'Capacity must be a whole number',
      'number.min': 'Session capacity must be at least 1',
      'number.max': 'Session capacity cannot exceed 100'
    }),

  excludeDates: Joi.array()
    .items(Joi.date().iso())
    .optional()
    .messages({
      'date.iso': 'Exclude dates must be in ISO format'
    })
});

// Session query/filtering validation schema
export const sessionQuerySchema = Joi.object({
  class: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Class ID must be a valid ObjectId'
    }),

  status: Joi.string()
    .valid('scheduled', 'in-progress', 'completed', 'cancelled')
    .optional()
    .messages({
      'any.only': 'Status must be scheduled, in-progress, completed, or cancelled'
    }),

  startDate: Joi.date()
    .iso()
    .optional()
    .messages({
      'date.base': 'Start date must be a valid date',
      'date.iso': 'Start date must be in ISO format'
    }),

  endDate: Joi.date()
    .iso()
    .min(Joi.ref('startDate'))
    .optional()
    .messages({
      'date.base': 'End date must be a valid date',
      'date.iso': 'End date must be in ISO format',
      'date.min': 'End date must be after start date'
    }),

  availableOnly: Joi.boolean()
    .default(false)
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
    .valid('dateTime', 'capacity', 'status', 'createdAt', 'updatedAt')
    .default('dateTime')
    .optional(),

  sortOrder: Joi.string()
    .valid('asc', 'desc')
    .default('asc')
    .optional()
});