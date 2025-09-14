# Backend Tech Stack & Development Setup

## 1. Core Backend Stack

### Framework & Runtime

- **Node.js** (v18+) - Runtime environment
- **TypeScript** (v5+) - Type safety and better development experience
- **Express.js** (v4+) - Web framework for API development

### Database

- **MongoDB** (v6+) - Document database (matches our data models)
- **Mongoose** (v7+) - ODM for MongoDB with TypeScript support

### Authentication & Security

- **jsonwebtoken** - JWT token generation and verification
- **bcryptjs** - Password hashing
- **helmet** - Security headers
- **cors** - Cross-origin resource sharing
- **express-rate-limit** - Rate limiting middleware
- **joi** - Input validation and sanitization

### Payment Processing

- **stripe** - Payment processing SDK for server-side integration

### File Upload & Storage

- **multer** - File upload middleware
- **cloudinary** - Cloud storage for images (simple setup)

### Development Tools

- **nodemon** - Development server auto-restart
- **dotenv** - Environment variable management
- **@types/node** - Node.js TypeScript definitions
- **@types/express** - Express TypeScript definitions

### Code Quality (Basic)

- **eslint** - Code linting
- **prettier** - Code formatting

## 2. Database Setup

### MongoDB Configuration

```javascript
// Connection string format
mongodb://localhost:27017/fitness-booking

// Production (MongoDB Atlas)
mongodb+srv://username:password@cluster.mongodb.net/fitness-booking
```

### Required Indexes

```javascript
// Performance-critical indexes
db.sessions.createIndex({ dateTime: 1, status: 1 });
db.bookings.createIndex({ client: 1, status: 1 });
db.creditbalances.createIndex({ client: 1, brand: 1 });
db.subscriptions.createIndex({ client: 1, brand: 1, status: 1 });
```

## 3. Development Environment

### Required Software

- **Node.js** (v18+)
- **MongoDB** (v6+) or MongoDB Atlas account
- **Git** for version control
- **VS Code** (recommended IDE)

### VS Code Extensions

- **TypeScript and JavaScript Language Features**
- **ESLint**
- **Prettier**
- **MongoDB for VS Code**
- **Thunder Client** (API testing)
- **GitLens**

### Environment Variables

```bash
# Database
DATABASE_URL=mongodb://localhost:27017/fitness-booking

# Authentication
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# File Upload (Optional)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Server
PORT=3000
NODE_ENV=development

# CORS
ALLOWED_ORIGINS=http://localhost:3000
```

## 4. Project Structure

```
fitness-booking-api/
├── src/
│   ├── controllers/        # Route handlers
│   ├── middleware/         # Custom middleware
│   ├── models/            # Mongoose models
│   ├── routes/            # API routes
│   ├── services/          # Business logic
│   ├── utils/             # Helper functions
│   ├── types/             # TypeScript type definitions
│   ├── config/            # Configuration files
│   └── app.ts             # Express app setup
├── tests/                 # Test files
├── uploads/               # Temporary file uploads
├── .env                   # Environment variables
├── .env.example           # Environment template
├── .gitignore
├── package.json
├── tsconfig.json
├── jest.config.js
├── .eslintrc.js
├── .prettierrc
└── README.md
```

## 5. Package.json Scripts

```json
{
  "scripts": {
    "dev": "nodemon src/app.ts",
    "build": "tsc",
    "start": "node dist/app.js",
    "lint": "eslint src/**/*.ts",
    "lint:fix": "eslint src/**/*.ts --fix",
    "format": "prettier --write src/**/*.ts"
  }
}
```

## 6. Deployment Options

### Simple Deployment Platforms

1. **Railway** - Simple deployment with MongoDB addon
2. **Render** - Free tier available, easy setup
3. **Heroku** - Classic choice, MongoDB Atlas integration

### Database Hosting

1. **MongoDB Atlas** - Official MongoDB cloud (recommended)
2. **Railway MongoDB** - Simple setup with Railway

### File Storage (Optional)

1. **Cloudinary** - Image optimization included
2. **AWS S3** - Most popular, cost-effective

## 7. Essential Dependencies

### Core Dependencies

```json
{
  "express": "^4.18.0",
  "mongoose": "^7.0.0",
  "typescript": "^5.0.0",
  "jsonwebtoken": "^9.0.0",
  "bcryptjs": "^2.4.3",
  "stripe": "^12.0.0",
  "helmet": "^7.0.0",
  "cors": "^2.8.5",
  "express-rate-limit": "^6.0.0",
  "joi": "^17.9.0",
  "dotenv": "^16.0.0",
  "multer": "^1.4.5"
}
```

### Dev Dependencies

```json
{
  "nodemon": "^3.0.0",
  "eslint": "^8.0.0",
  "prettier": "^3.0.0",
  "@types/node": "^20.0.0",
  "@types/express": "^4.17.0",
  "@types/bcryptjs": "^2.4.0",
  "@types/jsonwebtoken": "^9.0.0",
  "@types/multer": "^1.4.0"
}
```

This focused tech stack covers only the essential server-side tools needed for the MVP.
