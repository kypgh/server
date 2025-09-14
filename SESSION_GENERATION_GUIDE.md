# Session Generation Guide

This guide explains how to create and manage sessions in the Fitness Booking Platform API.

## Prerequisites

Before creating sessions, you need:

1. **Brand Authentication**: You must be logged in as a brand
2. **Active Class**: You need at least one active class created
3. **Valid Access Token**: Ensure your JWT token is valid and not expired

## Authentication Setup

### 1. Register/Login as Brand

```bash
# Register Brand (if new)
POST /api/auth/brand/register
{
  "name": "Elite Fitness Studio",
  "email": "admin@elitefitness.com",
  "password": "SecurePass123!",
  "address": {
    "street": "123 Fitness Avenue",
    "city": "New York",
    "state": "NY",
    "zipCode": "10001",
    "country": "US"
  },
  "contact": {
    "phone": "+1-555-123-4567",
    "website": "https://elitefitness.com"
  },
  "businessHours": [
    {
      "day": "monday",
      "openTime": "06:00",
      "closeTime": "22:00",
      "isClosed": false
    }
  ]
}

# OR Login (if existing)
POST /api/auth/brand/login
{
  "email": "admin@elitefitness.com",
  "password": "SecurePass123!"
}
```

**Response**: Save the `accessToken` for subsequent requests.

### 2. Create a Class (Required for Sessions)

```bash
POST /api/brand/classes
Authorization: Bearer YOUR_ACCESS_TOKEN
{
  "name": "Yoga Flow",
  "description": "A relaxing yoga flow class suitable for all levels",
  "category": "yoga",
  "difficulty": "beginner",
  "slots": 15,
  "duration": 60,
  "cancellationPolicy": 24,
  "timeBlocks": [
    {
      "day": "monday",
      "startTime": "09:00",
      "endTime": "10:00"
    },
    {
      "day": "wednesday", 
      "startTime": "18:00",
      "endTime": "19:00"
    },
    {
      "day": "friday",
      "startTime": "07:00",
      "endTime": "08:00"
    }
  ],
  "status": "active"
}
```

**Response**: Save the `class._id` for creating sessions.

## Session Creation Methods

### Method 1: Create Individual Sessions

#### Basic Session Creation

```bash
POST /api/brand/sessions
Authorization: Bearer YOUR_ACCESS_TOKEN
{
  "class": "CLASS_ID_FROM_ABOVE",
  "dateTime": "2024-12-25T09:00:00.000Z",
  "capacity": 12
}
```

#### Session with Default Class Capacity

```bash
POST /api/brand/sessions
Authorization: Bearer YOUR_ACCESS_TOKEN
{
  "class": "CLASS_ID_FROM_ABOVE",
  "dateTime": "2024-12-26T09:00:00.000Z"
  // capacity will default to class.slots (15 in our example)
}
```

### Method 2: Bulk Session Creation (Recommended)

This method automatically creates sessions based on the class's time blocks.

```bash
POST /api/brand/sessions/bulk
Authorization: Bearer YOUR_ACCESS_TOKEN
{
  "class": "CLASS_ID_FROM_ABOVE",
  "startDate": "2024-12-30T00:00:00.000Z",
  "endDate": "2025-01-13T23:59:59.000Z",
  "capacity": 15,
  "excludeDates": ["2025-01-01T00:00:00.000Z"]
}
```

**How Bulk Creation Works**:
- Scans each day between `startDate` and `endDate`
- For each day, checks if it matches any `timeBlocks` in the class
- Creates sessions automatically for matching days/times
- Skips dates in `excludeDates` array
- Skips past dates and existing sessions

