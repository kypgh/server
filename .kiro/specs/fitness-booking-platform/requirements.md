# Requirements Document

## Introduction

This document outlines the requirements for a multi-brand fitness booking platform that enables fitness brands to manage their classes and sessions while allowing clients to discover, book, and pay for fitness services. The platform supports both credit-based and subscription-based booking models with direct payment processing to each brand's Stripe account. The platform supports two types of classes: scheduled classes with fixed capacity and gym access classes with dynamic capacity and real-time occupancy tracking.

## Requirements

### Requirement 1

**User Story:** As a fitness brand owner, I want to register and manage my brand profile, so that I can establish my presence on the platform and provide essential business information to potential clients.

#### Acceptance Criteria

1. WHEN a brand owner accesses the registration endpoint THEN the system SHALL require email, password, brand name, and basic business information
2. WHEN a brand owner provides valid registration data THEN the system SHALL create a unique brand account with hashed password storage
3. WHEN a brand owner logs in with valid credentials THEN the system SHALL generate a JWT token containing brand ID and type
4. WHEN a brand owner updates their profile THEN the system SHALL validate and save changes to business information, contact details, and business hours
5. IF a brand owner provides duplicate email during registration THEN the system SHALL reject the registration with appropriate error message

### Requirement 2

**User Story:** As a fitness brand owner, I want to create and manage fitness classes, so that I can define the services I offer and set capacity and scheduling parameters.

#### Acceptance Criteria

1. WHEN a brand owner creates a class THEN the system SHALL require name, description, category, difficulty level, capacity, and duration
2. WHEN a brand owner defines time blocks for a class THEN the system SHALL store recurring schedule patterns with days and time slots
3. WHEN a brand owner updates class information THEN the system SHALL validate changes and update existing class records
4. WHEN a brand owner deactivates a class THEN the system SHALL prevent new session creation while preserving existing sessions
5. IF a brand owner sets invalid time blocks THEN the system SHALL reject the configuration with validation errors

### Requirement 2A

**User Story:** As a fitness brand owner, I want to create gym access classes with dynamic capacity, so that I can offer flexible facility access where clients can come and go throughout operating hours.

#### Acceptance Criteria

1. WHEN a brand owner creates a gym access class THEN the system SHALL require classType as "open-access", name, description, capacity, and operating hours
2. WHEN a brand owner configures gym access settings THEN the system SHALL allow setting autoCheckoutDuration and allowWalkIns preferences
3. WHEN a brand owner sets allowWalkIns to true THEN the system SHALL allow clients to check in without prior booking if capacity permits
4. WHEN a brand owner sets allowWalkIns to false THEN the system SHALL require clients to book gym access sessions in advance
5. IF a brand owner sets autoCheckoutDuration THEN the system SHALL automatically check out inactive clients after the specified time period

### Requirement 3

**User Story:** As a fitness brand owner, I want to schedule individual sessions for my classes, so that I can offer specific time slots for clients to book.

#### Acceptance Criteria

1. WHEN a brand owner creates a session THEN the system SHALL require class reference, specific date/time, and capacity
2. WHEN a brand owner creates multiple sessions THEN the system SHALL support bulk creation for recurring schedules
3. WHEN a brand owner updates session details THEN the system SHALL validate capacity constraints and time conflicts
4. WHEN a brand owner cancels a session THEN the system SHALL handle existing bookings and trigger appropriate refunds
5. IF session capacity is exceeded during booking THEN the system SHALL prevent overbooking and return capacity error

### Requirement 3A

**User Story:** As a fitness brand owner, I want to manage gym access sessions with real-time occupancy tracking, so that I can monitor facility usage and enforce capacity limits.

#### Acceptance Criteria

1. WHEN a brand owner creates gym access sessions THEN the system SHALL generate daily sessions covering the full operating hours
2. WHEN clients check in to gym access sessions THEN the system SHALL track currentOccupancy and individual check-in times
3. WHEN a brand owner views gym occupancy THEN the system SHALL display real-time count of clients currently in the facility
4. WHEN the autoCheckoutDuration expires THEN the system SHALL automatically check out inactive clients and update occupancy count
5. IF gym capacity is reached THEN the system SHALL prevent new check-ins until occupancy decreases

### Requirement 4

**User Story:** As a fitness brand owner, I want to create subscription and credit plans, so that I can offer flexible payment options to my clients.

#### Acceptance Criteria

1. WHEN a brand owner creates a subscription plan THEN the system SHALL require name, price, billing cycle, and frequency limits
2. WHEN a brand owner creates a credit plan THEN the system SHALL require name, price, credit amount, and validity period
3. WHEN a brand owner defines class restrictions for plans THEN the system SHALL support both specific class lists and all-classes access
4. WHEN a brand owner sets frequency limits THEN the system SHALL define count, period, and reset day parameters
5. IF a brand owner creates conflicting plan configurations THEN the system SHALL validate and reject invalid combinations

### Requirement 5

