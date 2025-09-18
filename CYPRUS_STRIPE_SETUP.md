# Cyprus Stripe Setup Guide

## What We Fixed

Your app was configured for **US/USD** but you're operating in **Cyprus/EUR**. This caused the region mismatch error.

## Changes Made

### 1. Currency Changed to EUR

- All PaymentIntents now use `currency: "eur"`
- All database records store `currency: "EUR"`
- Prices should be in **cents** (e.g., €15.00 = 1500 cents)

### 2. Re-enabled Stripe Connect

- Direct payments to individual fitness brands
- Each brand gets their own Stripe Connect account
- Automatic revenue splitting

## Stripe Account Requirements

### Your Platform Account (Main)

- **Country**: Cyprus
- **Currency**: EUR
- **Business Type**: Platform/Marketplace

### Brand Connect Accounts

- **Country**: Cyprus (same as platform)
- **Currency**: EUR
- **Business Type**: Individual businesses

## Testing Your Setup

### 1. Create Test Brand Connect Account

```bash
# Use Stripe CLI or dashboard to create Express account
stripe accounts create \
  --type=express \
  --country=CY \
  --email=testbrand@example.com
```

### 2. Test Payment Flow

1. Create subscription/credit plan with EUR pricing
2. Attempt mobile payment
3. Verify payment goes to brand's account
4. Check webhook processing

### 3. Verify EUR Amounts

- €10.00 should be stored as `1000` (cents)
- €15.50 should be stored as `1550` (cents)
- Mobile app should display proper EUR formatting

## Important Notes

### ✅ This Should Work Now

- Cyprus platform + Cyprus brands = ✅
- EUR currency throughout = ✅
- Automatic confirmation for mobile = ✅

### 🚨 Potential Issues

- **Mixed countries**: If any brand is outside Cyprus, you'll get errors
- **Currency mismatch**: All prices must be in EUR cents
- **Connect onboarding**: Brands must complete Stripe onboarding

## Next Steps

1. **Test immediately** - try a mobile payment
2. **Update pricing** - ensure all plans use EUR amounts
3. **Brand onboarding** - guide brands through Stripe Connect setup
4. **Monitor webhooks** - ensure proper payment processing

## Support

If you still get errors:

1. Check brand's Stripe Connect country (must be Cyprus)
2. Verify all amounts are in EUR cents
3. Ensure Connect account is fully onboarded
4. Test with Stripe test cards first

Your mobile payments should work perfectly now! 🎉
