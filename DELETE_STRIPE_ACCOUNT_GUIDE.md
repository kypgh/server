# Delete Stripe Connect Account - Quick Guide

## What This Does
Deletes the US-based Stripe Connect account for a brand so you can create a new Cyprus-based one.

## API Endpoint Created
```
DELETE /api/brand/stripe/account
```

## How to Use

### Option 1: Using Postman Collection
1. **Import the collection**: `postman/Delete-Stripe-Account.postman_collection.json`
2. **Set variables**:
   - `baseUrl`: Your API URL (e.g., `http://localhost:3001`)
   - `brandToken`: JWT token for the brand you want to delete
3. **Run the request**

### Option 2: Using cURL
```bash
curl -X DELETE http://localhost:3001/api/brand/stripe/account \
  -H "Authorization: Bearer YOUR_BRAND_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

### Option 3: Using Your Frontend
Add a "Delete Stripe Account" button that calls:
```javascript
const response = await fetch('/api/brand/stripe/account', {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${brandToken}`,
    'Content-Type': 'application/json'
  }
});
```

## What Happens When You Delete

1. **Stripe account is deleted** from Stripe's system
2. **Database is updated**:
   - `stripeConnectAccountId` → `null`
   - `stripeOnboardingComplete` → `false`
3. **Brand can now create new account** (will be Cyprus-based)

## Success Response
```json
{
  "success": true,
  "data": {
    "deleted": true,
    "accountId": "acct_1234567890",
    "message": "Stripe Connect account deleted successfully"
  }
}
```

## Error Responses

### No Account to Delete
```json
{
  "success": false,
  "error": {
    "code": "STRIPE_004",
    "message": "No Stripe account to delete"
  }
}
```

### Unauthorized
```json
{
  "success": false,
  "error": {
    "code": "AUTH_003",
    "message": "Unauthorized access"
  }
}
```

## After Deletion

1. **Create new account**: Use your existing Stripe Connect flow
2. **New account will be Cyprus-based** (because we fixed the code)
3. **Complete onboarding** for the new account
4. **Test payments** - should work perfectly!

## Quick Test Flow

1. **Delete old account**: `DELETE /api/brand/stripe/account`
2. **Create new account**: `POST /api/brand/stripe/connect`
3. **Complete onboarding**: Follow the onboarding URL
4. **Test payment**: Try mobile payment flow
5. **Success!** 🎉

## Safety Notes

- **Test mode accounts**: Can be deleted anytime
- **Live mode accounts**: Can only be deleted if balance is zero
- **No data loss**: Only the Stripe account is deleted, your brand data remains
- **Reversible**: You can always create a new account

Ready to fix your Cyprus setup! 🇨🇾