**User Story:** As a fitness brand owner, I want to connect my Stripe account, so that I can receive direct payments from clients without platform fees.

#### Acceptance Criteria

1. WHEN a brand owner initiates Stripe connection THEN the system SHALL redirect to Stripe Connect onboarding flow
2. WHEN Stripe onboarding is completed THEN the system SHALL store the connected account ID and mark onboarding as complete
3. WHEN a brand owner checks connection status THEN the system SHALL verify account status with Stripe API
4. WHEN payments are processed THEN the system SHALL direct funds to the brand's connected Stripe account
5. IF Stripe connection fails or is incomplete THEN the system SHALL prevent payment processing and show appropriate errors

### Requirement 6

**User Story:** As a fitness brand owner, I want to view and manage client bookings, so that I can track attendance and handle booking-related issues.

#### Acceptance Criteria

1. WHEN a brand owner views bookings THEN the system SHALL display bookings filtered by their brand's sessions only
2. WHEN a brand owner confirms a booking THEN the system SHALL update booking status and notify the client
3. WHEN a brand owner cancels a booking THEN the system SHALL process refunds according to cancellation policy
4. WHEN a brand owner filters bookings THEN the system SHALL support filtering by status, date, and class
5. IF a brand owner attempts to access another brand's bookings THEN the system SHALL deny access with authorization error

### Requirement 6A

**User Story:** As a fitness brand owner, I want to invite clients to my brand, so that I can proactively build my client base and establish relationships with potential customers.

#### Acceptance Criteria

1. WHEN a brand owner sends a client invitation THEN the system SHALL create an invitation record with expiry date and unique token
2. WHEN a client receives an invitation THEN the system SHALL send notification with invitation details and acceptance link
3. WHEN a client accepts an invitation THEN the system SHALL associate the client with the brand and mark invitation as accepted
4. WHEN a client declines or ignores an invitation THEN the system SHALL mark invitation as declined or allow it to expire
5. IF a brand owner invites an already associated client THEN the system SHALL prevent duplicate invitations and show appropriate message

### Requirement 7

**User Story:** As a client, I want to register and manage my profile, so that I can access the platform and maintain my personal information.

#### Acceptance Criteria

1. WHEN a client accesses registration THEN the system SHALL require email, password, first name, and last name
2. WHEN a client provides valid registration data THEN the system SHALL create a unique client account with hashed password
3. WHEN a client logs in with valid credentials THEN the system SHALL generate a JWT token containing client ID and type
4. WHEN a client updates their profile THEN the system SHALL validate and save changes to personal information and preferences
5. IF a client provides duplicate email during registration THEN the system SHALL reject registration with appropriate error message

### Requirement 8

**User Story:** As a client, I want to discover and browse fitness brands and their classes, so that I can find services that match my interests and schedule.

#### Acceptance Criteria

1. WHEN a client browses brands THEN the system SHALL display all active brands with basic information
2. WHEN a client views a specific brand THEN the system SHALL show detailed brand information and available classes
3. WHEN a client browses classes THEN the system SHALL support filtering by category, difficulty, and brand
4. WHEN a client views class details THEN the system SHALL display description, schedule, capacity, and pricing options
5. IF no classes match client filters THEN the system SHALL display appropriate no-results message

### Requirement 9

**User Story:** As a client, I want to purchase subscription and credit plans, so that I can access fitness classes according to my preferred payment model.

#### Acceptance Criteria

1. WHEN a client selects a subscription plan THEN the system SHALL create Stripe PaymentIntent on the brand's connected account
2. WHEN a client completes subscription payment THEN the system SHALL create active subscription record with proper dates
3. WHEN a client purchases credit plan THEN the system SHALL create credit balance with proper expiry dates and FIFO tracking
4. WHEN payment processing fails THEN the system SHALL handle errors gracefully and prevent partial record creation
5. IF a client has insufficient payment method THEN the system SHALL display clear payment error messages

### Requirement 10

**User Story:** As a client, I want to book fitness sessions using my credits or subscription, so that I can secure my spot in classes I want to attend.

#### Acceptance Criteria

1. WHEN a client books with credits THEN the system SHALL deduct credits using FIFO method from oldest non-expired package
2. WHEN a client books with subscription THEN the system SHALL validate frequency limits and billing period constraints
3. WHEN a client has both credits and subscription THEN the system SHALL allow client choice with subscription as default
4. WHEN session capacity is full THEN the system SHALL prevent booking and display capacity error
5. IF a client lacks sufficient credits or valid subscription THEN the system SHALL redirect to purchase options

### Requirement 10A

**User Story:** As a client, I want to check in and out of gym access sessions, so that I can use the facility flexibly while my attendance is tracked for billing and capacity management.

#### Acceptance Criteria

