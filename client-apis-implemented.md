# Currently Implemented Client APIs

## Authentication
- `POST /api/auth/client/register` - Register new client account
- `POST /api/auth/client/login` - Login to client account
- `POST /api/auth/client/refresh` - Refresh authentication token

## Client Profile Management
- `GET /api/client/profile` - Get client profile details
- `PUT /api/client/profile` - Update client profile information

## Discovery (Public Access)
- `GET /api/client/discovery/brands` - Browse all brands with filtering and search
- `GET /api/client/discovery/brands/:brandId` - Get brand details with class information
- `GET /api/client/discovery/classes` - Browse classes with filtering by category, difficulty, and brand
- `GET /api/client/discovery/sessions` - Browse sessions with date and availability filtering
- `GET /api/client/discovery/brands/:brandId/subscription-plans` - Get available subscription plans for a brand
- `GET /api/client/discovery/brands/:brandId/credit-plans` - Get available credit plans for a brand

## Subscription Management
- `POST /api/client/subscriptions/purchase` - Purchase a subscription plan
- `GET /api/client/subscriptions` - Get client's subscriptions with filtering and pagination
- `GET /api/client/subscriptions/:subscriptionId` - Get specific subscription details
- `PUT /api/client/subscriptions/:subscriptionId/cancel` - Cancel a subscription
- `GET /api/client/subscriptions/:subscriptionId/booking-eligibility` - Check booking eligibility for subscription

## Credit Management
- `POST /api/client/credits/purchase` - Purchase credit plan
- `GET /api/client/credits/balances` - Get client's credit balances (all brands or specific brand)
- `GET /api/client/credits/balances/:brandId/transactions` - Get credit transaction history for a brand
- `GET /api/client/credits/expiring` - Get credits expiring soon
- `GET /api/client/credits/eligibility/:brandId/:classId` - Check credit eligibility for a specific class

## Payment Management
- `POST /api/client/payments/subscription/create-intent` - Create payment intent for subscription purchase
- `POST /api/client/payments/credits/create-intent` - Create payment intent for credit plan purchase
- `POST /api/client/payments/confirm` - Confirm payment completion
- `GET /api/client/payments/history` - Get client's payment history with filtering and pagination
- `GET /api/client/payments/:paymentId` - Get payment details by ID

**Note:** 
- All endpoints except authentication and discovery routes require client authentication
- Discovery routes are public and don't require authentication
- Payment routes integrate with Stripe for secure payment processing
- Subscription and credit management includes eligibility checking and transaction history