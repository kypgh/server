# Business Flows & Integration Guide

## 1. Business Model & Stripe Integration

### Chosen Approach: Multi-Brand Platform with Direct Payments

- **Multiple brands** in one application
- **Direct payments** to each brand's Stripe account
- **No platform fees** for MVP (can add later)
- **One-time payments** for credits and subscriptions initially

### Stripe Implementation

```typescript
// Each brand connects their own Stripe account
interface Brand {
  stripeAccountId: string; // Brand's own Stripe account
}

// Payment flow - direct to brand
const paymentIntent = await stripe.paymentIntents.create(
  {
    amount: planPrice,
    currency: "eur",
  },
  {
    stripeAccount: brand.stripeAccountId, // Direct to brand
  }
);
```

## 2. Authentication Integration

### User ID Extraction Pattern
All business flows follow this consistent pattern:

```typescript
// Brand endpoints - extract brandId from token
const brandId = req.user.id;  // From JWT payload
const brand = await Brand.findById(brandId);

// Client endpoints - extract clientId from token
const clientId = req.user.id;  // From JWT payload
const client = await Client.findById(clientId);
```

### Database Query Consistency
```typescript
// Brand queries always filter by brandId
const classes = await Class.find({ brand: brandId });
const sessions = await Session.find({ class: { $in: classIds } });
const bookings = await Booking.find({ session: { $in: sessionIds } });

// Client queries always filter by clientId
const bookings = await Booking.find({ client: clientId });
const subscriptions = await Subscription.find({ client: clientId });
const creditBalances = await CreditBalance.find({ client: clientId });
```

### Cross-Reference Validation
```typescript
// When client books a session, validate brand relationship
const session = await Session.findById(sessionId).populate('class');
const brandId = session.class.brand;

// When brand manages booking, validate ownership
const booking = await Booking.findById(bookingId).populate({
  path: 'session',
  populate: { path: 'class' }
});
const sessionBrandId = booking.session.class.brand;
if (sessionBrandId.toString() !== req.user.id) {
  throw new Error('Unauthorized');
}
```

## 3. Essential Business Flows

### 3.1 Credit-Based Booking Flow

**API**: `POST /api/client/bookings`

**Flow**:

1. **Validation**

   - Verify session exists and has capacity
   - Check client has active credits for brand
   - Validate class inclusion and frequency limits

2. **Credit Deduction (FIFO)**

   - Find oldest non-expired credit package
   - Deduct 1 credit from `creditsRemaining`
   - Update `availableCredits` counter

3. **Booking Creation**

   - Create Booking with `bookingType: "credits"`
   - Add to Session's `attendees` array
   - Link `creditTransactionId`

4. **Transaction Safety**
   - Use MongoDB transactions for atomicity
   - Rollback on any failure

### 3.2 Subscription-Based Booking Flow

**API**: `POST /api/client/bookings`

**Flow**:

1. **Validation**

   - Verify session exists and has capacity
   - Check active subscription for brand
   - Validate class inclusion and frequency limits

2. **Frequency Tracking**

   - Count bookings in current billing period
   - Compare against plan limits
   - Calculate reset dates (weekly/monthly)

3. **Booking Creation**
   - Create Booking with `bookingType: "subscription"`
   - Add to Session's `attendees` array
   - Link `subscriptionId`

### 3.3 Payment Flow (Direct to Brand)

**APIs**: `POST /api/client/subscriptions` or `POST /api/client/credit-plans/purchase`

**Flow**:

1. **Payment Intent Creation**

   - Create PaymentIntent on brand's Stripe account
   - Include plan metadata

2. **Payment Confirmation**

   - Client completes payment on frontend
   - Webhook confirms success

3. **Record Creation**
   - Create Subscription or CreditBalance record
   - Handle bonus credits if applicable

### 3.4 Cancellation Flow

**API**: `PUT /api/client/bookings/:id/status`

**Flow**:

1. **Validation**

   - Check cancellation policy window
   - Verify booking ownership

2. **Credit Restoration** (if credit booking)

   - Restore credit to original package
   - Handle expired package edge cases

3. **Session Update**
   - Remove from attendees array
   - Update booking status

## 4. Transaction Management

### 4.1 Critical Operations Requiring Transactions

1. Credit-based booking creation
2. Booking cancellation with credit restoration
3. Subscription creation with payment confirmation
4. Credit plan purchase with balance update

### 4.2 Implementation Pattern

```typescript
const session = await mongoose.startSession();
session.startTransaction();

try {
  // Perform all database operations
  await operation1(session);
  await operation2(session);
  await operation3(session);

  await session.commitTransaction();
} catch (error) {
  await session.abortTransaction();
  throw error;
} finally {
  session.endSession();
}
```

### 4.3 Concurrency Handling

**Race Condition Scenarios**:

- Multiple clients booking last available spot
- Credit deduction during concurrent bookings
- Subscription limit checking with simultaneous requests

**Solutions**:

- Optimistic locking with version fields
- Atomic operations for counter updates
- Database-level constraints for capacity limits

## 5. Business Logic Validations

### 5.1 Booking Eligibility

| Credits | Subscription | Action                                |
| ------- | ------------ | ------------------------------------- |
| ✅      | ❌           | Use credits                           |
| ❌      | ✅           | Use subscription                      |
| ✅      | ✅           | Client choice (default: subscription) |
| ❌      | ❌           | Redirect to purchase                  |

### 5.2 Credit Management (FIFO)

1. Sort packages by `purchaseDate` (oldest first)
2. Use credits from oldest non-expired package
3. Skip expired packages
4. Clean up expired packages periodically

### 5.3 Frequency Limits

- **Weekly**: Reset based on day 1-7 (Mon-Sun)
- **Monthly**: Reset based on day 1-31
- Count bookings from reset date to current

## 6. Error Handling & Edge Cases

### 6.1 Payment Failures

**Scenarios**:

- Insufficient funds
- Declined cards
- Network timeouts
- Stripe API errors

**Handling**:

- Graceful degradation
- Retry mechanisms for transient failures
- Clear error messages to users
- Automatic cleanup of partial transactions

### 6.2 Booking Conflicts

**Scenarios**:

- Session capacity exceeded
- Double booking prevention
- Cancelled sessions
- Brand account suspended

**Handling**:

- Real-time capacity checking
- Optimistic locking
- Automatic refunds for cancelled sessions

## 7. MVP Feature Scope

### Phase 1 (MVP) - Core Features

- Brand registration and profile management
- Class creation and session scheduling
- Client registration and profile management
- Session browsing and booking (credits + subscriptions)
- Direct payment processing
- Basic cancellation handling

### Phase 2 (Future) - Enhanced Features

- Recurring subscription billing
- Advanced booking rules and waitlists
- Email notifications
- Basic reporting
- Mobile app features

### Not in MVP Scope

- Analytics dashboards
- Advanced notifications
- Third-party integrations
- AI recommendations
- Complex reporting
- Platform fees and marketplace features
