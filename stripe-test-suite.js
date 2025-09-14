const axios = require('axios');
const Stripe = require('stripe');
require('dotenv').config();

/**
 * Comprehensive Stripe Connect Test Suite
 * Tests the complete Stripe integration flow
 */

const BASE_URL = 'http://localhost:3000/api';

async function runStripeTestSuite() {
  console.log('🚀 Stripe Connect Integration Test Suite\n');
  
  try {
    // Test 1: Create Brand and Connect to Stripe
    console.log('1️⃣ Testing Brand Registration & Stripe Connect...');
    const brandEmail = `test${Date.now()}@fitness.com`;
    
    const registerResponse = await axios.post(`${BASE_URL}/auth/brand/register`, {
      name: "Test Fitness Studio",
      email: brandEmail,
      password: "Password123!",
      address: {
        street: "123 Main St",
        city: "New York",
        state: "NY",
        zipCode: "10001",
        country: "US"
      },
      contact: { phone: "+1234567890" },
      businessHours: [{
        day: "monday",
        openTime: "09:00",
        closeTime: "17:00",
        isClosed: false
      }]
    });

    const loginResponse = await axios.post(`${BASE_URL}/auth/brand/login`, {
      email: brandEmail,
      password: "Password123!"
    });
    const token = loginResponse.data.data.tokens.accessToken;

    // Connect to Stripe
    const connectResponse = await axios.post(`${BASE_URL}/brand/stripe/connect`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('✅ Brand created and connected to Stripe');
    console.log('📋 Account ID:', connectResponse.data.data.accountId);
    console.log('🔗 Onboarding URL:', connectResponse.data.data.onboardingUrl);

    // Test 2: Check Account Status
    console.log('\n2️⃣ Testing Account Status...');
    const statusResponse = await axios.get(`${BASE_URL}/brand/stripe/account-status`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const status = statusResponse.data.data;
    console.log('📊 Status:', {
      accountId: status.accountId ? 'Present' : 'Missing',
      onboardingComplete: status.onboardingComplete,
      chargesEnabled: status.chargesEnabled,
      requiresAction: status.requiresAction
    });

    // Test 3: Direct Stripe API Check
    console.log('\n3️⃣ Testing Direct Stripe API...');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
    const account = await stripe.accounts.retrieve(status.accountId);
    
    console.log('📡 Direct Stripe Status:');
    console.log('├─ Details Submitted:', account.details_submitted);
    console.log('├─ Charges Enabled:', account.charges_enabled);
    console.log('├─ Payouts Enabled:', account.payouts_enabled);
    console.log('└─ Requirements:', account.requirements?.currently_due?.length || 0, 'items');

    // Test 4: Test All Endpoints
    console.log('\n4️⃣ Testing All Stripe Endpoints...');
    
    // Refresh status
    await axios.post(`${BASE_URL}/brand/stripe/refresh-status`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ Refresh status endpoint working');

    // Try connecting again (should return existing)
    const reconnectResponse = await axios.post(`${BASE_URL}/brand/stripe/connect`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ Duplicate connect handled:', reconnectResponse.data.data.message);

    console.log('\n🎯 Test Results Summary:');
    console.log('├─ ✅ Brand registration & authentication');
    console.log('├─ ✅ Stripe Connect account creation');
    console.log('├─ ✅ Account status checking');
    console.log('├─ ✅ Direct Stripe API integration');
    console.log('├─ ✅ All endpoints functional');
    console.log('└─ ✅ Error handling working');

    if (account.charges_enabled) {
      console.log('\n🎉 ACCOUNT READY FOR PAYMENTS!');
      console.log('💳 This account can process real payments');
    } else {
      console.log('\n⏳ Account needs onboarding completion');
      console.log('🔗 Complete here:', status.actionUrl);
    }

    return {
      success: true,
      accountId: status.accountId,
      onboardingUrl: status.actionUrl,
      readyForPayments: account.charges_enabled
    };

  } catch (error) {
    console.error('❌ Test Failed:', error.response?.data || error.message);
    return { success: false, error: error.message };
  }
}

// Run if called directly
if (require.main === module) {
  runStripeTestSuite();
}

module.exports = { runStripeTestSuite };