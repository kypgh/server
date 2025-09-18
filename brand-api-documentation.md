# Brand API Documentation - Request/Response Structures

## Authentication APIs

### POST /api/auth/brand/register
**Description:** Register new brand account

**Request Body:**
```json
{
  "name": "string (required)",
  "email": "string (required, email format)",
  "password": "string (required, min 8 chars)",
  "description": "string (optional)",
  "address": {
    "street": "string (required)",
    "city": "string (required)", 
    "state": "string (required)",
    "zipCode": "string (required)",
    "country": "string (optional, default: 'US')"
  },
  "contact": {
    "phone": "string (optional)",
    "website": "string (optional)",
    "socialMedia": {
      "instagram": "string (optional)",
      "facebook": "string (optional)",
      "twitter": "string (optional)"
    }
  },
  "businessHours": [
    {
      "day": "string (monday-sunday)",
      "openTime": "string (HH:MM format, optional)",
      "closeTime": "string (HH:MM format, optional)",
      "isClosed": "boolean (required)"
    }
  ]
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "brand": {
      "_id": "string",
      "name": "string",
      "email": "string",
      "description": "string",
      "address": { /* address object */ },
      "contact": { /* contact object */ },
      "businessHours": [ /* business hours array */ ],
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
  "message": "Brand registered successfully"
}
```

### POST /api/auth/brand/login
**Description:** Login to brand dashboard

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
    "brand": { /* brand object without password */ },
    "tokens": {
      "accessToken": "string",
      "refreshToken": "string",
      "expiresIn": "number"
    }
  },
  "message": "Login successful"
}
```

### POST /api/auth/brand/refresh
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

## Brand Profile Management

### GET /api/brand/profile
**Description:** Get brand profile details
**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "brand": { /* complete brand object */ }
  },
  "message": "Brand profile retrieved successfully"
}
```

### PUT /api/brand/profile
**Description:** Update brand information
**Headers:** `Authorization: Bearer <token>`

**Request Body:** (All fields optional)
```json
{
  "name": "string",
  "description": "string",
  "logo": "string (URL)",
  "address": {
    "street": "string",
    "city": "string",
    "state": "string", 
    "zipCode": "string",
    "country": "string"
  },
  "contact": { /* same as registration */ },
  "businessHours": [ /* same as registration */ ]
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "brand": { /* updated brand object */ }
  },
  "message": "Brand profile updated successfully"
}
```

## Class Management

### POST /api/brand/classes
**Description:** Create new fitness class
**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "string (required)",
  "description": "string (required)",
  "category": "string (required)",
  "difficulty": "beginner|intermediate|advanced (required)",
  "slots": "number (required, min 1)",
  "duration": "number (required, minutes)",
  "cancellationPolicy": "number (optional, hours before)",
  "timeBlocks": [
    {
      "day": "string (monday-sunday)",
      "startTime": "string (HH:MM)",
      "endTime": "string (HH:MM)"
    }
  ],
  "status": "active|inactive (optional, default: active)"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "class": {
      "_id": "string",
      "name": "string",
      "description": "string",
      "category": "string",
      "difficulty": "string",
      "slots": "number",
      "duration": "number",
      "cancellationPolicy": "number",
      "timeBlocks": [ /* time blocks array */ ],
      "status": "string",
      "brand": { /* populated brand info */ },
      "createdAt": "ISO date",
      "updatedAt": "ISO date"
    }
  },
  "message": "Class created successfully"
}
```

### GET /api/brand/classes
**Description:** List all classes with filtering/pagination
**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `category` (string, optional)
- `difficulty` (beginner|intermediate|advanced, optional)
- `status` (active|inactive, optional)
- `search` (string, optional)
- `page` (number, optional, default: 1)
- `limit` (number, optional, default: 10)
- `sortBy` (string, optional, default: createdAt)
- `sortOrder` (asc|desc, optional, default: desc)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "classes": [ /* array of class objects */ ],
    "pagination": {
      "currentPage": "number",
      "totalPages": "number",
      "totalCount": "number",
      "limit": "number",
      "hasNextPage": "boolean",
      "hasPrevPage": "boolean"
    }
  },
  "message": "Classes retrieved successfully"
}
```

### GET /api/brand/classes/stats
**Description:** Get class statistics
**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "stats": {
      "totalClasses": "number",
      "activeClasses": "number", 
      "inactiveClasses": "number",
      "uniqueCategories": "number",
      "totalSlots": "number",
      "averageDuration": "number",
      "difficultyDistribution": {
        "beginner": "number",
        "intermediate": "number",
        "advanced": "number"
      }
    }
  },
  "message": "Class statistics retrieved successfully"
}
```

### GET /api/brand/classes/:classId
**Description:** Get specific class details
**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "class": { /* complete class object */ }
  },
  "message": "Class retrieved successfully"
}
```

