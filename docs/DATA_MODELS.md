# Data Models & Database Design

## Core Entity Relationships

```
Brand (1) ──→ (N) Class ──→ (N) Session
  │                │
  │                │
  │                └──→ (N) Booking
  │
  ├──→ (N) SubscriptionPlan
  ├──→ (N) CreditPlan  
  └──→ (N) Client (through brands array)

Client (1) ──→ (N) Subscription
Client (1) ──→ (N) CreditBalance
Client (1) ──→ (N) Booking
```

## Model Definitions

### 1. Brand Model
```javascript
{
  _id: ObjectId,
  name: String, // "Pilates Studio NYC"
  email: String, // unique
  password: String, // hashed
  description: String,
  logo: String, // URL
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  contact: {
    phone: String,
    website: String
  },
  businessHours: [{
    day: String, // "Monday", "Tuesday", etc.
    open: String, // "09:00"
    close: String, // "21:00"
    isClosed: Boolean
  }],
  stripeConnectAccountId: String,
  stripeOnboardingComplete: Boolean,
  status: String, // "active", "inactive"
  createdAt: Date,
  updatedAt: Date
}
```

### 2. Class Model
```javascript
{
  _id: ObjectId,
  name: String, // "Morning Yoga"
  brand: ObjectId, // ref to Brand
  description: String,
  category: String, // "yoga", "pilates", "gym", "wellness"
  difficulty: String, // "beginner", "intermediate", "advanced"
  slots: Number, // max capacity
  duration: Number, // in minutes
  cancellationPolicy: Number, // hours before class
  timeBlocks: [{
    startTime: String, // "09:00"
    endTime: String, // "10:00"
    days: [String] // ["Monday", "Wednesday", "Friday"]
  }],
  status: String, // "active", "inactive"
  createdAt: Date,
  updatedAt: Date
}
```

### 3. Session Model
```javascript
{
  _id: ObjectId,
  class: ObjectId, // ref to Class
  dateTime: Date, // specific date and time
  duration: Number, // in minutes
  capacity: Number, // max attendees
  attendees: [{
    client: ObjectId, // ref to Client
    bookingType: String, // "credits", "subscription"
    bookingId: ObjectId, // ref to Booking
    status: String, // "pending", "confirmed", "attended", "no-show"
    bookingDate: Date
  }],
  notes: String, // session-specific notes
  status: String, // "scheduled", "in-progress", "completed", "cancelled"
  createdAt: Date,
  updatedAt: Date
}
```

### 4. Client Model
```javascript
{
  _id: ObjectId,
  email: String, // unique
  password: String, // hashed
  firstName: String,
  lastName: String,
  phone: String,
  dateOfBirth: Date,
  profilePhoto: String, // URL
  emergencyContact: {
    name: String,
    phone: String,
    relationship: String
  },
  healthInfo: {
    medicalConditions: [String],
    allergies: [String],
    medications: [String]
  },
  preferences: {
    notificationPreferences: {
      email: Boolean,
      sms: Boolean,
      push: Boolean
    },
    favoriteCategories: [String] // ["yoga", "pilates"]
  },
  brands: [ObjectId], // refs to Brand - brands client is associated with
  status: String, // "active", "inactive", "suspended"
  createdAt: Date,
  updatedAt: Date
}
```

### 5. SubscriptionPlan Model
```javascript
{
  _id: ObjectId,
  brand: ObjectId, // ref to Brand
  name: String, // "Monthly Unlimited"
  description: String,
  price: Number, // in cents
  billingCycle: String, // "monthly", "quarterly", "yearly"
  includedClasses: [ObjectId], // refs to Class - can be used for these classes (empty = all classes)
  frequencyLimit: {
    count: Number, // max bookings per period
    period: String, // "week", "month"
    resetDay: Number // day of week/month to reset
  },
  status: String, // "active", "inactive"
  createdAt: Date,
  updatedAt: Date
}
```

### 6. CreditPlan Model
```javascript
{
  _id: ObjectId,
  brand: ObjectId, // ref to Brand
  name: String, // "10 Class Package"
  description: String,
  price: Number, // in cents
  creditAmount: Number, // number of credits
  validityPeriod: Number, // days from purchase
  bonusCredits: Number, // extra credits (e.g., buy 10 get 2 free)
  includedClasses: [ObjectId], // refs to Class - can be used for these classes (empty = all classes)
  frequencyLimit: {
    count: Number, // max bookings per period
    period: String, // "week", "month"
    resetDay: Number // day of week/month to reset
  },
  status: String, // "active", "inactive"
  createdAt: Date,
  updatedAt: Date
}
```

