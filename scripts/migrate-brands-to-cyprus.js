/**
 * Migration script to recreate Stripe Connect accounts for Cyprus
 * Run this to fix existing brands that were created with US configuration
 */

const mongoose = require('mongoose');
const Stripe = require('stripe');
require('dotenv').config();

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

// Brand model (simplified for migration)
const brandSchema = new mongoose.Schema({
  name: String,
  email: String,
  stripeConnectAccountId: String,
  stripeOnboardingComplete: Boolean,
});

const Brand = mongoose.model('Brand', brandSchema);

async function migrateBrandsToCyprus() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find all brands with existing Stripe accounts
    const brands = await Brand.find({
      stripeConnectAccountId: { $exists: true, $ne: null }
    });

    console.log(`Found ${brands.length} brands with Stripe accounts to migrate`);

    for (const brand of brands) {
      try {
        console.log(`\nMigrating brand: ${brand.name} (${brand.email})`);
        
        // Get current account info
        const oldAccount = await stripe.accounts.retrieve(brand.stripeConnectAccountId);
        console.log(`  Current account country: ${oldAccount.country}`);
        
        if (oldAccount.country === 'CY') {
          console.log(`  ✅ Already Cyprus - skipping`);
          continue;
        }

        // Create new Cyprus account
        const newAccount = await stripe.accounts.create({
          type: 'express',
          country: 'CY', // Cyprus
          email: brand.email,
          business_type: 'company',
          company: {
            name: brand.name,
          },
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
          settings: {
            payouts: {
              schedule: {
                interval: 'daily',
              },
            },
          },
        });

        // Update brand with new account ID
        await Brand.findByIdAndUpdate(brand._id, {
          stripeConnectAccountId: newAccount.id,
          stripeOnboardingComplete: false, // They'll need to re-onboard
        });

        console.log(`  ✅ Created new Cyprus account: ${newAccount.id}`);
        console.log(`  ⚠️  Brand will need to complete onboarding again`);

        // Optional: Delete old US account (commented out for safety)
        // await stripe.accounts.del(oldAccount.id);
        // console.log(`  🗑️  Deleted old US account: ${oldAccount.id}`);

      } catch (error) {
        console.error(`  ❌ Error migrating brand ${brand.name}:`, error.message);
      }
    }

    console.log('\n✅ Migration completed!');
    console.log('\n📋 Next steps:');
    console.log('1. Ask brands to complete Stripe onboarding again');
    console.log('2. Test payments with the new Cyprus accounts');
    console.log('3. Optionally delete old US accounts from Stripe dashboard');

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
  }
}

// Run migration
if (require.main === module) {
  migrateBrandsToCyprus();
}

module.exports = { migrateBrandsToCyprus };