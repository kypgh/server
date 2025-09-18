# Fix Existing Brands for Cyprus

## The Problem
Your existing brands were created with **US** Stripe Connect accounts, but you need **Cyprus** accounts.

## Two Options to Fix This

### Option 1: Automatic Migration (Recommended)

Run the migration script to automatically recreate all brand accounts:

```bash
# Install dependencies if needed
npm install

# Run the migration script
node scripts/migrate-brands-to-cyprus.js
```

**What this does:**
- Finds all brands with existing Stripe accounts
- Creates new Cyprus accounts for each brand
- Updates your database with new account IDs
- Keeps old accounts (you can delete them later)

### Option 2: Manual Fix (For Testing)

For immediate testing, you can manually fix one brand:

1. **Go to your Stripe Dashboard**
2. **Delete the existing US Connect account** for your test brand
3. **In your app, trigger Stripe Connect setup again** for that brand
4. **The new account will be created as Cyprus** (because we fixed the code)

### Option 3: Fresh Start (Simplest)

If you don't have important data:

1. **Create a new brand** in your app
2. **Set up Stripe Connect** for the new brand
3. **It will automatically be Cyprus-based** now
4. **Test payments** with the new brand

## After Migration

### ⚠️ Important: Brands Need to Re-onboard
- All brands will need to **complete Stripe onboarding again**
- Their old onboarding status is reset to `false`
- They'll get new onboarding links

### ✅ Benefits
- All accounts will be **Cyprus-based**
- **EUR currency** throughout
- **Mobile payments will work**
- **No region conflicts**

## Quick Test

To test if it's working:

1. **Create a new brand** (or use migrated one)
2. **Complete Stripe Connect onboarding**
3. **Create a subscription/credit plan** with EUR pricing
4. **Try mobile payment**
5. **Should work perfectly!** 🎉

## Verification

Check if a brand is properly configured:
- Stripe account country: **CY** (Cyprus)
- Currency: **EUR**
- Onboarding: **Complete**
- Payment capability: **Enabled**

Your mobile app should work immediately after this fix!