# Client API Documentation - Request/Response Structures

## Authentication APIs

### POST /api/auth/client/register
**Description:** Register new client account

**Request Body:**
```json
{
  "email": "string (required, email format)",
  "password": "string (required, min 8 chars)",
  "firstName": "string (required)",
  "lastName": "string (required)",
  "phone": "string (optional)",
  "preferences": {
    "favoriteCategories": ["string array (optional)"],
    "preferredDifficulty": "beginner|intermediate|advanced (optional)",
    "notifications": {
      "email": "boolean (optional, default: true)",
      "sms": "boolean (optional, default: false)",
      "push": "boolean (optional, default: true)"
    },
    "timezone": "string (optional)"
  }
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "client": {
      "_id": "string",
      "email": "string",
      "firstName": "string",
      "lastName": "string",
      "phone": "string",
      "preferences": { /* preferences object */ },
      "status": "active",
      "createdAt": "ISO date",
      "updatedAt": "ISO date"
    },
    "tokens": {
      "accessToken": "string",
      "refreshToken": "string",
      "expiresIn": "number (seconds)"
    }
  },
  "message": "Client registered successfully"
}
```

### POST /api/auth/client/login
**Description:** Login to client account

**Request Body:**
```json
{
  "email": "string (required)",
  "password": "string (required)"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "client": { /* client object without password */ },
    "tokens": {
      "accessToken": "string",
      "refreshToken": "string",
      "expiresIn": "number"
    }
  },
  "message": "Login successful"
}
```

### POST /api/auth/client/refresh
**Description:** Refresh authentication token

**Request Body:**
```json
{
  "refreshToken": "string (required)"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "string",
    "expiresIn": "number"
  },
  "message": "Token refreshed successfully"
}
```

## Client Profile Management

### GET /api/client/profile
**Description:** Get client profile details
**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "client": { /* complete client object */ }
  },
  "message": "Profile retrieved successfully"
}
```

### PUT /api/client/profile
**Description:** Update client profile information
**Headers:** `Authorization: Bearer <token>`

**Request Body:** (All fields optional)
```json
{
  "firstName": "string",
  "lastName": "string",
  "phone": "string",
  "profilePhoto": "string (URL)",
  "preferences": {
    "favoriteCategories": ["string array"],
    "preferredDifficulty": "beginner|intermediate|advanced",
    "notifications": {
      "email": "boolean",
      "sms": "boolean",
      "push": "boolean"
    },
    "timezone": "string"
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "client": { /* updated client object */ }
  },
  "message": "Profile updated successfully"
}
```

## Discovery APIs (Public Access)

### GET /api/client/discovery/brands
**Description:** Browse all brands with filtering and search

**Query Parameters:**
- `search` (string, optional)
- `city` (string, optional)
- `state` (string, optional)
- `status` (active|inactive, optional, default: active)
- `page` (number, optional, default: 1)
- `limit` (number, optional, default: 10)
- `sortBy` (string, optional, default: name)
- `sortOrder` (asc|desc, optional, default: asc)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "brands": [
      {
        "_id": "string",
        "name": "string",
        "description": "string",
        "logo": "string",
        "address": { /* address object */ },
        "contact": { /* contact object */ },
        "businessHours": [ /* business hours array */ ]
      }
    ],
    "pagination": { /* pagination object */ }
  },
  "message": "Brands retrieved successfully"
}
```

### GET /api/client/discovery/brands/:brandId
**Description:** Get brand details with class information

**Response (200):**
```json
{
  "success": true,
  "data": {
    "brand": { /* brand object */ },
    "classes": [ /* array of class objects */ ],
    "stats": {
      "totalClasses": "number",
      "uniqueCategories": "number",
      "difficultyDistribution": {
        "beginner": "number",
        "intermediate": "number",
        "advanced": "number"
      }
    }
  },
  "message": "Brand details retrieved successfully"
}
```

### GET /api/client/discovery/classes
**Description:** Browse classes with filtering

