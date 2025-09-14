# Fitness Booking Platform - Postman Collection

This Postman collection provides comprehensive testing for the subscription and credit balance functionality of the Fitness Booking Platform.

## Files

- `Fitness-Booking-Subscriptions-Credits.postman_collection.json` - Main API collection
- `Fitness-Booking-Local.postman_environment.json` - Local development environment variables

## Setup Instructions

### 1. Import Collection and Environment

1. Open Postman
2. Click **Import** button
3. Import both files:
   - `Fitness-Booking-Subscriptions-Credits.postman_collection.json`
   - `Fitness-Booking-Local.postman_environment.json`
4. Select the "Fitness Booking - Local" environment

### 2. Configure Environment Variables

Before running tests, update these environment variables with actual IDs from your database:

- `subscriptionPlanId` - ID of a subscription plan
- `creditPlanId` - ID of a credit plan  
- `classId` - ID of a class
- `sessionId` - ID of a session

### 3. Test Flow

The collection is organized to follow a logical testing flow:

#### A. Authentication
1. **Brand Login** - Authenticates brand and sets `brandToken`
2. **Client Login** - Authenticates client and sets `clientToken`

#### B. Subscription Management
1. **Create Subscription** - Creates new subscription with payment
2. **Get Client Subscriptions** - Lists all client subscriptions
3. **Get Subscription Details** - Gets specific subscription info
4. **Cancel Subscription** - Cancels subscription with reason

#### C. Credit Balance Management
1. **Purchase Credits** - Buys credit package with payment
2. **Get Credit Balance** - Shows current credit balance
3. **Get Credit History** - Shows transaction history
4. **Check Credits for Class** - Validates credits for specific class

#### D. Payment Processing
1. **Get Payment Details** - Shows payment information
2. **Get Payment History** - Lists payment transactions
3. **Request Refund** - Processes payment refunds

#### E. Booking with Credits/Subscription
1. **Book Class with Subscription** - Books using active subscription
2. **Book Class with Credits** - Books using credit balance
3. **Cancel Booking** - Cancels booking and refunds credits

#### F. Brand Analytics
1. **Get Subscription Analytics** - Subscription metrics for brand
2. **Get Payment Analytics** - Payment statistics for brand
3. **Get Credit Usage Analytics** - Credit usage patterns

#### G. Webhook Simulation
1. **Stripe Payment Success Webhook** - Simulates successful payment
2. **Stripe Payment Failed Webhook** - Simulates failed payment

## API Endpoints Covered

### Client Endpoints
- `POST /api/client/subscriptions` - Create subscription
- `GET /api/client/subscriptions` - List subscriptions
- `GET /api/client/subscriptions/:id` - Get subscription details
- `POST /api/client/subscriptions/:id/cancel` - Cancel subscription
- `POST /api/client/credits/purchase` - Purchase credits
- `GET /api/client/credits/balance/:brandId` - Get credit balance
- `GET /api/client/credits/history/:brandId` - Get credit history
- `GET /api/client/credits/available/:classId` - Check available credits
- `GET /api/client/payments/:paymentIntentId` - Get payment details
- `GET /api/client/payments` - Get payment history
- `POST /api/client/payments/:paymentIntentId/refund` - Request refund
- `POST /api/client/bookings` - Create booking
- `POST /api/client/bookings/:id/cancel` - Cancel booking

### Brand Endpoints
- `GET /api/brand/analytics/subscriptions` - Subscription analytics
- `GET /api/brand/analytics/payments` - Payment analytics
- `GET /api/brand/analytics/credits` - Credit analytics

### Webhook Endpoints
- `POST /api/webhooks/stripe` - Stripe webhook handler

## Testing Scenarios

### Happy Path Flow
1. Login as client
2. Create subscription → Payment succeeds → Subscription active
3. Book class using subscription → Frequency usage incremented
4. Purchase credits → Payment succeeds → Credits added to balance
5. Book class using credits → Credits deducted via FIFO
6. Cancel booking → Credits refunded to original package

### Error Scenarios
1. Create subscription with invalid payment method
2. Book class with insufficient credits
3. Book class with expired subscription
4. Cancel already cancelled subscription
5. Refund already refunded payment

### Edge Cases
1. Book class when subscription frequency limit reached
2. Use credits from multiple packages (FIFO testing)
3. Handle expired credit packages
4. Process partial refunds

## Environment Variables

The collection uses these dynamic variables:

| Variable | Description | Auto-Set |
|----------|-------------|----------|
| `brandToken` | Brand JWT token | ✅ |
| `clientToken` | Client JWT token | ✅ |
| `brandId` | Brand ID | ✅ |
| `clientId` | Client ID | ✅ |
| `subscriptionId` | Created subscription ID | ✅ |
| `creditBalanceId` | Credit balance ID | ✅ |
| `paymentIntentId` | Payment intent ID | ✅ |
| `bookingId` | Booking ID | ✅ |
| `subscriptionPlanId` | Subscription plan ID | ❌ Manual |
| `creditPlanId` | Credit plan ID | ❌ Manual |
| `classId` | Class ID | ❌ Manual |
| `sessionId` | Session ID | ❌ Manual |

Variables marked with ✅ are automatically set by test scripts.
Variables marked with ❌ need to be manually configured.

## Notes

- Ensure your local server is running on `http://localhost:3000`
- Update the `baseUrl` environment variable if using a different port
- Some endpoints require actual Stripe integration for full testing
- Webhook endpoints may need proper Stripe signature validation disabled for testing
- Test data will be created in your database - use a test database

## Troubleshooting

### Common Issues

1. **401 Unauthorized**: Check that tokens are properly set after login
2. **404 Not Found**: Verify endpoint URLs match your route configuration
3. **400 Bad Request**: Check request body format and required fields
4. **500 Internal Server Error**: Check server logs for detailed error information

### Required Setup

Before using this collection, ensure:
- [ ] Server is running and accessible
- [ ] Database is connected and seeded with test data
- [ ] Stripe integration is configured (for payment testing)
- [ ] Authentication middleware is working
- [ ] All required models and controllers are implemented