import request from 'supertest';
import { app } from '../../app';
import { connectTestDB, clearTestDB, closeTestDB } from './setup';
import { Brand } from '../../models/Brand';
import { Class } from '../../models/Class';
import { CreditPlan } from '../../models/CreditPlan';
import JwtUtils from '../../utils/jwt';

describe('Credit Plan Routes', () => {
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

  describe('POST /api/brand/credit-plans', () => {
    const validPlanData = {
      name: '10 Class Package',
      description: '10 credits valid for 90 days',
      price: 15000, // $150.00 in cents
      creditAmount: 10,
      validityPeriod: 90,
      bonusCredits: 2,
      includedClasses: []
    };

    it('should create a credit plan successfully', async () => {
      const response = await request(app)
        .post('/api/brand/credit-plans')
        .set('Authorization', `Bearer ${brandToken}`)
        .send(validPlanData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.creditPlan).toMatchObject({
        name: validPlanData.name,
        description: validPlanData.description,
        price: validPlanData.price,
        creditAmount: validPlanData.creditAmount,
        validityPeriod: validPlanData.validityPeriod,
        bonusCredits: validPlanData.bonusCredits,
        status: 'active'
      });
      expect(response.body.data.creditPlan.brand._id).toBe(brandId);
    });

    it('should create a credit plan with specific classes', async () => {
      const planWithClasses = {
        ...validPlanData,
        name: 'Yoga Only Package',
        includedClasses: [classId]
      };

      const response = await request(app)
        .post('/api/brand/credit-plans')
        .set('Authorization', `Bearer ${brandToken}`)
        .send(planWithClasses)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.creditPlan.includedClasses).toHaveLength(1);
      expect(response.body.data.creditPlan.includedClasses[0]._id).toBe(classId);
    });

    it('should create a credit plan without bonus credits', async () => {
      const planWithoutBonus = {
        ...validPlanData,
        bonusCredits: 0
      };

      const response = await request(app)
        .post('/api/brand/credit-plans')
        .set('Authorization', `Bearer ${brandToken}`)
        .send(planWithoutBonus)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.creditPlan.bonusCredits).toBe(0);
    });

    it('should fail when bonus credits exceed base credits', async () => {
      const invalidPlan = {
        ...validPlanData,
        creditAmount: 5,
        bonusCredits: 10 // More than base credits
      };

      const response = await request(app)
        .post('/api/brand/credit-plans')
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
        .post('/api/brand/credit-plans')
        .set('Authorization', `Bearer ${brandToken}`)
        .send(invalidPlan)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_002');
    });

    it('should fail with duplicate plan name', async () => {
      // Create first plan
      await request(app)
        .post('/api/brand/credit-plans')
        .set('Authorization', `Bearer ${brandToken}`)
        .send(validPlanData)
        .expect(201);

      // Try to create duplicate
      const response = await request(app)
        .post('/api/brand/credit-plans')
        .set('Authorization', `Bearer ${brandToken}`)
        .send(validPlanData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PLAN_001');
    });

    it('should fail with invalid validity period', async () => {
      const invalidPlan = {
        ...validPlanData,
        validityPeriod: 0 // Invalid
      };

      const response = await request(app)
        .post('/api/brand/credit-plans')
        .set('Authorization', `Bearer ${brandToken}`)
        .send(invalidPlan)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_001');
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .post('/api/brand/credit-plans')
        .send(validPlanData)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should fail with client token', async () => {
      const clientToken = JwtUtils.generateAccessToken({ id: 'clientId', type: 'client', email: 'client@test.com' });
      
      const response = await request(app)
        .post('/api/brand/credit-plans')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(validPlanData)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/brand/credit-plans', () => {
    beforeEach(async () => {
      // Create test credit plans
      const plans = [
        {
          name: '10 Class Package',
          brand: brandId,
          price: 15000,
          creditAmount: 10,
          validityPeriod: 90,
          bonusCredits: 2
        },
        {
          name: '5 Class Package',
          brand: brandId,
          price: 8000,
          creditAmount: 5,
          validityPeriod: 60,
          bonusCredits: 0
        },
        {
          name: 'Inactive Package',
          brand: brandId,
          price: 5000,
          creditAmount: 3,
          validityPeriod: 30,
          bonusCredits: 0,
          status: 'inactive'
        }
      ];

      for (const planData of plans) {
        const plan = new CreditPlan(planData);
        await plan.save();
      }
    });

    it('should get all credit plans for the brand', async () => {
      const response = await request(app)
        .get('/api/brand/credit-plans')
        .set('Authorization', `Bearer ${brandToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.creditPlans).toHaveLength(3);
      expect(response.body.data.pagination.total).toBe(3);
    });

    it('should filter by status', async () => {
      const response = await request(app)
        .get('/api/brand/credit-plans?status=active')
        .set('Authorization', `Bearer ${brandToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.creditPlans).toHaveLength(2);
      expect(response.body.data.creditPlans.every((plan: any) => plan.status === 'active')).toBe(true);
    });

    it('should filter by price range', async () => {
      const response = await request(app)
        .get('/api/brand/credit-plans?minPrice=7000&maxPrice=12000')
        .set('Authorization', `Bearer ${brandToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.creditPlans).toHaveLength(1);
      expect(response.body.data.creditPlans[0].name).toBe('5 Class Package');
    });

    it('should filter by credit amount range', async () => {
      const response = await request(app)
        .get('/api/brand/credit-plans?minCredits=5&maxCredits=10')
        .set('Authorization', `Bearer ${brandToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.creditPlans).toHaveLength(2);
    });

    it('should filter by validity period range', async () => {
      const response = await request(app)
        .get('/api/brand/credit-plans?minValidityPeriod=60&maxValidityPeriod=90')
        .set('Authorization', `Bearer ${brandToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.creditPlans).toHaveLength(2);
    });

    it('should search by name', async () => {
      const response = await request(app)
        .get('/api/brand/credit-plans?search=10%20class')
        .set('Authorization', `Bearer ${brandToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.creditPlans).toHaveLength(1);
      expect(response.body.data.creditPlans[0].name).toBe('10 Class Package');
    });

    it('should paginate results', async () => {
      const response = await request(app)
        .get('/api/brand/credit-plans?page=1&limit=2')
        .set('Authorization', `Bearer ${brandToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.creditPlans).toHaveLength(2);
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(2);
      expect(response.body.data.pagination.hasNext).toBe(true);
    });

    it('should sort by different fields', async () => {
      const response = await request(app)
        .get('/api/brand/credit-plans?sortBy=price&sortOrder=asc')
        .set('Authorization', `Bearer ${brandToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.creditPlans[0].price).toBeLessThanOrEqual(response.body.data.creditPlans[1].price);
    });

    it('should not return plans from other brands', async () => {
      // Create plan for other brand
      const otherPlan = new CreditPlan({
        name: 'Other Brand Package',
        brand: otherBrandId,
        price: 12000,
        creditAmount: 8,
        validityPeriod: 120,
        bonusCredits: 1
      });
      await otherPlan.save();

      const response = await request(app)
        .get('/api/brand/credit-plans')
        .set('Authorization', `Bearer ${brandToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.creditPlans).toHaveLength(3);
      expect(response.body.data.creditPlans.every((plan: any) => plan.brand._id === brandId)).toBe(true);
    });
  });

  describe('GET /api/brand/credit-plans/:planId', () => {
    let planId: string;

    beforeEach(async () => {
      const plan = new CreditPlan({
        name: 'Test Package',
        brand: brandId,
        price: 10000,
        creditAmount: 7,
        validityPeriod: 75,
        bonusCredits: 1
      });
      await plan.save();
      planId = plan._id.toString();
    });

    it('should get a specific credit plan', async () => {
      const response = await request(app)
        .get(`/api/brand/credit-plans/${planId}`)
        .set('Authorization', `Bearer ${brandToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.creditPlan._id).toBe(planId);
      expect(response.body.data.creditPlan.name).toBe('Test Package');
    });

    it('should fail with invalid plan ID format', async () => {
      const response = await request(app)
        .get('/api/brand/credit-plans/invalid-id')
        .set('Authorization', `Bearer ${brandToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_001');
    });

    it('should fail when plan does not exist', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';
      const response = await request(app)
        .get(`/api/brand/credit-plans/${nonExistentId}`)
        .set('Authorization', `Bearer ${brandToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PLAN_002');
    });

    it('should fail when accessing other brand\'s plan', async () => {
      const response = await request(app)
        .get(`/api/brand/credit-plans/${planId}`)
        .set('Authorization', `Bearer ${otherBrandToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PLAN_002');
    });
  });

  describe('PUT /api/brand/credit-plans/:planId', () => {
    let planId: string;

    beforeEach(async () => {
      const plan = new CreditPlan({
        name: 'Test Package',
        brand: brandId,
        price: 10000,
        creditAmount: 7,
        validityPeriod: 75,
        bonusCredits: 1
      });
      await plan.save();
      planId = plan._id.toString();
    });

    it('should update a credit plan successfully', async () => {
      const updateData = {
        name: 'Updated Package',
        price: 12000,
        description: 'Updated description',
        creditAmount: 8
      };

      const response = await request(app)
        .put(`/api/brand/credit-plans/${planId}`)
        .set('Authorization', `Bearer ${brandToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.creditPlan.name).toBe('Updated Package');
      expect(response.body.data.creditPlan.price).toBe(12000);
      expect(response.body.data.creditPlan.description).toBe('Updated description');
      expect(response.body.data.creditPlan.creditAmount).toBe(8);
    });

    it('should fail when updating with duplicate name', async () => {
      // Create another plan
      const anotherPlan = new CreditPlan({
        name: 'Another Package',
        brand: brandId,
        price: 5000,
        creditAmount: 3,
        validityPeriod: 30,
        bonusCredits: 0
      });
      await anotherPlan.save();

      const response = await request(app)
        .put(`/api/brand/credit-plans/${planId}`)
        .set('Authorization', `Bearer ${brandToken}`)
        .send({ name: 'Another Package' })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PLAN_001');
    });

    it('should fail when bonus credits exceed base credits', async () => {
      const response = await request(app)
        .put(`/api/brand/credit-plans/${planId}`)
        .set('Authorization', `Bearer ${brandToken}`)
        .send({ 
          creditAmount: 3,
          bonusCredits: 5 // More than base credits
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_001');
    });

    it('should fail when plan does not exist', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';
      const response = await request(app)
        .put(`/api/brand/credit-plans/${nonExistentId}`)
        .set('Authorization', `Bearer ${brandToken}`)
        .send({ name: 'Updated Name' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PLAN_002');
    });
  });

  describe('DELETE /api/brand/credit-plans/:planId', () => {
    let planId: string;

    beforeEach(async () => {
      const plan = new CreditPlan({
        name: 'Test Package',
        brand: brandId,
        price: 10000,
        creditAmount: 7,
        validityPeriod: 75,
        bonusCredits: 1
      });
      await plan.save();
      planId = plan._id.toString();
    });

    it('should deactivate a credit plan successfully', async () => {
      const response = await request(app)
        .delete(`/api/brand/credit-plans/${planId}`)
        .set('Authorization', `Bearer ${brandToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.creditPlan.status).toBe('inactive');
      expect(response.body.message).toBe('Credit plan deactivated successfully');
    });

    it('should fail when plan does not exist', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';
      const response = await request(app)
        .delete(`/api/brand/credit-plans/${nonExistentId}`)
        .set('Authorization', `Bearer ${brandToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PLAN_002');
    });

    it('should fail when accessing other brand\'s plan', async () => {
      const response = await request(app)
        .delete(`/api/brand/credit-plans/${planId}`)
        .set('Authorization', `Bearer ${otherBrandToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PLAN_002');
    });
  });
});