**Query Parameters:**
- `search` (string, optional)
- `category` (string, optional)
- `difficulty` (beginner|intermediate|advanced, optional)
- `brand` (ObjectId, optional)
- `city` (string, optional)
- `state` (string, optional)
- `minDuration` (number, optional)
- `maxDuration` (number, optional)
- `page` (number, optional, default: 1)
- `limit` (number, optional, default: 10)
- `sortBy` (string, optional, default: name)
- `sortOrder` (asc|desc, optional, default: asc)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "classes": [
      {
        "_id": "string",
        "name": "string",
        "description": "string",
        "category": "string",
        "difficulty": "string",
        "slots": "number",
        "duration": "number",
        "timeBlocks": [ /* time blocks array */ ],
        "brand": {
          "_id": "string",
          "name": "string",
          "logo": "string",
          "city": "string",
          "state": "string"
        }
      }
    ],
    "pagination": { /* pagination object */ }
  },
  "message": "Classes retrieved successfully"
}
```

### GET /api/client/discovery/sessions
**Description:** Browse sessions with date and availability filtering

**Query Parameters:**
- `search` (string, optional)
- `brand` (ObjectId, optional)
- `class` (ObjectId, optional)
- `category` (string, optional)
- `difficulty` (beginner|intermediate|advanced, optional)
- `startDate` (ISO date, optional)
- `endDate` (ISO date, optional)
- `availableOnly` (boolean, optional)
- `city` (string, optional)
- `state` (string, optional)
- `page` (number, optional, default: 1)
- `limit` (number, optional, default: 10)
- `sortBy` (string, optional, default: dateTime)
- `sortOrder` (asc|desc, optional, default: asc)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "_id": "string",
        "dateTime": "ISO date",
        "capacity": "number",
        "availableSpots": "number",
        "status": "string",
        "class": {
          "_id": "string",
          "name": "string",
          "description": "string",
          "category": "string",
          "difficulty": "string",
          "duration": "number",
          "cancellationPolicy": "number"
        },
        "brand": {
          "_id": "string",
          "name": "string",
          "logo": "string",
          "city": "string",
          "state": "string"
        }
      }
    ],
    "pagination": { /* pagination object */ }
  },
  "message": "Sessions retrieved successfully"
}
```

### GET /api/client/discovery/brands/:brandId/subscription-plans
**Description:** Get available subscription plans for a brand

**Response (200):**
```json
{
  "success": true,
  "data": {
    "brand": {
      "_id": "string",
      "name": "string"
    },
    "subscriptionPlans": [
      {
        "_id": "string",
        "name": "string",
        "description": "string",
        "price": "number",
        "priceFormatted": "string",
        "billingCycle": "string",
        "frequencyLimit": { /* frequency limit object */ },
        "includedClasses": [ /* class objects */ ],
        "isUnlimited": "boolean",
        "isUnlimitedFrequency": "boolean"
      }
    ]
  },
  "message": "Subscription plans retrieved successfully"
}
```

### GET /api/client/discovery/brands/:brandId/credit-plans
**Description:** Get available credit plans for a brand

**Response (200):**
```json
{
  "success": true,
  "data": {
    "brand": {
      "_id": "string",
      "name": "string"
    },
    "creditPlans": [
      {
        "_id": "string",
        "name": "string",
        "description": "string",
        "price": "number",
        "priceFormatted": "string",
        "creditAmount": "number",
        "bonusCredits": "number",
        "totalCredits": "number",
        "validityPeriod": "number",
        "validityDescription": "string",
        "pricePerCredit": "number",
        "pricePerCreditFormatted": "string",
        "includedClasses": [ /* class objects */ ],
        "isUnlimited": "boolean"
      }
    ]
  },
  "message": "Credit plans retrieved successfully"
}
```

## Subscription Management

### POST /api/client/subscriptions/purchase
**Description:** Purchase a subscription plan
**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "subscriptionPlanId": "string (ObjectId, required)",
  "paymentMethodId": "string (optional)"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "paymentIntent": {
      "id": "string",
      "clientSecret": "string",
      "amount": "number",
      "currency": "string",
      "status": "string"
    },
    "subscriptionPlan": {
      "id": "string",
      "name": "string",
      "price": "number",
      "billingCycle": "string",
      "brand": { /* brand object */ }
    }
  }
}
```

### GET /api/client/subscriptions
**Description:** Get client's subscriptions with filtering
**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `status` (active|cancelled|expired, optional)
- `brand` (ObjectId, optional)
- `page` (number, optional, default: 1)
- `limit` (number, optional, default: 10)
- `sortBy` (string, optional, default: createdAt)
- `sortOrder` (asc|desc, optional, default: desc)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "subscriptions": [ /* array of subscription objects */ ],
    "pagination": { /* pagination object */ }
  },
  "message": "Subscriptions retrieved successfully"
}
```

### GET /api/client/subscriptions/:subscriptionId
**Description:** Get specific subscription details
**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "subscription": { /* complete subscription object */ }
  },
  "message": "Subscription retrieved successfully"
}
```

### PUT /api/client/subscriptions/:subscriptionId/cancel
**Description:** Cancel a subscription
**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "reason": "string (optional)"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "subscription": { /* updated subscription object */ }
  },
  "message": "Subscription cancelled successfully"
}
```

