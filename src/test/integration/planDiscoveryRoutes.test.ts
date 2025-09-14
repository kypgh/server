import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { app } from '../../app';
import { Brand } from '../../models/Brand';
import { SubscriptionPlan } from '../../models/SubscriptionPlan';
import { CreditPlan } from '../../models/CreditPlan';
import PasswordUtils from '../../utils/password';

describe('Plan Discovery Routes Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  let testBrand: any;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Promise.all([
      Brand.deleteMany({}),
      SubscriptionPlan.deleteMany({}),
      CreditPlan.deleteMany({})
    ]);

    testBrand = await Brand.create({
      name: 'Test Fitness Studio',
      email: 'brand@test.com',
      password: await PasswordUtils.hashPassword('password123'),
      address: {
        street: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        country: 'US'
      },
      contact: { phone: '+1234567890' },
      businessHours: [],
      status: 'active'
    });

    await SubscriptionPlan.create({
      brand: testBrand._id,
      name: 'Monthly Unlimited',
      description: 'Unlimited access',
      price: 9999,
      billingCycle: 'monthly',
      includedClasses: [],
      frequencyLimit: { count: 0, period: 'month', resetDay: 1 },
      status: 'active'
    });

    await CreditPlan.create({
      brand: testBrand._id,
      name: '10 Class Pack',
      description: '10 classes',
      price: 15000,
      creditAmount: 10,
      validityPeriod: 90,
      bonusCredits: 2,
      includedClasses: [],
      status: 'active'
    });
  });

  describe('GET /api/client/discovery/brands/:brandId/subscription-plans', () => {
    it('should return subscription plans for a valid brand', async () => {
      const response = await request(app)
        .get(`/api/client/discovery/brands/${testBrand._id}/subscription-plans`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.subscriptionPlans).toHaveLength(1);
      expect(response.body.data.subscriptionPlans[0].name).toBe('Monthly Unlimited');
    });

    it('should return 404 for non-existent brand', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/client/discovery/brands/${nonExistentId}/subscription-plans`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/client/discovery/brands/:brandId/credit-plans', () => {
    it('should return credit plans for a valid brand', async () => {
      const response = await request(app)
        .get(`/api/client/discovery/brands/${testBrand._id}/credit-plans`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.creditPlans).toHaveLength(1);
      expect(response.body.data.creditPlans[0].name).toBe('10 Class Pack');
    });

    it('should return 404 for non-existent brand', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/client/discovery/brands/${nonExistentId}/credit-plans`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });
});