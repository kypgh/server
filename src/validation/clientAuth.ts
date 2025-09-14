import Joi from 'joi';

// Client registration validation schema
export const clientRegistrationSchema = Joi.object({
  email: Joi.string()
    .email()
    .lowercase()
    .trim()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'string.empty': 'Email is required',
      'any.required': 'Email is required'
    }),

  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/)
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters long',
      'string.max': 'Password must be less than 128 characters long',
      'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character',
      'string.empty': 'Password is required',
      'any.required': 'Password is required'
    }),

  firstName: Joi.string()
    .trim()
    .min(1)
    .max(50)
    .required()
    .messages({
      'string.empty': 'First name is required',
      'string.min': 'First name cannot be empty',
      'string.max': 'First name cannot exceed 50 characters',
      'any.required': 'First name is required'
    }),

  lastName: Joi.string()
    .trim()
    .min(1)
    .max(50)
    .required()
    .messages({
      'string.empty': 'Last name is required',
      'string.min': 'Last name cannot be empty',
      'string.max': 'Last name cannot exceed 50 characters',
      'any.required': 'Last name is required'
    }),

  phone: Joi.string()
    .trim()
    .pattern(/^\+?[\d\s\-\(\)]+$/)
    .optional()
    .messages({
      'string.pattern.base': 'Invalid phone number format'
    }),

  preferences: Joi.object({
    favoriteCategories: Joi.array()
      .items(Joi.string().trim().lowercase())
      .optional(),
    preferredDifficulty: Joi.string()
      .valid('beginner', 'intermediate', 'advanced')
      .optional(),
    notifications: Joi.object({
      email: Joi.boolean().default(true),
      sms: Joi.boolean().default(false),
      push: Joi.boolean().default(true)
    }).optional(),
    timezone: Joi.string()
      .pattern(/^[A-Za-z_\/]+$/)
      .default('UTC')
      .optional()
      .messages({
        'string.pattern.base': 'Invalid timezone format'
      })
  }).optional()
});

// Client login validation schema
export const clientLoginSchema = Joi.object({
  email: Joi.string()
    .email()
    .lowercase()
    .trim()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'string.empty': 'Email is required',
      'any.required': 'Email is required'
    }),

  password: Joi.string()
    .required()
    .messages({
      'string.empty': 'Password is required',
      'any.required': 'Password is required'
    })
});

// Client profile update validation schema
export const clientProfileUpdateSchema = Joi.object({
  firstName: Joi.string()
    .trim()
    .min(1)
    .max(50)
    .optional()
    .messages({
      'string.min': 'First name cannot be empty',
      'string.max': 'First name cannot exceed 50 characters'
    }),

  lastName: Joi.string()
    .trim()
    .min(1)
    .max(50)
    .optional()
    .messages({
      'string.min': 'Last name cannot be empty',
      'string.max': 'Last name cannot exceed 50 characters'
    }),

  phone: Joi.string()
    .trim()
    .pattern(/^\+?[\d\s\-\(\)]+$/)
    .optional()
    .messages({
      'string.pattern.base': 'Invalid phone number format'
    }),

  profilePhoto: Joi.string()
    .trim()
    .uri({ scheme: ['http', 'https'] })
    .optional()
    .messages({
      'string.uri': 'Profile photo must be a valid URL'
    }),

  preferences: Joi.object({
    favoriteCategories: Joi.array()
      .items(Joi.string().trim().lowercase())
      .optional(),
    preferredDifficulty: Joi.string()
      .valid('beginner', 'intermediate', 'advanced')
      .optional(),
    notifications: Joi.object({
      email: Joi.boolean().optional(),
      sms: Joi.boolean().optional(),
      push: Joi.boolean().optional()
    }).optional(),
    timezone: Joi.string()
      .pattern(/^[A-Za-z_\/]+$/)
      .optional()
      .messages({
        'string.pattern.base': 'Invalid timezone format'
      })
  }).optional()
});

// Refresh token validation schema (reused from brand auth)
export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string()
    .required()
    .messages({
      'string.empty': 'Refresh token is required',
      'any.required': 'Refresh token is required'
    })
});