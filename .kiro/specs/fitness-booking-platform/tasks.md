# Implementation Plan

- [x] 1. Set up project foundation and core infrastructure

  - Initialize Node.js TypeScript project with Express.js framework
  - Configure MongoDB connection with Mongoose ODM
  - Set up environment configuration with dotenv
  - Implement basic Express server with middleware (helmet, cors, rate limiting)
  - Create project directory structure (controllers, models, services, routes, middleware, utils)
  - _Requirements: 1.1, 7.1_

- [x] 2. Implement authentication system and JWT handling

  - Create JWT utility functions for token generation and verification
  - Implement password hashing utilities using bcryptjs
  - Create authentication middleware for brand and client route protection
  - Write unit tests for authentication utilities and middleware
  - _Requirements: 1.3, 7.3, 6.5, 11.5_

- [x] 3. Create core data models with Mongoose schemas

  - Implement Brand model with validation rules and indexes
  - Implement Client model with validation rules and indexes
  - Implement Class model with brand relationship and business validation
  - Implement Session model with capacity constraints and attendee tracking
  - Write unit tests for model validation and business rules
  - _Requirements: 1.1, 1.2, 2.1, 3.1, 7.1_

- [x] 4. Implement brand authentication and profile management

  - Create brand registration endpoint with email uniqueness validation
  - Create brand login endpoint with credential verification and JWT generation
  - Create brand profile management endpoints (GET, PUT)
  - Implement input validation using Joi for all brand auth endpoints
  - Write integration tests for brand authentication flow
  - _Requirements: 1.1, 1.3, 1.4, 1.5_

- [x] 5. Implement client authentication and profile management

  - Create client registration endpoint with email uniqueness validation
  - Create client login endpoint with credential verification and JWT generation
  - Create client profile management endpoints (GET, PUT)
  - Implement input validation using Joi for all client auth endpoints
  - Write integration tests for client authentication flow
  - _Requirements: 7.1, 7.3, 7.4, 7.5_

- [x] 6. Create class management system for brands

  - Implement class CRUD endpoints with brand ownership validation
  - Create class model validation for time blocks and capacity constraints
  - Implement class filtering and search functionality
  - Add authorization middleware to ensure brands can only manage their own classes
  - Write unit tests for class business logic and integration tests for endpoints
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 7. Implement session scheduling and management

  - Create session CRUD endpoints with class relationship validation
  - Implement bulk session creation for recurring schedules
  - Add session capacity validation and overbooking prevention
  - Create session filtering by date, brand, and status
  - Write unit tests for session validation and integration tests for endpoints
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 8. Create subscription and credit plan models

  - Implement SubscriptionPlan model with frequency limit validation
  - Implement CreditPlan model with validity period and bonus credit logic
  - Create plan validation for class inclusion rules (empty array vs specific classes)
  - Add database indexes for plan queries and filtering
  - Write unit tests for plan model validation and business rules
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 9. Implement payment plan management for brands

  - Create subscription plan CRUD endpoints with brand ownership validation
  - Create credit plan CRUD endpoints with brand ownership validation
  - Implement plan validation middleware for frequency limits and class restrictions
  - Add authorization to ensure brands can only manage their own plans
  - Write integration tests for plan management endpoints
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 10. Set up Stripe Connect integration for brands

  - Implement Stripe Connect account creation and onboarding flow
  - Create endpoint for brand Stripe account connection
  - Create endpoint to check Stripe account status and onboarding completion
  - Add Stripe account validation middleware for payment operations
  - Write unit tests for Stripe integration utilities
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 11. Create subscription and credit balance models

  - Implement Subscription model with payment tracking and status management
  - Implement CreditBalance model with FIFO package tracking
  - Create Payment model for transaction history
  - Add database indexes for efficient balance and subscription queries
  - Write unit tests for subscription and credit balance business logic
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 12.1, 12.2_

