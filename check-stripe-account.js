const Stripe = require('stripe');
require('dotenv').config();

/**
 * Quick Stripe Account Checker
 * Check any Stripe account ID directly
 */

// Replace with any account ID from your Stripe Dashboard
const ACCOUNT_ID = 'acct_1S7DnSFdkeCYoRMo'; // Your completed account

async function checkStripeAccount(accountId = ACCOUNT_ID) {
  try {
    console.log('🔍 Checking Stripe Account Status...\n');
    
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('❌ STRIPE_SECRET_KEY not found in .env file');
      return;
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });

    console.log('📋 Account ID:', accountId);
    console.log('📡 Fetching from Stripe API...\n');

    const account = await stripe.accounts.retrieve(accountId);

    // Display status
    console.log('📊 Account Status:');
    console.log('├─ Type:', account.type);
    console.log('├─ Country:', account.country);
    console.log('├─ Email:', account.email || 'Not provided');
    console.log('├─ Created:', new Date(account.created * 1000).toLocaleDateString());
    console.log('├─ Details Submitted:', account.details_submitted ? '✅' : '❌');
    console.log('├─ Charges Enabled:', account.charges_enabled ? '✅' : '❌');
    console.log('└─ Payouts Enabled:', account.payouts_enabled ? '✅' : '❌');

    // Onboarding status
    console.log('\n🎯 Onboarding Status:');
    if (account.details_submitted && account.charges_enabled) {
      console.log('✅ FULLY ONBOARDED - Ready to accept payments!');
    } else if (account.details_submitted && !account.charges_enabled) {
      console.log('⏳ UNDER REVIEW - Details submitted, waiting for approval');
    } else {
      console.log('❌ INCOMPLETE - Onboarding not finished');
    }

    // Capabilities
    console.log('\n🔧 Capabilities:');
    if (account.capabilities) {
      Object.entries(account.capabilities).forEach(([capability, status]) => {
        const icon = status === 'active' ? '✅' : status === 'pending' ? '⏳' : '❌';
        console.log(`├─ ${capability}: ${icon} ${status}`);
      });
    }

    // Requirements
    if (account.requirements?.currently_due?.length > 0) {
      console.log('\n⚠️  Outstanding Requirements:');
      account.requirements.currently_due.slice(0, 5).forEach(req => {
        console.log(`├─ ${req}`);
      });
      if (account.requirements.currently_due.length > 5) {
        console.log(`└─ ... and ${account.requirements.currently_due.length - 5} more`);
      }
    } else {
      console.log('\n✅ No outstanding requirements');
    }

    return {
      accountId: account.id,
      ready: account.charges_enabled && account.details_submitted,
      status: account.charges_enabled ? 'ready' : 'incomplete'
    };

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'account_invalid') {
      console.log('💡 This account ID might not exist or belong to your Stripe account');
    }
    return { error: error.message };
  }
}

// Allow command line usage: node check-stripe-account.js acct_123456789
const accountId = process.argv[2] || ACCOUNT_ID;

// Run if called directly
if (require.main === module) {
  checkStripeAccount(accountId);
}

module.exports = { checkStripeAccount };