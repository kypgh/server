import request from 'supertest';
import { app } from '../../app';
import { connectTestDB, clearTestDB, closeTestDB } from './setup';
import { Brand } from '../../models/Brand';
import { Class } from '../../models/Class';
import { SubscriptionPlan } from '../../models/SubscriptionPlan';
import JwtUtils from '../../utils/jwt';

describe('Subscription Plan Routes', () => {
  let brandToken: string;
  let brandId: string;
  let otherBrandToken: string;
  let otherBrandId: string;
  let classId: string;
  let otherClassId: string;

  beforeAll(async () => {
    await connectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();

    // Create test brand
    const brand = new Brand({
      name: 'Test Fitness Studio',
      email: 'test@studio.com',
      password: 'hashedPassword123',
      address: {
        street: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        country: 'Test Country'
      },
      contact: {
        phone: '+1234567890',
        email: 'contact@studio.com'
      },
      businessHours: [{
        day: 'monday',
        openTime: '06:00',
        closeTime: '22:00',
        isClosed: false
      }]
    });
    await brand.save();
    brandId = brand._id.toString();
    brandToken = JwtUtils.generateAccessToken({ id: brandId, type: 'brand', email: 'test@studio.com' });

    // Create another test brand
    const otherBrand = new Brand({
      name: 'Other Fitness Studio',
      email: 'other@studio.com',
      password: 'hashedPassword123',
      address: {
        street: '456 Other St',
        city: 'Other City',
        state: 'OS',
        zipCode: '67890',
        country: 'Other Country'
      },
      contact: {
        phone: '+0987654321',
        email: 'contact@otherstudio.com'
      },
      businessHours: [{
        day: 'monday',
        openTime: '06:00',
        closeTime: '22:00',
        isClosed: false
      }]
    });
    await otherBrand.save();
    otherBrandId = otherBrand._id.toString();
    otherBrandToken = JwtUtils.generateAccessToken({ id: otherBrandId, type: 'brand', email: 'other@studio.com' });

    // Create test class for the brand
    const testClass = new Class({
      name: 'Test Yoga Class',
      brand: brandId,
      description: 'A relaxing yoga class for all levels',
      category: 'yoga',
      difficulty: 'beginner',
      slots: 20,
      duration: 60,
      cancellationPolicy: 24,
      timeBlocks: [{
        day: 'monday',
        startTime: '09:00',
        endTime: '10:00'
      }]
    });
    await testClass.save();
    classId = testClass._id.toString();

    // Create test class for other brand
    const otherClass = new Class({
      name: 'Other Pilates Class',
      brand: otherBrandId,
      description: 'A challenging pilates class',
      category: 'pilates',
      difficulty: 'intermediate',
      slots: 15,
      duration: 45,
      cancellationPolicy: 12,
      timeBlocks: [{
        day: 'tuesday',
        startTime: '10:00',
        endTime: '10:45'
      }]
    });
    await otherClass.save();
    otherClassId = otherClass._id.toString();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  describe('POST /api/brand/subscription-plans', () => {
    const validPlanData = {
      name: 'Monthly Unlimited',
      description: 'Unlimited access to all classes for one month',
      price: 9999, // $99.99 in cents
      billingCycle: 'monthly',
      includedClasses: [],
      frequencyLimit: {
        count: 0, // unlimited
        period: 'month',
        resetDay: 1
      }
    };

    it('should create a subscription plan successfully', async () => {
      const response = await request(app)
        .post('/api/brand/subscription-plans')
        .set('Authorization', `Bearer ${brandToken}`)
        .send(validPlanData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.subscriptionPlan).toMatchObject({
        name: validPlanData.name,
        description: validPlanData.description,
        price: validPlanData.price,
        billingCycle: validPlanData.billingCycle,
        status: 'active'
      });
      expect(response.body.data.subscriptionPlan.brand._id).toBe(brandId);
    });

    it('should create a subscription plan with specific classes', async () => {
      const planWithClasses = {
        ...validPlanData,
        name: 'Yoga Only Plan',
        includedClasses: [classId]
      };

      const response = await request(app)
        .post('/api/brand/subscription-plans')
        .set('Authorization', `Bearer ${brandToken}`)
        .send(planWithClasses)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.subscriptionPlan.includedClasses).toHaveLength(1);
      expect(response.body.data.subscriptionPlan.includedClasses[0]._id).toBe(classId);
    });

    it('should fail with invalid frequency limit', async () => {
      const invalidPlan = {
        ...validPlanData,
        frequencyLimit: {
          count: 5,
          period: 'week',
          resetDay: 8 // Invalid for weekly period
        }
      };

      const response = await request(app)
        .post('/api/brand/subscription-plans')
        .set('Authorization', `Bearer ${brandToken}`)
        .send(invalidPlan)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_001');
    });

    it('should fail when including classes from other brands', async () => {
      const invalidPlan = {
        ...validPlanData,
        includedClasses: [otherClassId]
      };

      const response = await request(app)
        .post('/api/brand/subscription-plans')
        .set('Authorization', `Bearer ${brandToken}`)
        .send(invalidPlan)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_002');
    });

    it('should fail with duplicate plan name', async () => {
      // Create first plan
      await request(app)
        .post('/api/brand/subscription-plans')
        .set('Authorization', `Bearer ${brandToken}`)
        .send(validPlanData)
        .expect(201);

      // Try to create duplicate
      const response = await request(app)
        .post('/api/brand/subscription-plans')
        .set('Authorization', `Bearer ${brandToken}`)
        .send(validPlanData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PLAN_001');
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .post('/api/brand/subscription-plans')
        .send(validPlanData)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should fail with client token', async () => {
      const clientToken = JwtUtils.generateAccessToken({ id: 'clientId', type: 'client', email: 'client@test.com' });
      
      const response = await request(app)
        .post('/api/brand/subscription-plans')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(validPlanData)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/brand/subscription-plans', () => {
    beforeEach(async () => {
      // Create test subscription plans
      const plans = [
        {
          name: 'Monthly Unlimited',
          brand: brandId,
          price: 9999,
          billingCycle: 'monthly',
          frequencyLimit: { count: 0, period: 'month', resetDay: 1 }
        },
        {
          name: 'Weekly 5 Classes',
          brand: brandId,
          price: 4999,
          billingCycle: 'monthly',
          frequencyLimit: { count: 5, period: 'week', resetDay: 1 }
        },
        {
          name: 'Inactive Plan',
          brand: brandId,
          price: 2999,
          billingCycle: 'monthly',
          status: 'inactive',
          frequencyLimit: { count: 3, period: 'week', resetDay: 1 }
        }
      ];

      for (const planData of plans) {
        const plan = new SubscriptionPlan(planData);
        await plan.save();
      }
    });

    it('should get all subscription plans for the brand', async () => {
      const response = await request(app)
        .get('/api/brand/subscription-plans')
        .set('Authorization', `Bearer ${brandToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.subscriptionPlans).toHaveLength(3);
      expect(response.body.data.pagination.total).toBe(3);
    });

    it('should filter by status', async () => {
      const response = await request(app)
        .get('/api/brand/subscription-plans?status=active')
        .set('Authorization', `Bearer ${brandToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.subscriptionPlans).toHaveLength(2);
      expect(response.body.data.subscriptionPlans.every((plan: any) => plan.status === 'active')).toBe(true);
    });

    it('should filter by price range', async () => {
      const response = await request(app)
        .get('/api/brand/subscription-plans?minPrice=3000&maxPrice=5000')
        .set('Authorization', `Bearer ${brandToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.subscriptionPlans).toHaveLength(1);
      expect(response.body.data.subscriptionPlans[0].name).toBe('Weekly 5 Classes');
    });

    it('should search by name', async () => {
      const response = await request(app)
        .get('/api/brand/subscription-plans?search=unlimited')
        .set('Authorization', `Bearer ${brandToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.subscriptionPlans).toHaveLength(1);
      expect(response.body.data.subscriptionPlans[0].name).toBe('Monthly Unlimited');
    });

    it('should paginate results', async () => {
      const response = await request(app)
        .get('/api/brand/subscription-plans?page=1&limit=2')
        .set('Authorization', `Bearer ${brandToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.subscriptionPlans).toHaveLength(2);
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(2);
      expect(response.body.data.pagination.hasNext).toBe(true);
    });

    it('should not return plans from other brands', async () => {
      // Create plan for other brand
      const otherPlan = new SubscriptionPlan({
        name: 'Other Brand Plan',
        brand: otherBrandId,
        price: 7999,
        billingCycle: 'monthly',
        frequencyLimit: { count: 10, period: 'month', resetDay: 1 }
      });
      await otherPlan.save();

      const response = await request(app)
        .get('/api/brand/subscription-plans')
        .set('Authorization', `Bearer ${brandToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.subscriptionPlans).toHaveLength(3);
      expect(response.body.data.subscriptionPlans.every((plan: any) => plan.brand._id === brandId)).toBe(true);
    });
  });

  describe('GET /api/brand/subscription-plans/:planId', () => {
    let planId: string;

    beforeEach(async () => {
      const plan = new SubscriptionPlan({
        name: 'Test Plan',
        brand: brandId,
        price: 5999,
        billingCycle: 'monthly',
        frequencyLimit: { count: 8, period: 'month', resetDay: 1 }
      });
      await plan.save();
      planId = plan._id.toString();
    });

    it('should get a specific subscription plan', async () => {
      const response = await request(app)
        .get(`/api/brand/subscription-plans/${planId}`)
        .set('Authorization', `Bearer ${brandToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.subscriptionPlan._id).toBe(planId);
      expect(response.body.data.subscriptionPlan.name).toBe('Test Plan');
    });

    it('should fail with invalid plan ID format', async () => {
      const response = await request(app)
        .get('/api/brand/subscription-plans/invalid-id')
        .set('Authorization', `Bearer ${brandToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_001');
    });

    it('should fail when plan does not exist', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';
      const response = await request(app)
        .get(`/api/brand/subscription-plans/${nonExistentId}`)
        .set('Authorization', `Bearer ${brandToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PLAN_002');
    });

    it('should fail when accessing other brand\'s plan', async () => {
      const response = await request(app)
        .get(`/api/brand/subscription-plans/${planId}`)
        .set('Authorization', `Bearer ${otherBrandToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PLAN_002');
    });
  });

  describe('PUT /api/brand/subscription-plans/:planId', () => {
    let planId: string;

    beforeEach(async () => {
      const plan = new SubscriptionPlan({
        name: 'Test Plan',
        brand: brandId,
        price: 5999,
        billingCycle: 'monthly',
        frequencyLimit: { count: 8, period: 'month', resetDay: 1 }
      });
      await plan.save();
      planId = plan._id.toString();
    });

    it('should update a subscription plan successfully', async () => {
      const updateData = {
        name: 'Updated Plan',
        price: 7999,
        description: 'Updated description'
      };

      const response = await request(app)
        .put(`/api/brand/subscription-plans/${planId}`)
        .set('Authorization', `Bearer ${brandToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.subscriptionPlan.name).toBe('Updated Plan');
      expect(response.body.data.subscriptionPlan.price).toBe(7999);
      expect(response.body.data.subscriptionPlan.description).toBe('Updated description');
    });

    it('should fail when updating with duplicate name', async () => {
      // Create another plan
      const anotherPlan = new SubscriptionPlan({
        name: 'Another Plan',
        brand: brandId,
        price: 3999,
        billingCycle: 'monthly',
        frequencyLimit: { count: 5, period: 'week', resetDay: 1 }
      });
      await anotherPlan.save();

      const response = await request(app)
        .put(`/api/brand/subscription-plans/${planId}`)
        .set('Authorization', `Bearer ${brandToken}`)
        .send({ name: 'Another Plan' })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PLAN_001');
    });

    it('should fail when plan does not exist', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';
      const response = await request(app)
        .put(`/api/brand/subscription-plans/${nonExistentId}`)
        .set('Authorization', `Bearer ${brandToken}`)
        .send({ name: 'Updated Name' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PLAN_002');
    });
  });

  describe('DELETE /api/brand/subscription-plans/:planId', () => {
    let planId: string;

    beforeEach(async () => {
      const plan = new SubscriptionPlan({
        name: 'Test Plan',
        brand: brandId,
        price: 5999,
        billingCycle: 'monthly',
        frequencyLimit: { count: 8, period: 'month', resetDay: 1 }
      });
      await plan.save();
      planId = plan._id.toString();
    });

    it('should deactivate a subscription plan successfully', async () => {
      const response = await request(app)
        .delete(`/api/brand/subscription-plans/${planId}`)
        .set('Authorization', `Bearer ${brandToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.subscriptionPlan.status).toBe('inactive');
      expect(response.body.message).toBe('Subscription plan deactivated successfully');
    });

    it('should fail when plan does not exist', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';
      const response = await request(app)
        .delete(`/api/brand/subscription-plans/${nonExistentId}`)
        .set('Authorization', `Bearer ${brandToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PLAN_002');
    });
  });
});