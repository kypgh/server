import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import App from '../../app';
import { Brand } from '../../models/Brand';
import { Class } from '../../models/Class';
import { Session } from '../../models/Session';
import { PasswordUtils } from '../../utils/auth';

describe('Discovery Routes Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  let app: any;
  let brandId1: string;
  let brandId2: string;
  let classId1: string;
  let classId2: string;
  let classId3: string;
  let sessionId1: string;
  let sessionId2: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Initialize app
    const appInstance = new App();
    app = appInstance.getApp();

    // Create test data
    await setupTestData();
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  const setupTestData = async () => {
    const hashedPassword = await PasswordUtils.hashPassword('TestPass123!');

    // Create test brands
    const brand1 = new Brand({
      name: 'Fitness Studio NYC',
      email: 'nyc@studio.com',
      password: hashedPassword,
      description: 'Premium fitness studio in Manhattan',
      logo: 'https://example.com/logo1.jpg',
      address: {
        street: '123 Broadway',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        country: 'US'
      },
      contact: {
        phone: '+1-555-0123',
        website: 'https://fitnessnyc.com'
      },
      status: 'active'
    });
    await brand1.save();
    brandId1 = brand1._id.toString();

    const brand2 = new Brand({
      name: 'Wellness Center LA',
      email: 'la@wellness.com',
      password: hashedPassword,
      description: 'Holistic wellness center in Los Angeles',
      logo: 'https://example.com/logo2.jpg',
      address: {
        street: '456 Sunset Blvd',
        city: 'Los Angeles',
        state: 'CA',
        zipCode: '90028',
        country: 'US'
      },
      contact: {
        phone: '+1-555-0456',
        website: 'https://wellnessla.com'
      },
      status: 'active'
    });
    await brand2.save();
    brandId2 = brand2._id.toString();

    // Create test classes
    const class1 = new Class({
      name: 'Vinyasa Yoga',
      brand: brandId1,
      description: 'Dynamic flowing yoga practice',
      category: 'yoga',
      difficulty: 'intermediate',
      slots: 20,
      duration: 75,
      cancellationPolicy: 24,
      timeBlocks: [
        { day: 'monday', startTime: '09:00', endTime: '10:15' },
        { day: 'wednesday', startTime: '18:00', endTime: '19:15' }
      ],
      status: 'active'
    });
    await class1.save();
    classId1 = class1._id.toString();

    const class2 = new Class({
      name: 'HIIT Bootcamp',
      brand: brandId1,
      description: 'High-intensity interval training',
      category: 'hiit',
      difficulty: 'advanced',
      slots: 15,
      duration: 45,
      cancellationPolicy: 12,
      timeBlocks: [
        { day: 'tuesday', startTime: '07:00', endTime: '07:45' },
        { day: 'thursday', startTime: '19:00', endTime: '19:45' }
      ],
      status: 'active'
    });
    await class2.save();
    classId2 = class2._id.toString();

    const class3 = new Class({
      name: 'Meditation & Mindfulness',
      brand: brandId2,
      description: 'Guided meditation and mindfulness practice',
      category: 'meditation',
      difficulty: 'beginner',
      slots: 25,
      duration: 30,
      cancellationPolicy: 6,
      timeBlocks: [
        { day: 'sunday', startTime: '10:00', endTime: '10:30' },
        { day: 'friday', startTime: '17:30', endTime: '18:00' }
      ],
      status: 'active'
    });
    await class3.save();
    classId3 = class3._id.toString();

    // Create test sessions
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);

    const dayAfterTomorrow = new Date();
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
    dayAfterTomorrow.setHours(18, 0, 0, 0);

    const session1 = new Session({
      class: classId1,
      dateTime: tomorrow,
      capacity: 20,
      attendees: [
        {
          client: new mongoose.Types.ObjectId(),
          bookingType: 'credits',
          status: 'confirmed',
          joinedAt: new Date()
        }
      ],
      status: 'scheduled'
    });
    await session1.save();
    sessionId1 = session1._id.toString();

    const session2 = new Session({
      class: classId2,
      dateTime: dayAfterTomorrow,
      capacity: 15,
      attendees: [],
      status: 'scheduled'
    });
    await session2.save();
    sessionId2 = session2._id.toString();
  };

  describe('GET /api/client/discovery/brands', () => {
    it('should get all active brands successfully', async () => {
      const response = await request(app)
        .get('/api/client/discovery/brands')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.brands).toHaveLength(2);
      expect(response.body.data.brands[0]).toHaveProperty('name');
      expect(response.body.data.brands[0]).toHaveProperty('address');
      expect(response.body.data.brands[0]).not.toHaveProperty('password');
      expect(response.body.data.brands[0]).not.toHaveProperty('stripeConnectAccountId');
      expect(response.body.data.pagination.totalCount).toBe(2);
      expect(response.body.message).toBe('Brands retrieved successfully');
    });

    it('should filter brands by search term', async () => {
      const response = await request(app)
        .get('/api/client/discovery/brands?search=fitness')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.brands).toHaveLength(1);
      expect(response.body.data.brands[0].name).toContain('Fitness');
    });

    it('should filter brands by city', async () => {
      const response = await request(app)
        .get('/api/client/discovery/brands?city=New York')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.brands).toHaveLength(1);
      expect(response.body.data.brands[0].address.city).toBe('New York');
    });

    it('should filter brands by state', async () => {
      const response = await request(app)
        .get('/api/client/discovery/brands?state=CA')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.brands).toHaveLength(1);
      expect(response.body.data.brands[0].address.state).toBe('CA');
    });

    it('should paginate results correctly', async () => {
      const response = await request(app)
        .get('/api/client/discovery/brands?page=1&limit=1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.brands).toHaveLength(1);
      expect(response.body.data.pagination.currentPage).toBe(1);
      expect(response.body.data.pagination.totalPages).toBe(2);
      expect(response.body.data.pagination.hasNextPage).toBe(true);
      expect(response.body.data.pagination.hasPrevPage).toBe(false);
    });

    it('should sort brands by name ascending', async () => {
      const response = await request(app)
        .get('/api/client/discovery/brands?sortBy=name&sortOrder=asc')
        .expect(200);

      expect(response.body.success).toBe(true);
      const names = response.body.data.brands.map((b: any) => b.name);
      expect(names).toEqual(['Fitness Studio NYC', 'Wellness Center LA']);
    });

    it('should sort brands by name descending', async () => {
      const response = await request(app)
        .get('/api/client/discovery/brands?sortBy=name&sortOrder=desc')
        .expect(200);

      expect(response.body.success).toBe(true);
      const names = response.body.data.brands.map((b: any) => b.name);
      expect(names).toEqual(['Wellness Center LA', 'Fitness Studio NYC']);
    });

    it('should return empty results for non-matching search', async () => {
      const response = await request(app)
        .get('/api/client/discovery/brands?search=nonexistent')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.brands).toHaveLength(0);
      expect(response.body.data.pagination.totalCount).toBe(0);
    });

    it('should validate query parameters', async () => {
      const response = await request(app)
        .get('/api/client/discovery/brands?page=0')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_001');
    });
  });

  describe('GET /api/client/discovery/brands/:brandId', () => {
    it('should get brand details with classes successfully', async () => {
      const response = await request(app)
        .get(`/api/client/discovery/brands/${brandId1}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.brand._id).toBe(brandId1);
      expect(response.body.data.brand.name).toBe('Fitness Studio NYC');
      expect(response.body.data.brand).not.toHaveProperty('password');
      expect(response.body.data.classes).toHaveLength(2);
      expect(response.body.data.stats.totalClasses).toBe(2);
      expect(response.body.data.stats.uniqueCategories).toBe(2);
      expect(response.body.message).toBe('Brand details retrieved successfully');
    });

    it('should fail with invalid brand ID format', async () => {
      const response = await request(app)
        .get('/api/client/discovery/brands/invalid-id')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_001');
    });

    it('should fail with non-existent brand ID', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const response = await request(app)
        .get(`/api/client/discovery/brands/${nonExistentId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('BRAND_001');
    });

    it('should include class statistics in response', async () => {
      const response = await request(app)
        .get(`/api/client/discovery/brands/${brandId1}`)
        .expect(200);

      expect(response.body.data.stats).toHaveProperty('totalClasses');
      expect(response.body.data.stats).toHaveProperty('uniqueCategories');
      expect(response.body.data.stats).toHaveProperty('difficultyDistribution');
      expect(response.body.data.stats.difficultyDistribution).toHaveProperty('beginner');
      expect(response.body.data.stats.difficultyDistribution).toHaveProperty('intermediate');
      expect(response.body.data.stats.difficultyDistribution).toHaveProperty('advanced');
    });
  });

  describe('GET /api/client/discovery/classes', () => {
    it('should get all active classes successfully', async () => {
      const response = await request(app)
        .get('/api/client/discovery/classes')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.classes).toHaveLength(3);
      expect(response.body.data.classes[0]).toHaveProperty('brand');
      expect(response.body.data.classes[0].brand).toHaveProperty('name');
      expect(response.body.data.classes[0].brand).toHaveProperty('city');
      expect(response.body.data.pagination.totalCount).toBe(3);
      expect(response.body.message).toBe('Classes retrieved successfully');
    });

    it('should filter classes by category', async () => {
      const response = await request(app)
        .get('/api/client/discovery/classes?category=yoga')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.classes).toHaveLength(1);
      expect(response.body.data.classes[0].category).toBe('yoga');
    });

    it('should filter classes by difficulty', async () => {
      const response = await request(app)
        .get('/api/client/discovery/classes?difficulty=beginner')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.classes).toHaveLength(1);
      expect(response.body.data.classes[0].difficulty).toBe('beginner');
    });

    it('should filter classes by brand', async () => {
      const response = await request(app)
        .get(`/api/client/discovery/classes?brand=${brandId1}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.classes).toHaveLength(2);
      expect(response.body.data.classes.every((c: any) => c.brand._id === brandId1)).toBe(true);
    });

    it('should filter classes by duration range', async () => {
      const response = await request(app)
        .get('/api/client/discovery/classes?minDuration=30&maxDuration=60')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.classes).toHaveLength(2); // 45min HIIT and 30min Meditation
      expect(response.body.data.classes.every((c: any) => c.duration >= 30 && c.duration <= 60)).toBe(true);
    });

    it('should filter classes by city', async () => {
      const response = await request(app)
        .get('/api/client/discovery/classes?city=New York')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.classes).toHaveLength(2);
      expect(response.body.data.classes.every((c: any) => c.brand.city === 'New York')).toBe(true);
    });

    it('should search classes by name and description', async () => {
      const response = await request(app)
        .get('/api/client/discovery/classes?search=yoga')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.classes).toHaveLength(1);
      expect(response.body.data.classes[0].name).toContain('Yoga');
    });

    it('should sort classes by name', async () => {
      const response = await request(app)
        .get('/api/client/discovery/classes?sortBy=name&sortOrder=asc')
        .expect(200);

      expect(response.body.success).toBe(true);
      const names = response.body.data.classes.map((c: any) => c.name);
      expect(names).toEqual(['HIIT Bootcamp', 'Meditation & Mindfulness', 'Vinyasa Yoga']);
    });

    it('should paginate results correctly', async () => {
      const response = await request(app)
        .get('/api/client/discovery/classes?page=1&limit=2')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.classes).toHaveLength(2);
      expect(response.body.data.pagination.currentPage).toBe(1);
      expect(response.body.data.pagination.totalPages).toBe(2);
      expect(response.body.data.pagination.hasNextPage).toBe(true);
    });

    it('should validate query parameters', async () => {
      const response = await request(app)
        .get('/api/client/discovery/classes?difficulty=expert')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_001');
    });
  });

  describe('GET /api/client/discovery/sessions', () => {
    it('should get all scheduled sessions successfully', async () => {
      const response = await request(app)
        .get('/api/client/discovery/sessions')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sessions).toHaveLength(2);
      expect(response.body.data.sessions[0]).toHaveProperty('class');
      expect(response.body.data.sessions[0]).toHaveProperty('brand');
      expect(response.body.data.sessions[0]).toHaveProperty('availableSpots');
      expect(response.body.data.pagination.totalCount).toBe(2);
      expect(response.body.message).toBe('Sessions retrieved successfully');
    });

    it('should filter sessions by brand', async () => {
      const response = await request(app)
        .get(`/api/client/discovery/sessions?brand=${brandId1}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sessions).toHaveLength(2);
      expect(response.body.data.sessions.every((s: any) => s.brand._id === brandId1)).toBe(true);
    });

    it('should filter sessions by class', async () => {
      const response = await request(app)
        .get(`/api/client/discovery/sessions?class=${classId1}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sessions).toHaveLength(1);
      expect(response.body.data.sessions[0].class._id).toBe(classId1);
    });

    it('should filter sessions by category', async () => {
      const response = await request(app)
        .get('/api/client/discovery/sessions?category=yoga')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sessions).toHaveLength(1);
      expect(response.body.data.sessions[0].class.category).toBe('yoga');
    });

    it('should filter sessions by difficulty', async () => {
      const response = await request(app)
        .get('/api/client/discovery/sessions?difficulty=advanced')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sessions).toHaveLength(1);
      expect(response.body.data.sessions[0].class.difficulty).toBe('advanced');
    });

    it('should filter sessions by date range', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      const response = await request(app)
        .get(`/api/client/discovery/sessions?startDate=${tomorrowStr}&endDate=${tomorrowStr}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sessions).toHaveLength(1);
    });

    it('should filter sessions with available spots only', async () => {
      const response = await request(app)
        .get('/api/client/discovery/sessions?availableOnly=true')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sessions.every((s: any) => s.availableSpots > 0)).toBe(true);
    });

    it('should include sessions with no availability when availableOnly=false', async () => {
      // Create a temporary session at capacity for this test
      const fullSession = new Session({
        class: classId1,
        dateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
        capacity: 2,
        attendees: [
          {
            client: new mongoose.Types.ObjectId(),
            bookingType: 'credits',
            status: 'confirmed',
            joinedAt: new Date()
          },
          {
            client: new mongoose.Types.ObjectId(),
            bookingType: 'credits',
            status: 'confirmed',
            joinedAt: new Date()
          }
        ],
        status: 'scheduled'
      });
      await fullSession.save();

      const response = await request(app)
        .get('/api/client/discovery/sessions?availableOnly=false')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sessions).toHaveLength(3); // Now we have 3 sessions
      expect(response.body.data.sessions.some((s: any) => s.availableSpots === 0)).toBe(true);

      // Clean up the temporary session
      await Session.findByIdAndDelete(fullSession._id);
    });

    it('should search sessions by class name and brand name', async () => {
      const response = await request(app)
        .get('/api/client/discovery/sessions?search=yoga')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sessions).toHaveLength(1);
      expect(response.body.data.sessions[0].class.name).toContain('Yoga');
    });

    it('should sort sessions by dateTime', async () => {
      const response = await request(app)
        .get('/api/client/discovery/sessions?sortBy=dateTime&sortOrder=asc')
        .expect(200);

      expect(response.body.success).toBe(true);
      const dates = response.body.data.sessions.map((s: any) => new Date(s.dateTime));
      // Check that dates are sorted in ascending order
      for (let i = 0; i < dates.length - 1; i++) {
        expect(dates[i].getTime()).toBeLessThanOrEqual(dates[i + 1].getTime());
      }
    });

    it('should paginate results correctly', async () => {
      const response = await request(app)
        .get('/api/client/discovery/sessions?page=1&limit=1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sessions).toHaveLength(1);
      expect(response.body.data.pagination.currentPage).toBe(1);
      expect(response.body.data.pagination.totalCount).toBe(2);
      expect(response.body.data.pagination.totalPages).toBe(2);
      expect(response.body.data.pagination.hasNextPage).toBe(true);
    });

    it('should validate date format', async () => {
      const response = await request(app)
        .get('/api/client/discovery/sessions?startDate=invalid-date')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_001');
    });

    it('should validate end date is after start date', async () => {
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const response = await request(app)
        .get(`/api/client/discovery/sessions?startDate=${today}&endDate=${yesterday}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_001');
    });

    it('should calculate available spots correctly', async () => {
      const response = await request(app)
        .get('/api/client/discovery/sessions')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sessions).toHaveLength(2);
      
      // Check that available spots are calculated correctly
      const sessions = response.body.data.sessions;
      
      // Find the Vinyasa Yoga session (should have 1 attendee, capacity 20)
      const vinyasaSession = sessions.find((s: any) => s.class.name === 'Vinyasa Yoga');
      expect(vinyasaSession).toBeDefined();
      expect(vinyasaSession.capacity).toBe(20);
      expect(vinyasaSession.availableSpots).toBe(19); // 20 - 1 = 19

      // Find the HIIT Bootcamp session (should have no attendees, capacity 15)
      const hiitSession = sessions.find((s: any) => s.class.name === 'HIIT Bootcamp');
      expect(hiitSession).toBeDefined();
      expect(hiitSession.capacity).toBe(15);
      expect(hiitSession.availableSpots).toBe(15); // 15 - 0 = 15
    });
  });
});