### PUT /api/brand/classes/:classId
**Description:** Update existing class
**Headers:** `Authorization: Bearer <token>`

**Request Body:** (All fields optional, same structure as POST)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "class": { /* updated class object */ }
  },
  "message": "Class updated successfully"
}
```

### DELETE /api/brand/classes/:classId
**Description:** Delete class (soft delete)
**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "class": { /* class object with status: inactive */ }
  },
  "message": "Class deleted successfully"
}
```

## Session Management

### POST /api/brand/sessions
**Description:** Create new session
**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "class": "string (ObjectId, required)",
  "dateTime": "ISO date (required)",
  "capacity": "number (optional, defaults to class slots)",
  "status": "scheduled|in-progress|completed|cancelled (optional, default: scheduled)"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "session": {
      "_id": "string",
      "class": { /* populated class object */ },
      "dateTime": "ISO date",
      "capacity": "number",
      "status": "string",
      "attendees": [],
      "createdAt": "ISO date",
      "updatedAt": "ISO date"
    }
  },
  "message": "Session created successfully"
}
```

### POST /api/brand/sessions/bulk
**Description:** Create multiple sessions at once
**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "class": "string (ObjectId, required)",
  "startDate": "ISO date (required)",
  "endDate": "ISO date (required)",
  "capacity": "number (optional)",
  "excludeDates": ["ISO date array (optional)"]
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "sessions": [ /* array of created session objects */ ],
    "count": "number"
  },
  "message": "X sessions created successfully"
}
```

### GET /api/brand/sessions
**Description:** List all sessions with filtering/pagination
**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `class` (ObjectId, optional)
- `status` (scheduled|in-progress|completed|cancelled, optional)
- `startDate` (ISO date, optional)
- `endDate` (ISO date, optional)
- `availableOnly` (boolean, optional)
- `page` (number, optional, default: 1)
- `limit` (number, optional, default: 10)
- `sortBy` (string, optional, default: dateTime)
- `sortOrder` (asc|desc, optional, default: asc)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "sessions": [ /* array of session objects */ ],
    "pagination": { /* pagination object */ }
  },
  "message": "Sessions retrieved successfully"
}
```

### GET /api/brand/sessions/stats
**Description:** Get session statistics
**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "stats": {
      "totalSessions": "number",
      "scheduledSessions": "number",
      "completedSessions": "number", 
      "cancelledSessions": "number",
      "totalCapacity": "number",
      "totalBookings": "number",
      "averageUtilization": "number (percentage)",
      "upcomingSessions": "number"
    }
  },
  "message": "Session statistics retrieved successfully"
}
```

### GET /api/brand/sessions/:sessionId
**Description:** Get specific session details
**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "session": { 
      /* complete session object with populated class and attendees */
    }
  },
  "message": "Session retrieved successfully"
}
```

### PUT /api/brand/sessions/:sessionId
**Description:** Update session
**Headers:** `Authorization: Bearer <token>`

**Request Body:** (All fields optional)
```json
{
  "dateTime": "ISO date",
  "capacity": "number",
  "status": "scheduled|in-progress|completed|cancelled"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "session": { /* updated session object */ }
  },
  "message": "Session updated successfully"
}
```

### DELETE /api/brand/sessions/:sessionId
**Description:** Cancel/delete session
**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "session": { /* session object with status: cancelled */ }
  },
  "message": "Session cancelled successfully"
}
```

## Subscription Plan Management

### POST /api/brand/subscription-plans
**Description:** Create subscription plan
**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "string (required)",
  "description": "string (required)",
  "price": "number (required, min 0)",
  "billingCycle": "weekly|monthly|quarterly|yearly (required)",
  "includedClasses": ["ObjectId array (optional)"],
  "maxBookingsPerCycle": "number (optional)",
  "status": "active|inactive (optional, default: active)"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "subscriptionPlan": {
      "_id": "string",
      "name": "string",
      "description": "string",
      "price": "number",
      "billingCycle": "string",
      "includedClasses": [ /* populated class objects */ ],
      "maxBookingsPerCycle": "number",
      "status": "string",
      "brand": { /* populated brand info */ },
      "createdAt": "ISO date",
      "updatedAt": "ISO date"
    }
  }
}
```

### GET /api/brand/subscription-plans
**Description:** List all subscription plans
**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `status` (active|inactive, optional)
- `billingCycle` (weekly|monthly|quarterly|yearly, optional)
- `minPrice` (number, optional)
- `maxPrice` (number, optional)
- `search` (string, optional)
- `page` (number, optional, default: 1)
- `limit` (number, optional, default: 10)
- `sortBy` (string, optional, default: createdAt)
- `sortOrder` (asc|desc, optional, default: desc)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "subscriptionPlans": [ /* array of subscription plan objects */ ],
    "pagination": { /* pagination object */ }
  }
}
```

