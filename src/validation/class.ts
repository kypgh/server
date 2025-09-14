import Joi from 'joi';

// Time block validation schema
const timeBlockSchema = Joi.object({
  day: Joi.string()
    .valid('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')
    .required()
    .messages({
      'any.only': 'Day must be a valid day of the week',
      'any.required': 'Day is required'
    }),
  startTime: Joi.string()
    .pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .required()
    .messages({
      'string.pattern.base': 'Start time must be in HH:MM format',
      'any.required': 'Start time is required'
    }),
  endTime: Joi.string()
    .pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .required()
    .messages({
      'string.pattern.base': 'End time must be in HH:MM format',
      'any.required': 'End time is required'
    })
});

// Class creation validation schema
export const classCreationSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .required()
    .messages({
      'string.empty': 'Class name is required',
      'string.min': 'Class name must be at least 2 characters',
      'string.max': 'Class name cannot exceed 100 characters',
      'any.required': 'Class name is required'
    }),

  description: Joi.string()
    .trim()
    .min(10)
    .max(1000)
    .required()
    .messages({
      'string.empty': 'Description is required',
      'string.min': 'Description must be at least 10 characters',
      'string.max': 'Description cannot exceed 1000 characters',
      'any.required': 'Description is required'
    }),

  category: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .lowercase()
    .required()
    .messages({
      'string.empty': 'Category is required',
      'string.min': 'Category must be at least 2 characters',
      'string.max': 'Category cannot exceed 50 characters',
      'any.required': 'Category is required'
    }),

  difficulty: Joi.string()
    .valid('beginner', 'intermediate', 'advanced')
    .required()
    .messages({
      'any.only': 'Difficulty must be beginner, intermediate, or advanced',
      'any.required': 'Difficulty level is required'
    }),

  slots: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .required()
    .messages({
      'number.base': 'Slots must be a number',
      'number.integer': 'Slots must be a whole number',
      'number.min': 'Class must have at least 1 slot',
      'number.max': 'Class cannot have more than 100 slots',
      'any.required': 'Number of slots is required'
    }),

  duration: Joi.number()
    .integer()
    .min(15)
    .max(480)
    .custom((value, helpers) => {
      if (value % 15 !== 0) {
        return helpers.error('number.multiple', { multiple: 15 });
      }
      return value;
    })
    .required()
    .messages({
      'number.base': 'Duration must be a number',
      'number.integer': 'Duration must be a whole number',
      'number.min': 'Class duration must be at least 15 minutes',
      'number.max': 'Class duration cannot exceed 8 hours (480 minutes)',
      'number.multiple': 'Duration must be a multiple of 15 minutes',
      'any.required': 'Duration is required'
    }),

  cancellationPolicy: Joi.number()
    .integer()
    .min(0)
    .max(168)
    .default(24)
    .messages({
      'number.base': 'Cancellation policy must be a number',
      'number.integer': 'Cancellation policy must be a whole number of hours',
      'number.min': 'Cancellation policy cannot be negative',
      'number.max': 'Cancellation policy cannot exceed 7 days (168 hours)'
    }),

  timeBlocks: Joi.array()
    .items(timeBlockSchema)
    .optional()
    .custom((value, helpers) => {
      if (!value || value.length === 0) {
        return value; // Allow empty for flexible scheduling
      }

      // Check for duplicate day/time combinations
      const combinations = new Set();
      for (const block of value) {
        const key = `${block.day}-${block.startTime}-${block.endTime}`;
        if (combinations.has(key)) {
          return helpers.error('array.unique');
        }
        combinations.add(key);
      }

      // Validate time block durations match class duration
      const classDuration = helpers.state.ancestors[0].duration;
      if (classDuration) {
        for (const block of value) {
          const [startHour, startMin] = block.startTime.split(':').map(Number);
          const [endHour, endMin] = block.endTime.split(':').map(Number);
          const startMinutes = startHour * 60 + startMin;
          const endMinutes = endHour * 60 + endMin;
          
          if (startMinutes >= endMinutes) {
            return helpers.error('timeBlock.invalidRange', { day: block.day });
          }
          
          const blockDuration = endMinutes - startMinutes;
          if (blockDuration !== classDuration) {
            return helpers.error('timeBlock.durationMismatch', { 
              day: block.day, 
              blockDuration, 
              classDuration 
            });
          }
        }
      }

      return value;
    })
    .messages({
      'array.unique': 'Duplicate time blocks are not allowed',
      'timeBlock.invalidRange': 'End time must be after start time for {{#day}}',
      'timeBlock.durationMismatch': 'Time block duration ({{#blockDuration}} minutes) must match class duration ({{#classDuration}} minutes) for {{#day}}'
    }),

  status: Joi.string()
    .valid('active', 'inactive')
    .default('active')
    .messages({
      'any.only': 'Status must be active or inactive'
    })
});

