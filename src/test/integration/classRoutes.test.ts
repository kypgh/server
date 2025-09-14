import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import App from '../../app';
import { Brand } from '../../models/Brand';
import { Class } from '../../models/Class';
import { PasswordUtils, JwtUtils, JwtPayload } from '../../utils/auth';

describe('Class Routes Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  let app: any;
  let brandId: string;
  let brandToken: string;
  let otherBrandId: string;
  let otherBrandToken: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Initialize app
    const appInstance = new App();
    app = appInstance.getApp();

    // Create test brands
    const hashedPassword = await PasswordUtils.hashPassword('TestPass123!');
    
    const brand1 = new Brand({
      name: 'Test Fitness Studio',
      email: 'test@studio.com',
      password: hashedPassword,
      address: {
        street: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345'
      }
    });
    await brand1.save();
    brandId = brand1._id.toString();

    const brand2 = new Brand({
      name: 'Other Fitness Studio',
      email: 'other@studio.com',
      password: hashedPassword,
      address: {
        street: '456 Other St',
        city: 'Other City',
        state: 'OS',
        zipCode: '67890'
      }
    });
    await brand2.save();
    otherBrandId = brand2._id.toString();

    // Generate JWT tokens
    const jwtPayload1: JwtPayload = {
      id: brandId,
      type: 'brand',
      email: brand1.email
    };
    brandToken = JwtUtils.generateAccessToken(jwtPayload1);

    const jwtPayload2: JwtPayload = {
      id: otherBrandId,
      type: 'brand',
      email: brand2.email
    };
    otherBrandToken = JwtUtils.generateAccessToken(jwtPayload2);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  afterEach(async () => {
    await Class.deleteMany({});
  });

  describe('POST /api/brand/classes', () => {
    const validClassData = {
      name: 'Yoga Flow',
      description: 'A relaxing yoga flow class for all levels',
      category: 'yoga',
      difficulty: 'beginner',
      slots: 15,
      duration: 60,
      cancellationPolicy: 24,
      timeBlocks: [
        { day: 'monday', startTime: '09:00', endTime: '10:00' },
        { day: 'wednesday', startTime: '18:00', endTime: '19:00' }
      ]
    };

    it('should create a class successfully with valid data', async () => {
      const response = await request(app)
        .post('/api/brand/classes')
        .set('Authorization', `Bearer ${brandToken}`)
        .send(validClassData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.class.name).toBe(validClassData.name);
      expect(response.body.data.class.brand._id).toBe(brandId);
      expect(response.body.data.class.timeBlocks).toHaveLength(2);
      expect(response.body.message).toBe('Class created successfully');
    });

    it('should create a class without time blocks', async () => {
      const classDataWithoutTimeBlocks = {
        ...validClassData,
        timeBlocks: []
      };

      const response = await request(app)
        .post('/api/brand/classes')
        .set('Authorization', `Bearer ${brandToken}`)
        .send(classDataWithoutTimeBlocks)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.class.timeBlocks).toEqual([]);
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .post('/api/brand/classes')
        .send(validClassData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTH_001');
    });

    it('should fail with invalid token', async () => {
      const response = await request(app)
        .post('/api/brand/classes')
        .set('Authorization', 'Bearer invalid-token')
        .send(validClassData)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should fail with missing required fields', async () => {
      const invalidData = {
        name: 'Test Class'
        // Missing required fields
      };

      const response = await request(app)
        .post('/api/brand/classes')
        .set('Authorization', `Bearer ${brandToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_001');
      expect(response.body.error.details).toBeDefined();
    });

    it('should fail with invalid difficulty level', async () => {
      const invalidData = {
        ...validClassData,
        difficulty: 'expert' // Invalid difficulty
      };

      const response = await request(app)
        .post('/api/brand/classes')
        .set('Authorization', `Bearer ${brandToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_001');
    });

    it('should fail with invalid time block format', async () => {
      const invalidData = {
        ...validClassData,
        timeBlocks: [
          { day: 'monday', startTime: '25:00', endTime: '10:00' } // Invalid time
        ]
      };

      const response = await request(app)
        .post('/api/brand/classes')
        .set('Authorization', `Bearer ${brandToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_001');
    });

    it('should fail with duplicate class name for same brand', async () => {
      // Create first class
      await request(app)
        .post('/api/brand/classes')
        .set('Authorization', `Bearer ${brandToken}`)
        .send(validClassData)
        .expect(201);

      // Try to create duplicate
      const response = await request(app)
        .post('/api/brand/classes')
        .set('Authorization', `Bearer ${brandToken}`)
        .send(validClassData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('CLASS_001');
    });

    it('should allow same class name for different brands', async () => {
      // Create class for first brand
      await request(app)
        .post('/api/brand/classes')
        .set('Authorization', `Bearer ${brandToken}`)
        .send(validClassData)
        .expect(201);

      // Create class with same name for second brand
      const response = await request(app)
        .post('/api/brand/classes')
        .set('Authorization', `Bearer ${otherBrandToken}`)
        .send(validClassData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.class.brand._id).toBe(otherBrandId);
    });
  });

  describe('GET /api/brand/classes', () => {
    beforeEach(async () => {
      // Create test classes with valid durations (multiples of 15)
      const classes = [
        {
          name: 'Yoga Flow',
          brand: brandId,
          description: 'Relaxing yoga class',
          category: 'yoga',
          difficulty: 'beginner',
          slots: 15,
          duration: 60
        },
        {
          name: 'HIIT Training',
          brand: brandId,
          description: 'High intensity workout',
          category: 'hiit',
          difficulty: 'advanced',
          slots: 12,
          duration: 45
        },
        {
          name: 'Pilates Core',
          brand: brandId,
          description: 'Core strengthening pilates',
          category: 'pilates',
          difficulty: 'intermediate',
          slots: 10,
          duration: 45,
          status: 'inactive'
        }
      ];

      await Class.insertMany(classes);
    });

    it('should get all classes for authenticated brand', async () => {
      const response = await request(app)
        .get('/api/brand/classes')
        .set('Authorization', `Bearer ${brandToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.classes).toHaveLength(3);
      expect(response.body.data.pagination.totalCount).toBe(3);
      expect(response.body.data.pagination.currentPage).toBe(1);
    });

    it('should filter classes by category', async () => {
      const response = await request(app)
        .get('/api/brand/classes?category=yoga')
        .set('Authorization', `Bearer ${brandToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.classes).toHaveLength(1);
      expect(response.body.data.classes[0].category).toBe('yoga');
    });

    it('should filter classes by difficulty', async () => {
      const response = await request(app)
        .get('/api/brand/classes?difficulty=advanced')
        .set('Authorization', `Bearer ${brandToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.classes).toHaveLength(1);
      expect(response.body.data.classes[0].difficulty).toBe('advanced');
    });

    it('should filter classes by status', async () => {
      const response = await request(app)
        .get('/api/brand/classes?status=active')
        .set('Authorization', `Bearer ${brandToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.classes).toHaveLength(2);
      expect(response.body.data.classes.every((c: any) => c.status === 'active')).toBe(true);
    });

    it('should search classes by name', async () => {
      const response = await request(app)
        .get('/api/brand/classes?search=yoga')
        .set('Authorization', `Bearer ${brandToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.classes).toHaveLength(1);
      expect(response.body.data.classes[0].name).toContain('Yoga');
    });

    it('should paginate results', async () => {
      const response = await request(app)
        .get('/api/brand/classes?page=1&limit=2')
        .set('Authorization', `Bearer ${brandToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.classes).toHaveLength(2);
      expect(response.body.data.pagination.currentPage).toBe(1);
      expect(response.body.data.pagination.totalPages).toBe(2);
      expect(response.body.data.pagination.hasNextPage).toBe(true);
    });

    it('should sort classes by name ascending', async () => {
      const response = await request(app)
        .get('/api/brand/classes?sortBy=name&sortOrder=asc')
        .set('Authorization', `Bearer ${brandToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      const names = response.body.data.classes.map((c: any) => c.name);
      expect(names).toEqual(['HIIT Training', 'Pilates Core', 'Yoga Flow']);
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .get('/api/brand/classes')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should only return classes for authenticated brand', async () => {
      // Create class for other brand
      await new Class({
        name: 'Other Brand Class',
        brand: otherBrandId,
        description: 'Class from other brand',
        category: 'other',
        difficulty: 'beginner',
        slots: 10,
        duration: 30
      }).save();

      const response = await request(app)
        .get('/api/brand/classes')
        .set('Authorization', `Bearer ${brandToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.classes).toHaveLength(3); // Only original brand's classes
      expect(response.body.data.classes.every((c: any) => c.brand._id === brandId)).toBe(true);
    });
  });

  describe('GET /api/brand/classes/:classId', () => {
    let classId: string;
    let otherBrandClassId: string;

    beforeEach(async () => {
      const testClass = await new Class({
        name: 'Test Class',
        brand: brandId,
        description: 'A test class',
        category: 'test',
        difficulty: 'beginner',
        slots: 10,
        duration: 60
      }).save();
      classId = testClass._id.toString();

      const otherClass = await new Class({
        name: 'Other Brand Class',
        brand: otherBrandId,
        description: 'Class from other brand',
        category: 'other',
        difficulty: 'beginner',
        slots: 10,
        duration: 30
      }).save();
      otherBrandClassId = otherClass._id.toString();
    });

    it('should get class by ID successfully', async () => {
      const response = await request(app)
        .get(`/api/brand/classes/${classId}`)
        .set('Authorization', `Bearer ${brandToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.class._id).toBe(classId);
      expect(response.body.data.class.brand._id).toBe(brandId);
    });

    it('should fail with invalid class ID format', async () => {
      const response = await request(app)
        .get('/api/brand/classes/invalid-id')
        .set('Authorization', `Bearer ${brandToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_001');
    });

    it('should fail when accessing other brand\'s class', async () => {
      const response = await request(app)
        .get(`/api/brand/classes/${otherBrandClassId}`)
        .set('Authorization', `Bearer ${brandToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('CLASS_002');
    });

    it('should fail with non-existent class ID', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const response = await request(app)
        .get(`/api/brand/classes/${nonExistentId}`)
        .set('Authorization', `Bearer ${brandToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('CLASS_002');
    });
  });

  describe('PUT /api/brand/classes/:classId', () => {
    let classId: string;
    let otherBrandClassId: string;

    beforeEach(async () => {
      const testClass = await new Class({
        name: 'Test Class',
        brand: brandId,
        description: 'A test class',
        category: 'test',
        difficulty: 'beginner',
        slots: 10,
        duration: 60
      }).save();
      classId = testClass._id.toString();

      const otherClass = await new Class({
        name: 'Other Brand Class',
        brand: otherBrandId,
        description: 'Class from other brand',
        category: 'other',
        difficulty: 'beginner',
        slots: 10,
        duration: 30
      }).save();
      otherBrandClassId = otherClass._id.toString();
    });

    it('should update class successfully', async () => {
      const updateData = {
        name: 'Updated Test Class',
        description: 'Updated description',
        difficulty: 'intermediate'
      };

      const response = await request(app)
        .put(`/api/brand/classes/${classId}`)
        .set('Authorization', `Bearer ${brandToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.class.name).toBe(updateData.name);
      expect(response.body.data.class.description).toBe(updateData.description);
      expect(response.body.data.class.difficulty).toBe(updateData.difficulty);
    });

    it('should fail when updating other brand\'s class', async () => {
      const updateData = { name: 'Hacked Class' };

      const response = await request(app)
        .put(`/api/brand/classes/${otherBrandClassId}`)
        .set('Authorization', `Bearer ${brandToken}`)
        .send(updateData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('CLASS_002');
    });

    it('should fail with duplicate name within same brand', async () => {
      // Create another class
      await new Class({
        name: 'Another Class',
        brand: brandId,
        description: 'Another test class',
        category: 'test',
        difficulty: 'beginner',
        slots: 10,
        duration: 60
      }).save();

      const updateData = { name: 'Another Class' };

      const response = await request(app)
        .put(`/api/brand/classes/${classId}`)
        .set('Authorization', `Bearer ${brandToken}`)
        .send(updateData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('CLASS_001');
    });

    it('should allow updating with same name (no change)', async () => {
      const updateData = { 
        name: 'Test Class', // Same name
        description: 'Updated description'
      };

      const response = await request(app)
        .put(`/api/brand/classes/${classId}`)
        .set('Authorization', `Bearer ${brandToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.class.description).toBe(updateData.description);
    });
  });

  describe('DELETE /api/brand/classes/:classId', () => {
    let classId: string;
    let otherBrandClassId: string;

    beforeEach(async () => {
      const testClass = await new Class({
        name: 'Test Class',
        brand: brandId,
        description: 'A test class',
        category: 'test',
        difficulty: 'beginner',
        slots: 10,
        duration: 60
      }).save();
      classId = testClass._id.toString();

      const otherClass = await new Class({
        name: 'Other Brand Class',
        brand: otherBrandId,
        description: 'Class from other brand',
        category: 'other',
        difficulty: 'beginner',
        slots: 10,
        duration: 30
      }).save();
      otherBrandClassId = otherClass._id.toString();
    });

    it('should soft delete class successfully', async () => {
      const response = await request(app)
        .delete(`/api/brand/classes/${classId}`)
        .set('Authorization', `Bearer ${brandToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.class.status).toBe('inactive');

      // Verify class is soft deleted
      const deletedClass = await Class.findById(classId);
      expect(deletedClass?.status).toBe('inactive');
    });

    it('should fail when deleting other brand\'s class', async () => {
      const response = await request(app)
        .delete(`/api/brand/classes/${otherBrandClassId}`)
        .set('Authorization', `Bearer ${brandToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('CLASS_002');
    });

    it('should fail with non-existent class ID', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const response = await request(app)
        .delete(`/api/brand/classes/${nonExistentId}`)
        .set('Authorization', `Bearer ${brandToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('CLASS_002');
    });
  });

  describe('GET /api/brand/classes/stats', () => {
    beforeEach(async () => {
      const classes = [
        {
          name: 'Yoga Flow',
          brand: brandId,
          description: 'Relaxing yoga class',
          category: 'yoga',
          difficulty: 'beginner',
          slots: 15,
          duration: 60
        },
        {
          name: 'HIIT Training',
          brand: brandId,
          description: 'High intensity workout',
          category: 'hiit',
          difficulty: 'advanced',
          slots: 12,
          duration: 45
        },
        {
          name: 'Pilates Core',
          brand: brandId,
          description: 'Core strengthening pilates',
          category: 'pilates',
          difficulty: 'intermediate',
          slots: 10,
          duration: 45,
          status: 'inactive'
        }
      ];

      await Class.insertMany(classes);
    });

    it('should get class statistics successfully', async () => {
      const response = await request(app)
        .get('/api/brand/classes/stats')
        .set('Authorization', `Bearer ${brandToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.stats.totalClasses).toBe(3);
      expect(response.body.data.stats.activeClasses).toBe(2);
      expect(response.body.data.stats.inactiveClasses).toBe(1);
      expect(response.body.data.stats.uniqueCategories).toBe(3);
      expect(response.body.data.stats.totalSlots).toBe(37);
      expect(response.body.data.stats.averageDuration).toBe(50); // (60+45+45)/3 = 50
      expect(response.body.data.stats.difficultyDistribution.beginner).toBe(1);
      expect(response.body.data.stats.difficultyDistribution.intermediate).toBe(1);
      expect(response.body.data.stats.difficultyDistribution.advanced).toBe(1);
    });

    it('should return zero stats for brand with no classes', async () => {
      const response = await request(app)
        .get('/api/brand/classes/stats')
        .set('Authorization', `Bearer ${otherBrandToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.stats.totalClasses).toBe(0);
      expect(response.body.data.stats.activeClasses).toBe(0);
      expect(response.body.data.stats.inactiveClasses).toBe(0);
      expect(response.body.data.stats.uniqueCategories).toBe(0);
      expect(response.body.data.stats.totalSlots).toBe(0);
      expect(response.body.data.stats.averageDuration).toBe(0);
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .get('/api/brand/classes/stats')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });
});