### GET /api/brand/subscription-plans/:planId
**Description:** Get specific subscription plan details
**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "subscriptionPlan": { /* complete subscription plan object */ }
  }
}
```

### PUT /api/brand/subscription-plans/:planId
**Description:** Update subscription plan
**Headers:** `Authorization: Bearer <token>`

**Request Body:** (All fields optional, same structure as POST)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "subscriptionPlan": { /* updated subscription plan object */ }
  }
}
```

### DELETE /api/brand/subscription-plans/:planId
**Description:** Delete subscription plan
**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "subscriptionPlan": { /* subscription plan with status: inactive */ }
  },
  "message": "Subscription plan deactivated successfully"
}
```

## Credit Plan Management

### POST /api/brand/credit-plans
**Description:** Create credit plan
**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "string (required)",
  "description": "string (required)",
  "price": "number (required, min 0)",
  "creditAmount": "number (required, min 1)",
  "validityPeriod": "number (required, days)",
  "includedClasses": ["ObjectId array (optional)"],
  "status": "active|inactive (optional, default: active)"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "creditPlan": {
      "_id": "string",
      "name": "string",
      "description": "string",
      "price": "number",
      "creditAmount": "number",
      "validityPeriod": "number",
      "includedClasses": [ /* populated class objects */ ],
      "status": "string",
      "brand": { /* populated brand info */ },
      "createdAt": "ISO date",
      "updatedAt": "ISO date"
    }
  }
}
```

### GET /api/brand/credit-plans
**Description:** List all credit plans
**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `status` (active|inactive, optional)
- `minPrice` (number, optional)
- `maxPrice` (number, optional)
- `minCredits` (number, optional)
- `maxCredits` (number, optional)
- `minValidityPeriod` (number, optional)
- `maxValidityPeriod` (number, optional)
- `search` (string, optional)
- `page` (number, optional, default: 1)
- `limit` (number, optional, default: 10)
- `sortBy` (string, optional, default: createdAt)
- `sortOrder` (asc|desc, optional, default: desc)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "creditPlans": [ /* array of credit plan objects */ ],
    "pagination": { /* pagination object */ }
  }
}
```

### GET /api/brand/credit-plans/:planId
**Description:** Get specific credit plan details
**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "creditPlan": { /* complete credit plan object */ }
  }
}
```

### PUT /api/brand/credit-plans/:planId
**Description:** Update credit plan
**Headers:** `Authorization: Bearer <token>`

**Request Body:** (All fields optional, same structure as POST)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "creditPlan": { /* updated credit plan object */ }
  }
}
```

### DELETE /api/brand/credit-plans/:planId
**Description:** Delete credit plan
**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "creditPlan": { /* credit plan with status: inactive */ }
  },
  "message": "Credit plan deactivated successfully"
}
```

## Stripe Integration

### POST /api/brand/stripe/connect
**Description:** Connect brand's Stripe account
**Headers:** `Authorization: Bearer <token>`

**Request Body:** None

**Response (201):**
```json
{
  "success": true,
  "data": {
    "accountId": "string",
    "onboardingUrl": "string",
    "onboardingComplete": false,
    "message": "Stripe Connect account created successfully"
  }
}
```

### GET /api/brand/stripe/account-status
**Description:** Check Stripe connection status
**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accountId": "string|null",
    "onboardingComplete": "boolean",
    "chargesEnabled": "boolean",
    "payoutsEnabled": "boolean",
    "detailsSubmitted": "boolean",
    "requiresAction": "boolean",
    "actionUrl": "string (if requires action)",
    "message": "string"
  }
}
```

### POST /api/brand/stripe/refresh-status
**Description:** Refresh onboarding status
**Headers:** `Authorization: Bearer <token>`

**Request Body:** None

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accountId": "string",
    "onboardingComplete": "boolean",
    "chargesEnabled": "boolean",
    "payoutsEnabled": "boolean",
    "detailsSubmitted": "boolean",
    "requiresAction": "boolean",
    "message": "Onboarding status refreshed successfully"
  }
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
- `AUTH_001` - Invalid credentials  
- `AUTH_002` - Token expired
- `BRAND_001` - Brand not found
- `CLASS_001` - Duplicate class name
- `CLASS_002` - Class not found or access denied
- `SESSION_001` - Session capacity exceeds class slots
- `SESSION_002` - Duplicate session time
- `PLAN_001` - Duplicate plan name
- `PLAN_002` - Plan not found
- `SERVER_001` - Internal server error