- [x] 12. Implement brand and class discovery for clients

  - Create brand listing endpoint with filtering and search capabilities
  - Create brand detail endpoint with class information
  - Implement class browsing with category, difficulty, and brand filtering
  - Create session browsing with date and availability filtering
  - Write integration tests for discovery endpoints
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 13. Create payment processing system

  - Implement Stripe PaymentIntent creation for subscription purchases
  - Implement Stripe PaymentIntent creation for credit plan purchases
  - Create payment confirmation endpoints for client-side payment completion
  - Add payment validation and error handling for failed transactions
  - Write unit tests for payment processing logic
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 14. Implement subscription management for clients

  - Create subscription purchase endpoint with Stripe payment integration
  - Create subscription listing endpoint for client's active subscriptions
  - Implement subscription cancellation with status updates
  - Add subscription validation for frequency limits and billing periods
  - Write integration tests for subscription management flow
  - _Requirements: 9.1, 9.2, 12.1, 12.3, 12.5_

- [x] 15. Implement credit management system

  - Create credit plan purchase endpoint with balance creation
  - Implement FIFO credit deduction algorithm for oldest packages first
  - Create credit balance viewing endpoint with expiry date tracking
  - Add automatic cleanup for expired credit packages
  - Write unit tests for FIFO credit logic and integration tests for endpoints
  - _Requirements: 9.3, 10.1, 12.2, 12.4_

- [ ] 16. Create booking eligibility validation service

  - Implement booking eligibility checker for session capacity
  - Create credit availability validator with FIFO package checking
  - Implement subscription validity checker with frequency limit validation
  - Add class inclusion validation for subscription and credit plans
  - Write unit tests for all booking eligibility scenarios
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 15.1, 15.2, 15.3_

- [ ] 17. Implement core booking system with transaction safety

  - Create booking creation endpoint with MongoDB transaction handling
  - Implement credit-based booking with atomic credit deduction
  - Implement subscription-based booking with frequency limit checking
  - Add session attendee management with capacity validation
  - Write integration tests for booking creation scenarios
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 13.1, 13.2_

- [ ] 18. Implement booking cancellation system

  - Create booking cancellation endpoint with policy validation
  - Implement credit restoration for cancelled credit-based bookings
  - Add cancellation window validation based on class policies
  - Handle session attendee removal and capacity updates
  - Write unit tests for cancellation logic and credit restoration
  - _Requirements: 11.2, 11.4, 11.5, 13.3_

- [ ] 19. Create booking management for clients and brands

  - Implement client booking listing with filtering by status and date
  - Create brand booking management with ownership validation
  - Add booking status updates (confirm, cancel) for brands
  - Implement booking history and status tracking
  - Write integration tests for booking management endpoints
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 11.1, 11.3_

- [ ] 19A. Implement client invitation system

  - Create ClientInvitation model with token generation and expiry validation
  - Implement brand invitation endpoints (create, list, resend, cancel)
  - Create client invitation response endpoints (accept, decline)
  - Add email notification service for invitation delivery
  - Implement automatic client-brand association upon invitation acceptance
  - Write unit tests for invitation logic and integration tests for endpoints
  - _Requirements: 6A.1, 6A.2, 6A.3, 6A.4, 6A.5_

- [ ] 20. Implement Stripe webhook handling

  - Create webhook endpoint with signature verification
  - Implement payment success handling for subscription creation
  - Implement payment success handling for credit balance updates
  - Add payment failure handling with cleanup of pending records
  - Write unit tests for webhook processing and error scenarios
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

- [ ] 21. Add comprehensive error handling and validation

  - Implement global error handler middleware with standardized error codes
  - Create custom error classes for authentication, booking, and payment errors
  - Add input validation middleware using Joi for all endpoints
  - Implement rate limiting and security headers
  - Write unit tests for error handling scenarios
  - _Requirements: 13.4, 13.5, 15.4, 15.5_

- [ ] 22. Create file upload system for images

  - Implement Cloudinary integration for image storage
  - Create image upload endpoint with file validation
  - Add image upload to brand profile and client profile endpoints
  - Implement image URL validation and security checks
  - Write integration tests for file upload functionality
  - _Requirements: 1.4, 7.4_

- [ ] 23. Implement business rule enforcement system

  - Create frequency limit validation service for subscriptions
  - Implement cancellation policy enforcement with time window calculations
  - Add class inclusion validation for plans and bookings
  - Create credit expiry management with automatic cleanup
  - Write comprehensive unit tests for all business rule scenarios
  - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

- [ ] 24. Add comprehensive logging and monitoring

  - Implement structured logging for all critical operations
  - Add request/response logging middleware
  - Create error logging with stack traces and context
  - Add performance monitoring for database queries
  - Write monitoring utilities for system health checks
  - _Requirements: 13.4, 13.5_

