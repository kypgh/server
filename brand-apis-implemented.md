# Currently Implemented Brand APIs

## Authentication
- `POST /api/auth/brand/register` - Register new brand account
- `POST /api/auth/brand/login` - Login to brand dashboard  
- `POST /api/auth/brand/refresh` - Refresh authentication token

## Brand Profile Management
- `GET /api/brand/profile` - Get brand profile details
- `PUT /api/brand/profile` - Update brand information

## Class Management
- `POST /api/brand/classes` - Create new fitness class
- `GET /api/brand/classes` - List all classes (with filtering/pagination)
- `GET /api/brand/classes/stats` - Get class statistics
- `GET /api/brand/classes/:classId` - Get specific class details
- `PUT /api/brand/classes/:classId` - Update existing class
- `DELETE /api/brand/classes/:classId` - Delete class (soft delete)

## Session Management  
- `POST /api/brand/sessions` - Create new session
- `POST /api/brand/sessions/bulk` - Create multiple sessions at once
- `GET /api/brand/sessions` - List all sessions (with filtering/pagination)
- `GET /api/brand/sessions/stats` - Get session statistics
- `GET /api/brand/sessions/:sessionId` - Get specific session details
- `PUT /api/brand/sessions/:sessionId` - Update session
- `DELETE /api/brand/sessions/:sessionId` - Cancel/delete session

## Subscription Plan Management
- `POST /api/brand/subscription-plans` - Create subscription plan
- `GET /api/brand/subscription-plans` - List all subscription plans
- `GET /api/brand/subscription-plans/:planId` - Get specific plan details
- `PUT /api/brand/subscription-plans/:planId` - Update subscription plan
- `DELETE /api/brand/subscription-plans/:planId` - Delete subscription plan

## Credit Plan Management
- `POST /api/brand/credit-plans` - Create credit plan
- `GET /api/brand/credit-plans` - List all credit plans
- `GET /api/brand/credit-plans/:planId` - Get specific credit plan details
- `PUT /api/brand/credit-plans/:planId` - Update credit plan
- `DELETE /api/brand/credit-plans/:planId` - Delete credit plan

## Stripe Integration
- `POST /api/brand/stripe/connect` - Connect brand's Stripe account
- `GET /api/brand/stripe/account-status` - Check Stripe connection status
- `POST /api/brand/stripe/refresh-status` - Refresh onboarding status

## Payment History (Brand View)
- `GET /api/client/payments/brand/history` - View payment history for brand

**Note:** All endpoints require brand authentication except the auth routes.