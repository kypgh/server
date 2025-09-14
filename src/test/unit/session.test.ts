import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import mongoose from 'mongoose';
import { Session, ISession } from '../../models/Session';
import { Class, IClass } from '../../models/Class';
import { Brand } from '../../models/Brand';
import { MongoMemoryServer } from 'mongodb-memory-server';

describe('Session Model', () => {
  let mongoServer: MongoMemoryServer;
  let testBrand: any;
  let testClass: IClass;

  beforeEach(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

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
  });

  afterEach(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  describe('Session Creation', () => {
    it('should create a valid session', async () => {
      const sessionData = {
        class: testClass._id,
        dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        capacity: 15,
        status: 'scheduled' as const
      };

      const session = new Session(sessionData);
      await session.save();

      expect(session._id).toBeDefined();
      expect(session.class.toString()).toBe(testClass._id.toString());
      expect(session.capacity).toBe(15);
      expect(session.status).toBe('scheduled');
      expect(session.attendees).toHaveLength(0);
    });

    it('should reject session with past date', async () => {
      const sessionData = {
        class: testClass._id,
        dateTime: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
        capacity: 15
      };

      const session = new Session(sessionData);
      
      await expect(session.save()).rejects.toThrow();
    });

    it('should reject session with capacity exceeding class slots', async () => {
      const sessionData = {
        class: testClass._id,
        dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        capacity: 25 // Exceeds class slots (20)
      };

      const session = new Session(sessionData);
      
      await expect(session.save()).rejects.toThrow();
    });

    it('should reject session with invalid capacity', async () => {
      const sessionData = {
        class: testClass._id,
        dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        capacity: 0 // Invalid capacity
      };

      const session = new Session(sessionData);
      
      await expect(session.save()).rejects.toThrow();
    });

    it('should reject session without required fields', async () => {
      const session = new Session({});
      
      await expect(session.save()).rejects.toThrow();
    });
  });

  describe('Session Instance Methods', () => {
    let session: ISession;

    beforeEach(async () => {
      session = await Session.create({
        class: testClass._id,
        dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        capacity: 10,
        attendees: [
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
        ]
      });
    });

    it('should correctly check if session has capacity', () => {
      expect(session.hasCapacity()).toBe(true);
      
      // Fill to capacity
      while (session.attendees.length < session.capacity) {
        session.attendees.push({
          client: new mongoose.Types.ObjectId(),
          bookingType: 'credits',
          status: 'confirmed',
          joinedAt: new Date()
        });
      }
      
      expect(session.hasCapacity()).toBe(false);
    });

    it('should correctly calculate available spots', () => {
      expect(session.getAvailableSpots()).toBe(8); // 10 capacity - 2 attendees
      
      session.attendees.push({
        client: new mongoose.Types.ObjectId(),
        bookingType: 'credits',
        status: 'confirmed',
        joinedAt: new Date()
      });
      
      expect(session.getAvailableSpots()).toBe(7);
    });

    it('should correctly check if client is booked', () => {
      const clientId = session.attendees[0].client;
      const otherClientId = new mongoose.Types.ObjectId();
      
      expect(session.isClientBooked(clientId)).toBe(true);
      expect(session.isClientBooked(otherClientId)).toBe(false);
    });

    it('should correctly check if session can be cancelled', () => {
      // Future scheduled session should be cancellable
      expect(session.canBeCancelled()).toBe(true);
      
      // Past session should not be cancellable
      session.dateTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
      expect(session.canBeCancelled()).toBe(false);
      
      // Non-scheduled session should not be cancellable
      session.dateTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
      session.status = 'completed';
      expect(session.canBeCancelled()).toBe(false);
    });
  });

  describe('Session Validation', () => {
    it('should prevent duplicate attendees', async () => {
      const clientId = new mongoose.Types.ObjectId();
      
      const sessionData = {
        class: testClass._id,
        dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        capacity: 10,
        attendees: [
          {
            client: clientId,
            bookingType: 'credits',
            status: 'confirmed',
            joinedAt: new Date()
          },
          {
            client: clientId, // Duplicate client
            bookingType: 'subscription',
            status: 'confirmed',
            joinedAt: new Date()
          }
        ]
      };

      const session = new Session(sessionData);
      
      await expect(session.save()).rejects.toThrow();
    });

    it('should prevent attendees exceeding capacity', async () => {
      const attendees: any[] = [];
      for (let i = 0; i < 11; i++) { // 11 attendees for capacity of 10
        attendees.push({
          client: new mongoose.Types.ObjectId(),
          bookingType: 'credits',
          status: 'confirmed',
          joinedAt: new Date()
        });
      }

      const sessionData = {
        class: testClass._id,
        dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        capacity: 10,
        attendees
      };

      const session = new Session(sessionData);
      
      await expect(session.save()).rejects.toThrow();
    });

    it('should validate attendee booking type', async () => {
      const sessionData = {
        class: testClass._id,
        dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        capacity: 10,
        attendees: [{
          client: new mongoose.Types.ObjectId(),
          bookingType: 'invalid' as any,
          status: 'confirmed',
          joinedAt: new Date()
        }]
      };

      const session = new Session(sessionData);
      
      await expect(session.save()).rejects.toThrow();
    });

    it('should validate attendee status', async () => {
      const sessionData = {
        class: testClass._id,
        dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        capacity: 10,
        attendees: [{
          client: new mongoose.Types.ObjectId(),
          bookingType: 'credits',
          status: 'invalid' as any,
          joinedAt: new Date()
        }]
      };

      const session = new Session(sessionData);
      
      await expect(session.save()).rejects.toThrow();
    });
  });

  describe('Session Static Methods', () => {
    beforeEach(async () => {
      // Create test sessions
      await Session.create([
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
          capacity: 5,
          status: 'scheduled',
          attendees: []
        },
        {
          class: testClass._id,
          dateTime: new Date(Date.now() + 72 * 60 * 60 * 1000),
          capacity: 8,
          status: 'scheduled',
          attendees: Array(8).fill(null).map(() => ({
            client: new mongoose.Types.ObjectId(),
            bookingType: 'credits',
            status: 'confirmed',
            joinedAt: new Date()
          }))
        }
      ]);
    });

    it('should find available sessions', async () => {
      const availableSessions = await Session.findAvailable();
      
      expect(availableSessions).toHaveLength(2); // Two sessions with available spots
      
      availableSessions.forEach(session => {
        expect(session.availableSpots).toBeGreaterThan(0);
        expect(session.status).toBe('scheduled');
      });
    });

    it('should filter available sessions by class', async () => {
      const availableSessions = await Session.findAvailable({ 
        class: testClass._id 
      });
      
      expect(availableSessions).toHaveLength(2);
      
      availableSessions.forEach(session => {
        expect(session.class.toString()).toBe(testClass._id.toString());
        expect(session.availableSpots).toBeGreaterThan(0);
      });
    });
  });

  describe('Session Virtual Properties', () => {
    it('should calculate availableSpots virtual property', async () => {
      const session = await Session.create({
        class: testClass._id,
        dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        capacity: 10,
        attendees: [{
          client: new mongoose.Types.ObjectId(),
          bookingType: 'credits',
          status: 'confirmed',
          joinedAt: new Date()
        }]
      });

      const sessionJSON = session.toJSON();
      expect(sessionJSON.availableSpots).toBe(9);
    });
  });
});