# Fitness Booking Platform - Postman Collection Guide

This guide explains how to use the Postman collection to test the Fitness Booking Platform API.

## 📋 Prerequisites

1. **Postman**: Download and install [Postman](https://www.postman.com/downloads/)
2. **Server Running**: Make sure your fitness booking platform server is running on `http://localhost:3000`
3. **Database**: Ensure MongoDB is connected and running

## 🚀 Quick Start

### 1. Import the Collection

1. Open Postman
2. Click **Import** button
3. Select **Upload Files**
4. Choose the `postman-collection.json` file
5. Click **Import**

### 2. Set Up Environment Variables

The collection includes these variables that are automatically managed:

- `baseUrl`: Server base URL (default: `http://localhost:3000`)
- `accessToken`: JWT access token (auto-updated after login)
- `refreshToken`: JWT refresh token (auto-updated after login)
- `brandId`: Brand ID (auto-updated after brand registration/login)
- `clientId`: Client ID (auto-updated after client registration/login)

### 3. Start Testing

The collection is organized into logical folders. Follow this recommended testing flow:

## 📁 Collection Structure

### 1. **Health Check & API Info**
- Test server connectivity
- Get API version information

### 2. **Brand Authentication**
- **Brand Register**: Create a new fitness brand account
- **Brand Login**: Authenticate and get tokens
- **Brand Refresh Token**: Refresh expired access tokens

### 3. **Client Authentication**
- **Client Register**: Create a new client account
- **Client Login**: Authenticate and get tokens
- **Client Refresh Token**: Refresh expired access tokens

### 4. **Brand Profile Management**
- **Get Brand Profile**: Retrieve brand information
- **Update Brand Profile**: Modify brand details

### 5. **Client Profile Management**
- **Get Client Profile**: Retrieve client information
- **Update Client Profile**: Modify client details
- **Update Client Notifications Only**: Partial update example

### 6. **Error Testing**
- Test validation errors
- Test authentication errors
- Test authorization errors

## 🔐 Authentication Flow

### Automatic Token Management

The collection includes scripts that automatically handle authentication:

1. **After Registration/Login**: Tokens are automatically stored in collection variables
2. **Authorization Headers**: Automatically added to protected endpoints
3. **Token Refresh**: Use refresh endpoints when access tokens expire

### Manual Token Management

If you need to manually set tokens:

1. Go to the collection variables
2. Update `accessToken` and `refreshToken` values
3. Save the collection

## 📝 Example Test Flows

### Testing Brand Workflow

1. **Health Check** → Verify server is running
2. **Brand Register** → Create brand account (tokens auto-stored)
3. **Get Brand Profile** → Verify profile retrieval
4. **Update Brand Profile** → Test profile updates
5. **Brand Refresh Token** → Test token refresh

### Testing Client Workflow

1. **Health Check** → Verify server is running
2. **Client Register** → Create client account (tokens auto-stored)
3. **Get Client Profile** → Verify profile retrieval
4. **Update Client Profile** → Test full profile update
5. **Update Client Notifications Only** → Test partial updates
6. **Client Refresh Token** → Test token refresh

### Testing Error Scenarios

1. **Invalid Registration** → Test validation errors
2. **Unauthorized Access** → Test missing authentication
3. **Invalid Login** → Test wrong credentials

## 🧪 Test Scripts

The collection includes comprehensive test scripts that automatically verify:

- **Response Status Codes**: Correct HTTP status codes
- **Response Structure**: Expected JSON structure
- **Authentication**: Token presence and validity
- **Data Validation**: Correct data types and values
- **Security**: Password exclusion from responses

### Global Tests

Every request includes these automatic tests:
- Response time under 5 seconds
- Response has `success` field

### Endpoint-Specific Tests

Each endpoint has custom tests for:
- Correct status codes
- Expected response structure
- Data validation
- Token management

## 📊 Example Data

The collection includes realistic example data:

### Brand Registration Data
```json
{
  "name": "Elite Fitness Studio",
  "email": "admin@elitefitness.com",
  "password": "SecurePass123!",
  "description": "Premium fitness studio offering personalized training and group classes",
  "address": {
    "street": "123 Fitness Avenue",
    "city": "New York",
    "state": "NY",
    "zipCode": "10001",
    "country": "US"
  },
  "contact": {
    "phone": "+1-555-123-4567",
    "website": "https://elitefitness.com",
    "socialMedia": {
      "instagram": "@elitefitness",
      "facebook": "elitefitnessstudio",
      "twitter": "@elitefitness"
    }
  },
  "businessHours": [...]
}
```

### Client Registration Data
```json
{
  "email": "john.doe@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1-555-987-6543",
  "preferences": {
    "favoriteCategories": ["yoga", "pilates", "strength training"],
    "preferredDifficulty": "intermediate",
    "notifications": {
      "email": true,
      "sms": false,
      "push": true
    },
    "timezone": "America/New_York"
  }
}
```

## 🔧 Customization

### Changing Base URL

If your server runs on a different port or host:

1. Go to collection variables
2. Update `baseUrl` value
3. Save the collection

### Adding Custom Tests

To add custom tests to any request:

1. Select the request
2. Go to **Tests** tab
3. Add your test scripts using Postman's test syntax

### Environment-Specific Variables

For different environments (dev, staging, prod):

1. Create Postman environments
2. Set environment-specific variables
3. Switch environments as needed

## 🐛 Troubleshooting

### Common Issues

1. **Server Not Running**
   - Error: Connection refused
   - Solution: Start your server with `npm run dev`

2. **Database Connection Issues**
   - Error: Database connection failed
   - Solution: Ensure MongoDB is running and accessible

3. **Token Expired**
   - Error: `AUTH_003` - Access token expired
   - Solution: Use the refresh token endpoint

4. **Validation Errors**
   - Error: `VALIDATION_001` - Invalid input data
   - Solution: Check request body format and required fields

### Debug Tips

1. **Check Console**: View test results and logs in Postman console
2. **Response Body**: Examine error messages in response body
3. **Headers**: Verify Authorization headers are set correctly
4. **Variables**: Check collection variables are populated

## 📈 Performance Testing

The collection includes response time tests. For load testing:

1. Use Postman's Collection Runner
2. Set iterations and delay
3. Monitor response times and success rates

## 🔒 Security Notes

- **Never commit real credentials** to version control
- **Use environment variables** for sensitive data in CI/CD
- **Rotate tokens regularly** in production environments
- **Test with different user roles** to verify authorization

## 📚 Additional Resources

- [Postman Documentation](https://learning.postman.com/)
- [JWT Token Guide](https://jwt.io/introduction)
- [API Testing Best Practices](https://www.postman.com/api-testing/)

## 🤝 Contributing

When adding new endpoints:

1. Add requests to appropriate folders
2. Include example data
3. Add comprehensive test scripts
4. Update this documentation

---

**Happy Testing! 🚀**