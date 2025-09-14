import Joi from 'joi';

// Brand registration validation schema
export const brandRegistrationSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .required()
    .messages({
      'string.empty': 'Brand name is required',
      'string.min': 'Brand name must be at least 2 characters',
      'string.max': 'Brand name cannot exceed 100 characters',
      'any.required': 'Brand name is required'
    }),

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

  description: Joi.string()
    .trim()
    .max(1000)
    .optional()
    .messages({
      'string.max': 'Description cannot exceed 1000 characters'
    }),

  address: Joi.object({
    street: Joi.string().trim().required().messages({
      'string.empty': 'Street address is required',
      'any.required': 'Street address is required'
    }),
    city: Joi.string().trim().required().messages({
      'string.empty': 'City is required',
      'any.required': 'City is required'
    }),
    state: Joi.string().trim().required().messages({
      'string.empty': 'State is required',
      'any.required': 'State is required'
    }),
    zipCode: Joi.string().trim().required().messages({
      'string.empty': 'ZIP code is required',
      'any.required': 'ZIP code is required'
    }),
    country: Joi.string().trim().default('US').messages({
      'string.empty': 'Country is required'
    })
  }).required().messages({
    'any.required': 'Address is required'
  }),

  contact: Joi.object({
    phone: Joi.string()
      .trim()
      .pattern(/^\+?[\d\s\-\(\)]+$/)
      .optional()
      .messages({
        'string.pattern.base': 'Invalid phone number format'
      }),
    website: Joi.string()
      .trim()
      .uri({ scheme: ['http', 'https'] })
      .optional()
      .messages({
        'string.uri': 'Website must be a valid URL'
      }),
    socialMedia: Joi.object({
      instagram: Joi.string().trim().optional(),
      facebook: Joi.string().trim().optional(),
      twitter: Joi.string().trim().optional()
    }).optional()
  }).optional(),

  businessHours: Joi.array().items(
    Joi.object({
      day: Joi.string()
        .valid('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')
        .required()
        .messages({
          'any.only': 'Day must be a valid day of the week',
          'any.required': 'Day is required'
        }),
      openTime: Joi.string()
        .pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
        .when('isClosed', {
          is: false,
          then: Joi.required(),
          otherwise: Joi.optional()
        })
        .messages({
          'string.pattern.base': 'Time must be in HH:MM format',
          'any.required': 'Open time is required when not closed'
        }),
      closeTime: Joi.string()
        .pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
        .when('isClosed', {
          is: false,
          then: Joi.required(),
          otherwise: Joi.optional()
        })
        .messages({
          'string.pattern.base': 'Time must be in HH:MM format',
          'any.required': 'Close time is required when not closed'
        }),
      isClosed: Joi.boolean().default(false)
    })
  ).optional()
});

// Brand login validation schema
export const brandLoginSchema = Joi.object({
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

// Brand profile update validation schema
export const brandProfileUpdateSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .optional()
    .messages({
      'string.min': 'Brand name must be at least 2 characters',
      'string.max': 'Brand name cannot exceed 100 characters'
    }),

  description: Joi.string()
    .trim()
    .max(1000)
    .optional()
    .messages({
      'string.max': 'Description cannot exceed 1000 characters'
    }),

  logo: Joi.string()
    .trim()
    .uri({ scheme: ['http', 'https'] })
    .optional()
    .messages({
      'string.uri': 'Logo must be a valid URL'
    }),

  address: Joi.object({
    street: Joi.string().trim().optional(),
    city: Joi.string().trim().optional(),
    state: Joi.string().trim().optional(),
    zipCode: Joi.string().trim().optional(),
    country: Joi.string().trim().optional()
  }).optional(),

  contact: Joi.object({
    phone: Joi.string()
      .trim()
      .pattern(/^\+?[\d\s\-\(\)]+$/)
      .optional()
      .messages({
        'string.pattern.base': 'Invalid phone number format'
      }),
    website: Joi.string()
      .trim()
      .uri({ scheme: ['http', 'https'] })
      .optional()
      .messages({
        'string.uri': 'Website must be a valid URL'
      }),
    socialMedia: Joi.object({
      instagram: Joi.string().trim().optional(),
      facebook: Joi.string().trim().optional(),
      twitter: Joi.string().trim().optional()
    }).optional()
  }).optional(),

  businessHours: Joi.array().items(
    Joi.object({
      day: Joi.string()
        .valid('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')
        .required()
        .messages({
          'any.only': 'Day must be a valid day of the week',
          'any.required': 'Day is required'
        }),
      openTime: Joi.string()
        .pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
        .when('isClosed', {
          is: false,
          then: Joi.required(),
          otherwise: Joi.optional()
        })
        .messages({
          'string.pattern.base': 'Time must be in HH:MM format',
          'any.required': 'Open time is required when not closed'
        }),
      closeTime: Joi.string()
        .pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
        .when('isClosed', {
          is: false,
          then: Joi.required(),
          otherwise: Joi.optional()
        })
        .messages({
          'string.pattern.base': 'Time must be in HH:MM format',
          'any.required': 'Close time is required when not closed'
        }),
      isClosed: Joi.boolean().default(false)
    })
  ).optional()
});

// Refresh token validation schema
export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string()
    .required()
    .messages({
      'string.empty': 'Refresh token is required',
      'any.required': 'Refresh token is required'
    })
});