1. WHEN a client checks in to gym access THEN the system SHALL validate payment eligibility and current facility capacity
2. WHEN a client checks in successfully THEN the system SHALL deduct credits or validate subscription and update current occupancy
3. WHEN a client checks out manually THEN the system SHALL update occupancy count and record actual usage time
4. WHEN a client remains checked in beyond autoCheckoutDuration THEN the system SHALL automatically check them out
5. IF facility is at capacity THEN the system SHALL prevent check-in and display current occupancy status

### Requirement 10B

**User Story:** As a client, I want to access gym facilities through walk-in or pre-booking options, so that I can choose the access method that best fits my schedule and preferences.

#### Acceptance Criteria

1. WHEN gym allows walk-ins and client arrives without booking THEN the system SHALL allow immediate check-in if capacity permits
2. WHEN gym requires pre-booking and client arrives THEN the system SHALL validate existing booking before allow check-in
3. WHEN a client pre-books gym access THEN the system SHALL reserve their access but not count against current occupancy until check-in
4. WHEN a client has pre-booked but doesn't show up THEN the system SHALL not affect current occupancy tracking
5. IF a client tries to walk-in when walk-ins are disabled THEN the system SHALL redirect to booking interface

### Requirement 10C

**User Story:** As a client, I want to view real-time gym occupancy information, so that I can plan my visit during less crowded times and make informed decisions about when to go.

#### Acceptance Criteria

1. WHEN a client views gym access sessions THEN the system SHALL display current occupancy count and maximum capacity
2. WHEN a client checks occupancy status THEN the system SHALL show real-time data updated within the last minute
3. WHEN a client views gym information THEN the system SHALL display occupancy as both count and percentage (e.g., "45/120 - 38% full")
4. WHEN gym is at or near capacity THEN the system SHALL display appropriate status indicators (e.g., "Nearly Full", "At Capacity")
5. IF gym occupancy data is unavailable THEN the system SHALL display appropriate message and allow booking/check-in attempts

### Requirement 11

**User Story:** As a client, I want to view and manage my bookings, so that I can track my scheduled sessions and make changes when needed.

#### Acceptance Criteria

1. WHEN a client views their bookings THEN the system SHALL display all bookings with session details and status
2. WHEN a client cancels a booking THEN the system SHALL validate cancellation policy and process credit restoration if applicable
3. WHEN a client filters bookings THEN the system SHALL support filtering by status, date, and brand
4. WHEN booking cancellation is within policy window THEN the system SHALL restore credits to original package
5. IF cancellation is outside policy window THEN the system SHALL prevent cancellation or apply penalties as configured

### Requirement 12

**User Story:** As a client, I want to manage my subscription and credit balances, so that I can track my available services and make informed booking decisions.

#### Acceptance Criteria

1. WHEN a client views subscriptions THEN the system SHALL display active subscriptions with remaining frequency limits
2. WHEN a client views credit balances THEN the system SHALL show available credits by brand with expiry dates
3. WHEN a client cancels a subscription THEN the system SHALL update status and handle billing cycle appropriately
4. WHEN credits expire THEN the system SHALL automatically update available balances and clean up expired packages
5. IF subscription auto-renewal fails THEN the system SHALL handle payment failures and update subscription status

### Requirement 13

**User Story:** As the system, I want to ensure data consistency and transaction safety, so that booking operations maintain integrity under concurrent access.

#### Acceptance Criteria

1. WHEN multiple clients book the same session simultaneously THEN the system SHALL use database transactions to prevent overbooking
2. WHEN credit deduction occurs during booking THEN the system SHALL use atomic operations to ensure consistency
3. WHEN booking cancellation restores credits THEN the system SHALL handle expired package edge cases appropriately
4. WHEN payment processing fails THEN the system SHALL rollback all related database changes
5. IF database transaction fails THEN the system SHALL abort operation and return appropriate error response

### Requirement 14

**User Story:** As the system, I want to handle Stripe webhooks and payment confirmations, so that payment status is accurately reflected in booking and subscription records.

#### Acceptance Criteria

1. WHEN Stripe webhook is received THEN the system SHALL verify webhook signature for security
2. WHEN payment succeeds THEN the system SHALL update corresponding subscription or credit balance records
3. WHEN payment fails THEN the system SHALL update payment status and handle cleanup of pending records
4. WHEN subscription payment succeeds THEN the system SHALL extend subscription period and reset frequency limits
5. IF webhook processing fails THEN the system SHALL log errors and implement retry mechanisms for critical updates

### Requirement 15

**User Story:** As the system, I want to enforce business rules and validation, so that booking operations comply with brand policies and system constraints.

#### Acceptance Criteria

1. WHEN validating booking eligibility THEN the system SHALL check session capacity, client payment status, and frequency limits
2. WHEN processing credit usage THEN the system SHALL enforce FIFO ordering and expiry date validation
3. WHEN validating subscription usage THEN the system SHALL check billing period limits and class inclusion rules
4. WHEN enforcing cancellation policies THEN the system SHALL calculate time windows and apply appropriate restrictions
5. IF business rule validation fails THEN the system SHALL prevent operation and return specific validation error messages