- [ ] 25. Create database migration and seed scripts

  - Implement database initialization scripts
  - Create sample data generation for testing
  - Add database migration utilities for schema updates
  - Create data validation scripts for integrity checks
  - Write documentation for database setup and maintenance
  - _Requirements: 1.1, 2.1, 3.1, 7.1_

- [ ] 26. Implement comprehensive test suite

  - Create unit tests for all service classes and business logic
  - Implement integration tests for all API endpoints
  - Add end-to-end tests for critical user flows (registration, booking, payment)
  - Create performance tests for concurrent booking scenarios
  - Write test utilities and fixtures for consistent testing
  - _Requirements: All requirements validation_

- [ ] 27. Add API documentation and deployment configuration

  - Create OpenAPI/Swagger documentation for all endpoints
  - Implement API versioning strategy
  - Add deployment configuration for production environment
  - Create environment-specific configuration files
  - Write deployment and maintenance documentation
  - _Requirements: System documentation and deployment_

- [ ] 28. Extend class model for gym access functionality

  - Add classType field ('scheduled' | 'open-access') to Class model with validation
  - Add autoCheckoutDuration and allowWalkIns fields for open-access classes
  - Update class validation to handle gym access specific business rules
  - Modify class creation and update endpoints to support gym access configuration
  - Write unit tests for gym access class validation and business logic
  - _Requirements: 2A.1, 2A.2, 2A.3, 2A.4, 2A.5_

- [ ] 29. Extend session model for real-time occupancy tracking

  - Add currentOccupancy field and checkIns array to Session model
  - Create CheckInRecord interface with client, timestamps, and booking information
  - Update session validation to handle gym access capacity rules
  - Add database indexes for efficient occupancy and check-in queries
  - Write unit tests for session occupancy tracking and validation
  - _Requirements: 3A.1, 3A.2, 3A.3, 3A.4, 3A.5_

- [ ] 30. Implement gym access service and business logic

  - Create GymAccessService with check-in, check-out, and occupancy management methods
  - Implement capacity validation and payment eligibility checking for gym access
  - Create auto-checkout algorithm for inactive clients based on autoCheckoutDuration
  - Add walk-in access processing with allowWalkIns configuration support
  - Write comprehensive unit tests for all gym access business logic scenarios
  - _Requirements: 10A.1, 10A.2, 10A.3, 10A.4, 10A.5, 10B.1, 10B.2, 10B.3, 10B.4, 10B.5_

- [ ] 31. Create gym access API endpoints for clients

  - Implement client check-in endpoint with capacity and payment validation
  - Create client check-out endpoint with occupancy updates
  - Add real-time occupancy viewing endpoint for clients
  - Implement client check-in status endpoint to show current gym access state
  - Write integration tests for all client gym access endpoints
  - _Requirements: 10A.1, 10A.2, 10A.3, 10C.1, 10C.2, 10C.3, 10C.4, 10C.5_

- [ ] 32. Create gym access management endpoints for brands

  - Implement brand occupancy monitoring endpoint with real-time data
  - Create brand check-ins listing endpoint with filtering and search capabilities
  - Add manual auto-checkout trigger endpoint for brand management
  - Implement gym access analytics endpoint with usage patterns and peak hours
  - Write integration tests for brand gym access management endpoints
  - _Requirements: 3A.1, 3A.2, 3A.3, 3A.4, 3A.5_

- [ ] 33. Implement automated background processes for gym access

  - Create scheduled job for auto-checkout of inactive clients
  - Implement occupancy cleanup and validation background processes
  - Add expired check-in record cleanup and archival system
  - Create monitoring and alerting for gym capacity and system health
  - Write unit tests for background processes and error handling scenarios
  - _Requirements: 3A.4, 3A.5, 10A.4_

- [ ] 34. Integrate gym access with existing booking and payment systems
  - Extend booking eligibility validation to support gym access sessions
  - Update credit deduction and subscription validation for gym access usage
  - Modify booking creation flow to handle gym access pre-booking scenarios
  - Add gym access support to booking cancellation and refund processes
  - Write integration tests for gym access payment and booking integration
  - _Requirements: 10A.1, 10A.2, 10B.1, 10B.2, 10B.3, 10B.4_
