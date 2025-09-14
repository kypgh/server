import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface EnvironmentConfig {
  port: number;
  nodeEnv: string;
  mongodbUri: string;
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessExpiresIn: string;
    refreshExpiresIn: string;
    issuer: string;
    audience: string;
  };
  stripe: {
    secretKey: string;
    webhookSecret: string;
  };
  cloudinary: {
    cloudName: string;
    apiKey: string;
    apiSecret: string;
  };
  email: {
    from: string;
    service: string;
    apiKey: string;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
}

const config: EnvironmentConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/fitness-booking-platform',
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'fallback-access-secret-key',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret-key',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    issuer: process.env.JWT_ISSUER || 'fitness-booking-platform',
    audience: process.env.JWT_AUDIENCE || 'fitness-booking-platform-users',
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
  },
  email: {
    from: process.env.EMAIL_FROM || 'noreply@fitnessplatform.com',
    service: process.env.EMAIL_SERVICE || 'sendgrid',
    apiKey: process.env.EMAIL_API_KEY || '',
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },
};

// Validate required environment variables
const requiredEnvVars = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('Missing required environment variables:', missingEnvVars);
  if (config.nodeEnv === 'production') {
    process.exit(1);
  }
}

export default config;