### GET /api/client/subscriptions/:subscriptionId/booking-eligibility
**Description:** Check booking eligibility for subscription
**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `classId` (ObjectId, optional)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "eligible": "boolean",
    "reason": "string (if not eligible)",
    "remainingBookings": "number (if applicable)",
    "nextResetDate": "ISO date (if applicable)"
  },
  "message": "Eligibility checked successfully"
}
```

## Credit Management

### POST /api/client/credits/purchase
**Description:** Purchase credit plan
**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "creditPlanId": "string (ObjectId, required)",
  "paymentMethodId": "string (optional)"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "paymentIntent": {
      "id": "string",
      "clientSecret": "string",
      "amount": "number",
      "currency": "string",
      "status": "string"
    },
    "creditPlan": {
      "id": "string",
      "name": "string",
      "price": "number",
      "creditAmount": "number",
      "bonusCredits": "number",
      "totalCredits": "number",
      "validityPeriod": "number",
      "brand": { /* brand object */ }
    }
  }
}
```

### GET /api/client/credits/balances
**Description:** Get client's credit balances
**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `brandId` (ObjectId, optional)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "balances": [
      {
        "brand": { /* brand object */ },
        "totalCredits": "number",
        "availableCredits": "number",
        "expiredCredits": "number",
        "expiringCredits": "number",
        "nextExpiryDate": "ISO date"
      }
    ]
  },
  "message": "Credit balances retrieved successfully"
}
```

### GET /api/client/credits/balances/:brandId/transactions
**Description:** Get credit transaction history for a brand
**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "_id": "string",
        "type": "purchase|usage|expiry|bonus",
        "amount": "number",
        "description": "string",
        "createdAt": "ISO date",
        "expiresAt": "ISO date"
      }
    ]
  },
  "message": "Transaction history retrieved successfully"
}
```

### GET /api/client/credits/expiring
**Description:** Get credits expiring soon
**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "expiringCredits": [
      {
        "brand": { /* brand object */ },
        "credits": "number",
        "expiryDate": "ISO date",
        "daysUntilExpiry": "number"
      }
    ]
  },
  "message": "Expiring credits retrieved successfully"
}
```

### GET /api/client/credits/eligibility/:brandId/:classId
**Description:** Check credit eligibility for a class
**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "eligible": "boolean",
    "availableCredits": "number",
    "requiredCredits": "number",
    "reason": "string (if not eligible)"
  },
  "message": "Credit eligibility checked successfully"
}
```

## Payment Management

### POST /api/client/payments/subscription/create-intent
**Description:** Create payment intent for subscription purchase
**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "subscriptionPlanId": "string (ObjectId, required)",
  "paymentMethodId": "string (optional)"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "paymentIntent": {
      "id": "string",
      "clientSecret": "string",
      "amount": "number",
      "currency": "string",
      "status": "string"
    },
    "message": "Subscription payment intent created successfully"
  }
}
```

### POST /api/client/payments/credits/create-intent
**Description:** Create payment intent for credit plan purchase
**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "creditPlanId": "string (ObjectId, required)",
  "paymentMethodId": "string (optional)"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "paymentIntent": {
      "id": "string",
      "clientSecret": "string",
      "amount": "number",
      "currency": "string",
      "status": "string"
    },
    "message": "Credit payment intent created successfully"
  }
}
```

### POST /api/client/payments/confirm
**Description:** Confirm payment completion
**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "paymentIntentId": "string (required)"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "payment": { /* payment object */ },
    "subscription": { /* subscription object (if applicable) */ },
    "credits": { /* credit balance object (if applicable) */ }
  },
  "message": "Payment confirmed successfully"
}
```

### GET /api/client/payments/history
**Description:** Get client's payment history
**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `type` (subscription|credit, optional)
- `status` (succeeded|failed|pending, optional)
- `startDate` (ISO date, optional)
- `endDate` (ISO date, optional)
- `page` (number, optional, default: 1)
- `limit` (number, optional, default: 10)
- `sortBy` (string, optional, default: createdAt)
- `sortOrder` (asc|desc, optional, default: desc)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "payments": [
      {
        "_id": "string",
        "type": "subscription|credit",
        "amount": "number",
        "currency": "string",
        "status": "string",
        "brand": { /* brand object */ },
        "plan": { /* plan object */ },
        "createdAt": "ISO date"
      }
    ],
    "pagination": { /* pagination object */ }
  },
  "message": "Payment history retrieved successfully"
}
```

### GET /api/client/payments/:paymentId
**Description:** Get payment details by ID
**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "payment": { /* complete payment object */ }
  },
  "message": "Payment details retrieved successfully"
}
```

## Error Response Format

All endpoints return errors in this format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": "Additional error details (optional)"
  }
}
```

## Common Error Codes

- `VALIDATION_001` - Invalid input data
- `AUTH_003` - Unauthorized access
- `AUTH_009` - Invalid refresh token
- `AUTH_010` - Refresh token expired
- `AUTH_021` - Client with email already exists
- `AUTH_022` - Invalid email or password
- `AUTH_023` - Client account not found or inactive
- `CLIENT_001` - Client not found
- `BRAND_001` - Brand not found or inactive
- `PLAN_001` - Plan not found
- `PLAN_002` - Plan not active
- `SUBSCRIPTION_001` - Active subscription already exists
- `SERVER_001` - Internal server error