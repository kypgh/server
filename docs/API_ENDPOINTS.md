# API Endpoints - MVP Structure

## Authentication & Authorization

### Brand Authentication

```
POST   /api/auth/brand/register
POST   /api/auth/brand/login
POST   /api/auth/brand/refresh
```

### Client Authentication

```
POST   /api/auth/client/register
POST   /api/auth/client/login
POST   /api/auth/client/refresh
```

## Brand Dashboard APIs

### Brand Management

```
GET    /api/brand/profile
PUT    /api/brand/profile
```

### Class Management

```
GET    /api/brand/classes
POST   /api/brand/classes
PUT    /api/brand/classes/:id
DELETE /api/brand/classes/:id
```

### Session Management

```
GET    /api/brand/sessions
POST   /api/brand/sessions
PUT    /api/brand/sessions/:id
DELETE /api/brand/sessions/:id
POST   /api/brand/sessions/bulk-create
```

### Booking Management (Standardized)

```
GET    /api/brand/bookings
PUT    /api/brand/bookings/:id/status    # { status: "confirmed" | "cancelled" }
```

### Payment Plans

```
GET    /api/brand/subscription-plans
POST   /api/brand/subscription-plans
PUT    /api/brand/subscription-plans/:id
DELETE /api/brand/subscription-plans/:id

GET    /api/brand/credit-plans
POST   /api/brand/credit-plans
PUT    /api/brand/credit-plans/:id
DELETE /api/brand/credit-plans/:id
```

### Client Management

```
GET    /api/brand/clients
GET    /api/brand/clients/:id
```

### Stripe Integration (Direct Payments)

```
POST   /api/brand/stripe/connect         # Connect brand's own account
GET    /api/brand/stripe/account-status  # Check connection status
```

## Client App APIs

### Client Profile

```
GET    /api/client/profile
PUT    /api/client/profile
```

### Brand Discovery

```
GET    /api/client/brands
GET    /api/client/brands/:id
```

### Class & Session Browsing

```
GET    /api/client/classes
GET    /api/client/sessions
```

### Booking Management (Standardized)

```
POST   /api/client/bookings
GET    /api/client/bookings
PUT    /api/client/bookings/:id/status   # { status: "cancelled" }
```

### Subscription Management

```
GET    /api/client/subscriptions
POST   /api/client/subscriptions
PUT    /api/client/subscriptions/:id/status  # { status: "cancelled" }
```

### Credit Management

```
GET    /api/client/credit-balances
POST   /api/client/credit-plans/purchase
```

### Payment Processing (Direct to Brand)

```
POST   /api/client/payments/create-intent
POST   /api/client/payments/confirm
```

## Shared APIs

### File Upload

```
POST   /api/upload/image
```

### Webhooks

```
POST   /api/webhooks/stripe
```

## Query Parameters (Standardized)

### Filtering

```
GET /api/brand/bookings?status=pending&date=2024-01-15
GET /api/client/sessions?brandId=123&category=yoga
```

### Pagination

```
GET /api/brand/clients?page=1&limit=20
```

### Sorting

```
GET /api/brand/sessions?sort=dateTime&order=asc
GET /api/client/sessions?sort=-dateTime  # desc with minus
```

## Response Formats

### Success Response

```typescript
interface ApiResponse<T> {
  success: true;
  data: T;
  message?: string;
}
```

### Error Response

```typescript
interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}
```

### Pagination Response

```typescript
interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}
```

## Authentication & Security

### JWT Token Structure

```typescript
// Brand JWT Payload
interface BrandTokenPayload {
  id: string; // Brand._id
  email: string; // Brand.email
  type: "brand"; // User type identifier
  iat: number; // Issued at
  exp: number; // Expires at
}

// Client JWT Payload
interface ClientTokenPayload {
  id: string; // Client._id
  email: string; // Client.email
  type: "client"; // User type identifier
  iat: number; // Issued at
  exp: number; // Expires at
}
```

### Authentication Flow

1. **Login**: User provides email/password
2. **Token Generation**: Server creates JWT with user ID and type
3. **Token Usage**: Client sends token in Authorization header
4. **Token Verification**: Server extracts user ID and type from token
5. **Request Processing**: Use extracted ID for database queries

### Middleware Pattern

```typescript
// Extract user info from token
interface AuthenticatedRequest extends Request {
  user: {
    id: string; // Brand._id or Client._id
    email: string; // User email
    type: "brand" | "client";
  };
}

// Usage in controllers
app.get(
  "/api/brand/profile",
  authenticateBrand,
  (req: AuthenticatedRequest, res) => {
    const brandId = req.user.id; // Always available after auth middleware
    // Use brandId for database queries
  }
);

app.get(
  "/api/client/profile",
  authenticateClient,
  (req: AuthenticatedRequest, res) => {
    const clientId = req.user.id; // Always available after auth middleware
    // Use clientId for database queries
  }
);
```

### Route Protection Patterns

```typescript
// Brand-only routes
app.use("/api/brand/*", authenticateBrand);

// Client-only routes
app.use("/api/client/*", authenticateClient);

// Public routes (no auth required)
app.use("/api/auth/*");
app.use("/api/webhooks/*");
```

### Headers

```
Authorization: Bearer <jwt_token>
X-API-Key: <api_key>  # for webhooks only
```

### Rate Limiting

- **Authentication**: 5/minute per IP
- **General APIs**: 100/minute per user
- **Payment operations**: 10/minute per user

## Error Codes

```
AUTH_001: Invalid credentials
AUTH_002: Token expired
BOOKING_001: No available spots
BOOKING_002: Session not found
BOOKING_003: Already booked
BOOKING_004: Insufficient credits
BOOKING_005: Subscription expired
PAYMENT_001: Payment failed
PAYMENT_002: Insufficient funds
VALIDATION_001: Invalid input data
```