**Example**: With the class above having timeBlocks for Monday 09:00, Wednesday 18:00, and Friday 07:00:
- Creates sessions every Monday at 09:00
- Creates sessions every Wednesday at 18:00  
- Creates sessions every Friday at 07:00
- Excludes January 1st (New Year's Day)

## Session Management

### View All Sessions

```bash
GET /api/brand/sessions
Authorization: Bearer YOUR_ACCESS_TOKEN
```

### Filter Sessions

```bash
# By status
GET /api/brand/sessions?status=scheduled&page=1&limit=10

# By date range
GET /api/brand/sessions?startDate=2024-12-20T00:00:00.000Z&endDate=2024-12-31T23:59:59.000Z

# By class
GET /api/brand/sessions?class=CLASS_ID

# Available sessions only
GET /api/brand/sessions?availableOnly=true

# Combined filters
GET /api/brand/sessions?status=scheduled&class=CLASS_ID&availableOnly=true&sortBy=dateTime&sortOrder=asc
```

### Update Session

```bash
PUT /api/brand/sessions/SESSION_ID
Authorization: Bearer YOUR_ACCESS_TOKEN
{
  "capacity": 18,
  "status": "in-progress"
}
```

### Cancel Session

```bash
DELETE /api/brand/sessions/SESSION_ID
Authorization: Bearer YOUR_ACCESS_TOKEN
```

### Get Session Statistics

```bash
GET /api/brand/sessions/stats
Authorization: Bearer YOUR_ACCESS_TOKEN
```

## Session Validation Rules

### Capacity Validation
- Session capacity cannot exceed class slots
- Cannot reduce capacity below current attendees count
- Minimum capacity is 1, maximum is 100

### Date/Time Validation
- Sessions must be scheduled for future dates
- Cannot create duplicate sessions at the same time for the same class
- Past sessions cannot be cancelled

### Status Validation
- Valid statuses: `scheduled`, `in-progress`, `completed`, `cancelled`
- Only `scheduled` future sessions can be cancelled
- Status transitions should follow logical flow

## Common Use Cases

### 1. Weekly Recurring Classes

```bash
# Create 4 weeks of sessions for a weekly class
POST /api/brand/sessions/bulk
{
  "class": "CLASS_ID",
  "startDate": "2024-12-30T00:00:00.000Z",
  "endDate": "2025-01-27T23:59:59.000Z",
  "capacity": 15
}
```

### 2. Holiday Schedule with Exclusions

```bash
# Create sessions but exclude holidays
POST /api/brand/sessions/bulk
{
  "class": "CLASS_ID", 
  "startDate": "2024-12-15T00:00:00.000Z",
  "endDate": "2025-01-15T23:59:59.000Z",
  "excludeDates": [
    "2024-12-25T00:00:00.000Z",  // Christmas
    "2025-01-01T00:00:00.000Z"   // New Year
  ]
}
```

### 3. Special Event Session

```bash
# Create a one-off session outside regular schedule
POST /api/brand/sessions
{
  "class": "CLASS_ID",
  "dateTime": "2024-12-31T23:00:00.000Z",  // New Year's Eve special
  "capacity": 20
}
```

## Error Handling

### Common Errors

1. **SESSION_001**: Session capacity exceeds class slots
2. **SESSION_002**: Duplicate session at same time
3. **SESSION_003**: Access denied to class
4. **SESSION_004**: Session not found
5. **SESSION_005**: Cannot reduce capacity below attendees
6. **SESSION_006**: Cannot cancel past/non-scheduled session
7. **SESSION_007**: No valid sessions to create in bulk

### Example Error Response

```json
{
  "success": false,
  "error": {
    "code": "SESSION_001",
    "message": "Session capacity (25) cannot exceed class slots (15)"
  }
}
```

## Best Practices

### 1. Use Bulk Creation for Regular Schedules
- More efficient than creating individual sessions
- Automatically follows class time blocks
- Handles date validation and duplicates

### 2. Set Appropriate Capacities
- Consider class space limitations
- Account for no-shows (slightly overbook if needed)
- Use class default capacity when possible

### 3. Plan Ahead
- Create sessions well in advance
- Use exclude dates for known holidays/closures
- Monitor session utilization with stats endpoint

### 4. Regular Maintenance
- Check session statistics regularly
- Cancel sessions with low enrollment if needed
- Update capacities based on demand

## Postman Collection Usage

The updated Postman collection includes:

1. **Session Management (Brand)** folder with all endpoints
2. **Environment variables** for sessionId storage
3. **Pre-configured test scripts** for validation
4. **Sample requests** with realistic data

### Quick Start with Postman:

1. Run "Brand Register" or "Brand Login"
2. Run "Create Class" to get a class ID
3. Run "Create Session" or "Create Bulk Sessions"
4. Use other endpoints to manage sessions

The collection automatically stores tokens and IDs for seamless testing.