// Class update validation schema (all fields optional except those that shouldn't change)
export const classUpdateSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .optional()
    .messages({
      'string.min': 'Class name must be at least 2 characters',
      'string.max': 'Class name cannot exceed 100 characters'
    }),

  description: Joi.string()
    .trim()
    .min(10)
    .max(1000)
    .optional()
    .messages({
      'string.min': 'Description must be at least 10 characters',
      'string.max': 'Description cannot exceed 1000 characters'
    }),

  category: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .lowercase()
    .optional()
    .messages({
      'string.min': 'Category must be at least 2 characters',
      'string.max': 'Category cannot exceed 50 characters'
    }),

  difficulty: Joi.string()
    .valid('beginner', 'intermediate', 'advanced')
    .optional()
    .messages({
      'any.only': 'Difficulty must be beginner, intermediate, or advanced'
    }),

  slots: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .optional()
    .messages({
      'number.base': 'Slots must be a number',
      'number.integer': 'Slots must be a whole number',
      'number.min': 'Class must have at least 1 slot',
      'number.max': 'Class cannot have more than 100 slots'
    }),

  duration: Joi.number()
    .integer()
    .min(15)
    .max(480)
    .custom((value, helpers) => {
      if (value % 15 !== 0) {
        return helpers.error('number.multiple', { multiple: 15 });
      }
      return value;
    })
    .optional()
    .messages({
      'number.base': 'Duration must be a number',
      'number.integer': 'Duration must be a whole number',
      'number.min': 'Class duration must be at least 15 minutes',
      'number.max': 'Class duration cannot exceed 8 hours (480 minutes)',
      'number.multiple': 'Duration must be a multiple of 15 minutes'
    }),

  cancellationPolicy: Joi.number()
    .integer()
    .min(0)
    .max(168)
    .optional()
    .messages({
      'number.base': 'Cancellation policy must be a number',
      'number.integer': 'Cancellation policy must be a whole number of hours',
      'number.min': 'Cancellation policy cannot be negative',
      'number.max': 'Cancellation policy cannot exceed 7 days (168 hours)'
    }),

  timeBlocks: Joi.array()
    .items(timeBlockSchema)
    .optional()
    .custom((value, helpers) => {
      if (!value || value.length === 0) {
        return value; // Allow empty for flexible scheduling
      }

      // Check for duplicate day/time combinations
      const combinations = new Set();
      for (const block of value) {
        const key = `${block.day}-${block.startTime}-${block.endTime}`;
        if (combinations.has(key)) {
          return helpers.error('array.unique');
        }
        combinations.add(key);
      }

      // Validate time block durations match class duration if provided
      const classDuration = helpers.state.ancestors[0].duration;
      if (classDuration) {
        for (const block of value) {
          const [startHour, startMin] = block.startTime.split(':').map(Number);
          const [endHour, endMin] = block.endTime.split(':').map(Number);
          const startMinutes = startHour * 60 + startMin;
          const endMinutes = endHour * 60 + endMin;
          
          if (startMinutes >= endMinutes) {
            return helpers.error('timeBlock.invalidRange', { day: block.day });
          }
          
          const blockDuration = endMinutes - startMinutes;
          if (blockDuration !== classDuration) {
            return helpers.error('timeBlock.durationMismatch', { 
              day: block.day, 
              blockDuration, 
              classDuration 
            });
          }
        }
      }

      return value;
    })
    .messages({
      'array.unique': 'Duplicate time blocks are not allowed',
      'timeBlock.invalidRange': 'End time must be after start time for {{#day}}',
      'timeBlock.durationMismatch': 'Time block duration ({{#blockDuration}} minutes) must match class duration ({{#classDuration}} minutes) for {{#day}}'
    }),

  status: Joi.string()
    .valid('active', 'inactive')
    .optional()
    .messages({
      'any.only': 'Status must be active or inactive'
    })
});

// Class query/filtering validation schema
export const classQuerySchema = Joi.object({
  category: Joi.string()
    .trim()
    .lowercase()
    .optional(),

  difficulty: Joi.string()
    .valid('beginner', 'intermediate', 'advanced')
    .optional(),

  status: Joi.string()
    .valid('active', 'inactive')
    .optional(),

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
    .valid('name', 'category', 'difficulty', 'createdAt', 'updatedAt')
    .default('createdAt')
    .optional(),

  sortOrder: Joi.string()
    .valid('asc', 'desc')
    .default('desc')
    .optional()
});