### 7. Subscription Model
```javascript
{
  _id: ObjectId,
  client: ObjectId, // ref to Client
  brand: ObjectId, // ref to Brand
  subscriptionPlan: ObjectId, // ref to SubscriptionPlan
  startDate: Date,
  endDate: Date,
  status: String, // "active", "expired", "cancelled", "paused"
  payment: {
    status: String, // "pending", "completed", "failed"
    transactionId: String,
    date: Date,
    amount: Number,
    currency: String
  },
  stripeSubscriptionId: String, // for recurring billing
  autoRenew: Boolean,
  cancellationDate: Date,
  cancellationReason: String,
  createdAt: Date,
  updatedAt: Date
}
```

### 8. CreditBalance Model
```javascript
{
  _id: ObjectId,
  client: ObjectId, // ref to Client
  brand: ObjectId, // ref to Brand
  availableCredits: Number, // current available credits
  creditPackages: [{
    creditPlan: ObjectId, // ref to CreditPlan
    creditsRemaining: Number, // credits left from this package
    expiryDate: Date, // when this specific package expires
    purchaseDate: Date
  }],
  status: String, // "active", "expired"
  createdAt: Date,
  updatedAt: Date
}
```

### 9. Payment Model
```javascript
{
  _id: ObjectId,
  client: ObjectId, // ref to Client
  brand: ObjectId, // ref to Brand
  type: String, // "subscription", "credit_plan"
  relatedId: ObjectId, // ref to Subscription or CreditPlan
  amount: Number, // in cents
  status: String, // "pending", "completed", "failed"
  stripePaymentIntentId: String,
  createdAt: Date,
  updatedAt: Date
}
```

### 10. Booking Model
```javascript
{
  _id: ObjectId,
  client: ObjectId, // ref to Client
  session: ObjectId, // ref to Session
  bookingType: String, // "credits", "subscription"
  status: String, // "pending", "confirmed", "completed", "cancelled", "no-show"
  confirmationDate: Date,
  cancelledBy: String, // "client", "brand", "system"
  cancellationReason: String,
  cancellationDate: Date,
  // For credit bookings
  creditTransactionId: ObjectId, // ref to CreditBalance transaction
  // For subscription bookings
  subscriptionId: ObjectId, // ref to Subscription
  notes: String,
  createdAt: Date,
  updatedAt: Date
}
```

## Database Indexes

### Performance Optimizations
```javascript
// Brand indexes
db.brands.createIndex({ "email": 1 }, { unique: true })
db.brands.createIndex({ "status": 1 })

// Class indexes
db.classes.createIndex({ "brand": 1, "status": 1 })
db.classes.createIndex({ "category": 1 })

// Session indexes
db.sessions.createIndex({ "class": 1, "dateTime": 1 })
db.sessions.createIndex({ "dateTime": 1, "status": 1 })
db.sessions.createIndex({ "attendees.client": 1 })

// Client indexes
db.clients.createIndex({ "email": 1 }, { unique: true })
db.clients.createIndex({ "brands": 1 })
db.clients.createIndex({ "status": 1 })

// Booking indexes
db.bookings.createIndex({ "client": 1, "status": 1 })
db.bookings.createIndex({ "session": 1 })
db.bookings.createIndex({ "bookingType": 1, "status": 1 })

// Subscription indexes
db.subscriptions.createIndex({ "client": 1, "brand": 1, "status": 1 })
db.subscriptions.createIndex({ "endDate": 1, "status": 1 })

// CreditBalance indexes
db.creditbalances.createIndex({ "client": 1, "brand": 1 })
db.creditbalances.createIndex({ "expiryDate": 1, "status": 1 })
```

## Data Validation Rules

### Business Logic Constraints
1. **Session Capacity**: Cannot exceed class slots
2. **Booking Limits**: Respect frequency limits in subscription plans
3. **Credit Availability**: Cannot book without sufficient credits
4. **Subscription Validity**: Check active status and expiry dates
5. **Cancellation Windows**: Enforce cancellation policies
6. **Time Conflicts**: Prevent double-booking same time slot

### includedClasses Validation
- **Empty array `[]`**: Plan can be used for ALL classes of the brand
- **Specific class IDs**: Plan can ONLY be used for these specific classes
- **Validation**: All referenced classes must belong to the same brand
- **Business Rule**: Cannot have both empty array AND specific classes

### frequencyLimit Validation
- **count**: Must be positive integer (0 = unlimited)
- **period**: Must be "week" or "month"
- **resetDay**: 
  - For "week": 1-7 (Monday-Sunday)
  - For "month": 1-31 (day of month)
- **Business Rule**: If count is 0, period and resetDay are ignored

### Referential Integrity
- All foreign key references must exist
- Cascade deletes for dependent records
- Soft deletes for audit trails
- Transaction safety for booking operations
