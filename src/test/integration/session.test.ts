import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import App from '../../app';
import { Brand } from '../../models/Brand';
import { Class } from '../../models/Class';
import { Session } from '../../models/Session';
import JwtUtils from '../../utils/jwt';

describe('Session API Endpoints', () => {
  let mongoServer: MongoMemoryServer;
  let testBrand: any;
  let testClass: any;
  let authToken: string;
  let app: any;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
    
    // Initialize app
    const appInstance = new App();
    app = appInstance.getApp();
  });

  afterAll(async () => {
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear database
    await Brand.deleteMany({});
    await Class.deleteMany({});
    await Session.deleteMany({});

    // Create test brand
    testBrand = await Brand.create({
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
        website: 'https://teststudio.com'
      },
      businessHours: [{
        day: 'monday',
        openTime: '06:00',
        closeTime: '22:00',
        isClosed: false
      }]
    });

    // Create test class
    testClass = await Class.create({
      name: 'Test Yoga Class',
      brand: testBrand._id,
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
      }],
      status: 'active'
    });

    // Generate auth token
    authToken = JwtUtils.generateAccessToken({
      id: testBrand._id.toString(),
      type: 'brand',
      email: testBrand.email
    });
  });

  afterEach(async () => {
    await Brand.deleteMany({});
    await Class.deleteMany({});
    await Session.deleteMany({});
  });

  describe('POST /api/brand/sessions', () => {
    it('should create a new session successfully', async () => {
      const sessionData = {
        class: testClass._id.toString(),
        dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        capacity: 15
      };

      const response = await request(app)
        .post('/api/brand/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(sessionData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.session).toBeDefined();
      expect(response.body.data.session.class._id).toBe(testClass._id.toString());
      expect(response.body.data.session.capacity).toBe(15);
      expect(response.body.data.session.status).toBe('scheduled');
    });

    it('should use class capacity when session capacity not provided', async () => {
      const sessionData = {
        class: testClass._id.toString(),
        dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };

      const response = await request(app)
        .post('/api/brand/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(sessionData)
        .expect(201);

      expect(response.body.data.session.capacity).toBe(testClass.slots);
    });

    it('should reject session with capacity exceeding class slots', async () => {
      const sessionData = {
        class: testClass._id.toString(),
        dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        capacity: 25 // Exceeds class slots (20)
      };

      const response = await request(app)
        .post('/api/brand/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(sessionData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('SESSION_001');
    });

    it('should reject session for non-existent class', async () => {
      const sessionData = {
        class: new mongoose.Types.ObjectId().toString(),
        dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        capacity: 15
      };

      const response = await request(app)
        .post('/api/brand/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(sessionData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('CLASS_002');
    });

    it('should reject duplicate session at same time', async () => {
      const sessionData = {
        class: testClass._id.toString(),
        dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        capacity: 15
      };

      // Create first session
      await request(app)
        .post('/api/brand/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(sessionData)
        .expect(201);

      // Try to create duplicate
      const response = await request(app)
        .post('/api/brand/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(sessionData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('SESSION_002');
    });

    it('should reject session with past date', async () => {
      const sessionData = {
        class: testClass._id.toString(),
        dateTime: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        capacity: 15
      };

      const response = await request(app)
        .post('/api/brand/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(sessionData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_001');
    });

    it('should require authentication', async () => {
      const sessionData = {
        class: testClass._id.toString(),
        dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        capacity: 15
      };

      await request(app)
        .post('/api/brand/sessions')
        .send(sessionData)
        .expect(401);
    });
  });

  describe('GET /api/brand/sessions', () => {
    beforeEach(async () => {
      // Create test sessions
      await Session.create([
        {
          class: testClass._id,
          dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
          capacity: 10,
          status: 'scheduled'
        },
        {
          class: testClass._id,
          dateTime: new Date(Date.now() + 48 * 60 * 60 * 1000),
          capacity: 15,
          status: 'scheduled'
        },
        {
          class: testClass._id,
          dateTime: new Date(Date.now() + 72 * 60 * 60 * 1000),
          capacity: 20,
          status: 'completed'
        }
      ]);
    });

    it('should get all sessions for brand', async () => {
      const response = await request(app)
        .get('/api/brand/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sessions).toHaveLength(3);
      expect(response.body.data.pagination).toBeDefined();
    });

    it('should filter sessions by status', async () => {
      const response = await request(app)
        .get('/api/brand/sessions?status=scheduled')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.sessions).toHaveLength(2);
      response.body.data.sessions.forEach((session: any) => {
        expect(session.status).toBe('scheduled');
      });
    });

    it('should filter sessions by class', async () => {
      const response = await request(app)
        .get(`/api/brand/sessions?class=${testClass._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.sessions).toHaveLength(3);
      response.body.data.sessions.forEach((session: any) => {
        expect(session.class._id).toBe(testClass._id.toString());
      });
    });

    it('should filter sessions by date range', async () => {
      const startDate = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
      const endDate = new Date(Date.now() + 60 * 60 * 60 * 1000).toISOString();

      const response = await request(app)
        .get(`/api/brand/sessions?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.sessions).toHaveLength(2);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/brand/sessions?page=1&limit=2')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.sessions).toHaveLength(2);
      expect(response.body.data.pagination.currentPage).toBe(1);
      expect(response.body.data.pagination.totalCount).toBe(3);
      expect(response.body.data.pagination.hasNextPage).toBe(true);
    });

    it('should sort sessions by dateTime ascending by default', async () => {
      const response = await request(app)
        .get('/api/brand/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const sessions = response.body.data.sessions;
      for (let i = 1; i < sessions.length; i++) {
        expect(new Date(sessions[i].dateTime).getTime())
          .toBeGreaterThanOrEqual(new Date(sessions[i-1].dateTime).getTime());
      }
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/brand/sessions')
        .expect(401);
    });
  });

  describe('GET /api/brand/sessions/:sessionId', () => {
    let testSession: any;

    beforeEach(async () => {
      testSession = await Session.create({
        class: testClass._id,
        dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        capacity: 10,
        status: 'scheduled'
      });
    });

    it('should get session by ID', async () => {
      const response = await request(app)
        .get(`/api/brand/sessions/${testSession._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.session._id).toBe(testSession._id.toString());
      expect(response.body.data.session.class).toBeDefined();
    });

    it('should reject invalid session ID format', async () => {
      const response = await request(app)
        .get('/api/brand/sessions/invalid-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_001');
    });

    it('should reject non-existent session', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .get(`/api/brand/sessions/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error.code).toBe('SESSION_004');
    });

    it('should require authentication', async () => {
      await request(app)
        .get(`/api/brand/sessions/${testSession._id}`)
        .expect(401);
    });
  });

  describe('PUT /api/brand/sessions/:sessionId', () => {
    let testSession: any;

    beforeEach(async () => {
      testSession = await Session.create({
        class: testClass._id,
        dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        capacity: 10,
        status: 'scheduled'
      });
    });

    it('should update session successfully', async () => {
      const updateData = {
        capacity: 15,
        status: 'in-progress'
      };

      const response = await request(app)
        .put(`/api/brand/sessions/${testSession._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.session.capacity).toBe(15);
      expect(response.body.data.session.status).toBe('in-progress');
    });

    it('should reject capacity exceeding class slots', async () => {
      const updateData = {
        capacity: 25 // Exceeds class slots (20)
      };

      const response = await request(app)
        .put(`/api/brand/sessions/${testSession._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body.error.code).toBe('SESSION_001');
    });

    it('should reject capacity below current attendees', async () => {
      // Add attendees to session
      testSession.attendees = [
        {
          client: new mongoose.Types.ObjectId(),
          bookingType: 'credits',
          status: 'confirmed',
          joinedAt: new Date()
        },
        {
          client: new mongoose.Types.ObjectId(),
          bookingType: 'subscription',
          status: 'confirmed',
          joinedAt: new Date()
        }
      ];
      await testSession.save();

      const updateData = {
        capacity: 1 // Below current attendees (2)
      };

      const response = await request(app)
        .put(`/api/brand/sessions/${testSession._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body.error.code).toBe('SESSION_005');
    });

    it('should reject conflicting dateTime', async () => {
      // Create another session at a specific time
      const conflictTime = new Date(Date.now() + 48 * 60 * 60 * 1000);
      await Session.create({
        class: testClass._id,
        dateTime: conflictTime,
        capacity: 10,
        status: 'scheduled'
      });

      const updateData = {
        dateTime: conflictTime.toISOString()
      };

      const response = await request(app)
        .put(`/api/brand/sessions/${testSession._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(409);

      expect(response.body.error.code).toBe('SESSION_002');
    });

    it('should require authentication', async () => {
      await request(app)
        .put(`/api/brand/sessions/${testSession._id}`)
        .send({ capacity: 15 })
        .expect(401);
    });
  });

  describe('DELETE /api/brand/sessions/:sessionId', () => {
    let testSession: any;

    beforeEach(async () => {
      testSession = await Session.create({
        class: testClass._id,
        dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        capacity: 10,
        status: 'scheduled'
      });
    });

    it('should cancel session successfully', async () => {
      const response = await request(app)
        .delete(`/api/brand/sessions/${testSession._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.session.status).toBe('cancelled');
    });

    it('should reject cancelling past session', async () => {
      // Update session to past date
      testSession.dateTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
      await testSession.save();

      const response = await request(app)
        .delete(`/api/brand/sessions/${testSession._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.error.code).toBe('SESSION_006');
    });

    it('should reject cancelling non-scheduled session', async () => {
      testSession.status = 'completed';
      await testSession.save();

      const response = await request(app)
        .delete(`/api/brand/sessions/${testSession._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.error.code).toBe('SESSION_006');
    });

    it('should require authentication', async () => {
      await request(app)
        .delete(`/api/brand/sessions/${testSession._id}`)
        .expect(401);
    });
  });

  describe('POST /api/brand/sessions/bulk', () => {
    it('should create bulk sessions successfully', async () => {
      const bulkData = {
        class: testClass._id.toString(),
        startDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 2 weeks
        capacity: 15
      };

      const response = await request(app)
        .post('/api/brand/sessions/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send(bulkData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sessions).toBeDefined();
      expect(response.body.data.count).toBeGreaterThan(0);
      expect(response.body.data.sessions[0].capacity).toBe(15);
    });

    it('should exclude specified dates', async () => {
      const excludeDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 1 week from now
      
      const bulkData = {
        class: testClass._id.toString(),
        startDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        capacity: 15,
        excludeDates: [excludeDate.toISOString()]
      };

      const response = await request(app)
        .post('/api/brand/sessions/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send(bulkData)
        .expect(201);

      expect(response.body.success).toBe(true);
      
      // Verify excluded date is not in created sessions
      const createdSessions = response.body.data.sessions;
      const excludeDateString = excludeDate.toISOString().split('T')[0];
      
      const hasExcludedDate = createdSessions.some((session: any) => 
        session.dateTime.startsWith(excludeDateString)
      );
      
      expect(hasExcludedDate).toBe(false);
    });

    it('should reject bulk creation with invalid date range', async () => {
      const bulkData = {
        class: testClass._id.toString(),
        startDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // End before start
        capacity: 15
      };

      const response = await request(app)
        .post('/api/brand/sessions/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send(bulkData)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_001');
    });

    it('should require authentication', async () => {
      const bulkData = {
        class: testClass._id.toString(),
        startDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        capacity: 15
      };

      await request(app)
        .post('/api/brand/sessions/bulk')
        .send(bulkData)
        .expect(401);
    });
  });

  describe('GET /api/brand/sessions/stats', () => {
    beforeEach(async () => {
      // Create test sessions with different statuses
      // Note: We need to create completed sessions differently since they can't have past dates
      const sessions = [
        {
          class: testClass._id,
          dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
          capacity: 10,
          status: 'scheduled',
          attendees: [{
            client: new mongoose.Types.ObjectId(),
            bookingType: 'credits',
            status: 'confirmed',
            joinedAt: new Date()
          }]
        },
        {
          class: testClass._id,
          dateTime: new Date(Date.now() + 48 * 60 * 60 * 1000),
          capacity: 15,
          status: 'scheduled',
          attendees: []
        },
        {
          class: testClass._id,
          dateTime: new Date(Date.now() + 72 * 60 * 60 * 1000),
          capacity: 12,
          status: 'cancelled',
          attendees: []
        }
      ];

      await Session.create(sessions);

      // Create a completed session by first creating it with future date, then updating
      const completedSession = await Session.create({
        class: testClass._id,
        dateTime: new Date(Date.now() + 96 * 60 * 60 * 1000),
        capacity: 20,
        status: 'scheduled',
        attendees: Array(15).fill(null).map(() => ({
          client: new mongoose.Types.ObjectId(),
          bookingType: 'credits',
          status: 'attended',
          joinedAt: new Date()
        }))
      });

      // Update to completed status (bypassing validation)
      await Session.findByIdAndUpdate(completedSession._id, { status: 'completed' });
    });

    it('should get session statistics', async () => {
      const response = await request(app)
        .get('/api/brand/sessions/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.stats).toBeDefined();
      
      const stats = response.body.data.stats;
      expect(stats.totalSessions).toBe(4);
      expect(stats.scheduledSessions).toBe(2);
      expect(stats.completedSessions).toBe(1);
      expect(stats.cancelledSessions).toBe(1);
      expect(stats.totalCapacity).toBe(57); // 10 + 15 + 20 + 12
      expect(stats.totalBookings).toBe(16); // 1 + 0 + 15 + 0
      expect(stats.upcomingSessions).toBe(2);
      expect(stats.averageUtilization).toBeCloseTo(28.07, 1); // (16/57) * 100
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/brand/sessions/stats')
        .expect(401);
    });
  });
});