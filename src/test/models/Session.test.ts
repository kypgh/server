import mongoose from 'mongoose';
import { Brand } from '../../models/Brand';
import { Class } from '../../models/Class';
import { Client } from '../../models/Client';
import { Session, ISession } from '../../models/Session';
import { setupTestDB, teardownTestDB, clearTestDB } from './testSetup';

describe('Session Model', () => {
  let brandId: mongoose.Types.ObjectId;
  let classId: mongoose.Types.ObjectId;
  let clientId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    
    // Create test brand
    const brand = new Brand({
      name: 'Test Studio',
      email: 'test@studio.com',
      password: 'password123',
      address: {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        country: 'US'
      }
    });
    const savedBrand = await brand.save();
    brandId = savedBrand._id as mongoose.Types.ObjectId;

    // Create test class
    const fitnessClass = new Class({
      name: 'Morning Yoga',
      brand: brandId,
      description: 'A relaxing morning yoga session',
      category: 'yoga',
      difficulty: 'beginner',
      slots: 10,
      duration: 60,
      cancellationPolicy: 24
    });
    const savedClass = await fitnessClass.save();
    classId = savedClass._id as mongoose.Types.ObjectId;

    // Create test client
    const client = new Client({
      email: 'client@example.com',
      password: 'password123',
      firstName: 'John',
      lastName: 'Doe'
    });
    const savedClient = await client.save();
    clientId = savedClient._id as mongoose.Types.ObjectId;
  });

  const validSessionData = {
    dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
    capacity: 8
  };

  describe('Validation', () => {
    it('should create a valid session', async () => {
      const sessionData = { ...validSessionData, class: classId };
      const session = new Session(sessionData);
      const savedSession = await session.save();
      
      expect(savedSession._id).toBeDefined();
      expect(savedSession.class.toString()).toBe(classId.toString());
      expect(savedSession.capacity).toBe(validSessionData.capacity);
      expect(savedSession.status).toBe('scheduled');
      expect(savedSession.attendees).toHaveLength(0);
    });

    it('should require class', async () => {
      const sessionData = { ...validSessionData };
      delete (sessionData as any).class;
      
      const session = new Session(sessionData);
      await expect(session.save()).rejects.toThrow('Class is required');
    });

    it('should require dateTime', async () => {
      const sessionData = { ...validSessionData, class: classId };
      delete (sessionData as any).dateTime;
      
      const session = new Session(sessionData);
      await expect(session.save()).rejects.toThrow('Date and time is required');
    });

    it('should validate future dateTime for new sessions', async () => {
      const session = new Session({
        ...validSessionData,
        class: classId,
        dateTime: new Date(Date.now() - 24 * 60 * 60 * 1000) // Yesterday
      });
      
      await expect(session.save()).rejects.toThrow('Session date and time must be in the future');
    });

    it('should validate capacity minimum', async () => {
      const session = new Session({
        ...validSessionData,
        class: classId,
        capacity: 0
      });
      
      await expect(session.save()).rejects.toThrow('Session capacity must be at least 1');
    });

    it('should validate capacity maximum', async () => {
      const session = new Session({
        ...validSessionData,
        class: classId,
        capacity: 101
      });
      
      await expect(session.save()).rejects.toThrow('Session capacity cannot exceed 100');
    });

    it('should validate capacity against class slots', async () => {
      const session = new Session({
        ...validSessionData,
        class: classId,
        capacity: 15 // Exceeds class slots (10)
      });
      
      await expect(session.save()).rejects.toThrow('Session capacity (15) cannot exceed class slots (10)');
    });

    it('should validate attendees do not exceed capacity', async () => {
      const session = new Session({
        ...validSessionData,
        class: classId,
        capacity: 2,
        attendees: [
          {
            client: clientId,
            bookingType: 'credits',
            status: 'confirmed',
            joinedAt: new Date()
          },
          {
            client: new mongoose.Types.ObjectId(),
            bookingType: 'subscription',
            status: 'confirmed',
            joinedAt: new Date()
          },
          {
            client: new mongoose.Types.ObjectId(),
            bookingType: 'credits',
            status: 'confirmed',
            joinedAt: new Date()
          }
        ]
      });
      
      await expect(session.save()).rejects.toThrow('Session validation failed: capacity exceeded or duplicate bookings');
    });

    it('should prevent duplicate client bookings', async () => {
      const session = new Session({
        ...validSessionData,
        class: classId,
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
      });
      
      await expect(session.save()).rejects.toThrow('Session validation failed: capacity exceeded or duplicate bookings');
    });

    it('should validate booking type enum', async () => {
      const session = new Session({
        ...validSessionData,
        class: classId,
        attendees: [{
          client: clientId,
          bookingType: 'invalid' as any,
          status: 'confirmed',
          joinedAt: new Date()
        }]
      });
      
      await expect(session.save()).rejects.toThrow('Booking type must be credits or subscription');
    });

    it('should validate attendee status enum', async () => {
      const session = new Session({
        ...validSessionData,
        class: classId,
        attendees: [{
          client: clientId,
          bookingType: 'credits',
          status: 'invalid' as any,
          joinedAt: new Date()
        }]
      });
      
      await expect(session.save()).rejects.toThrow('Invalid attendee status');
    });
  });

  describe('Instance Methods', () => {
    let session: ISession;

    beforeEach(async () => {
      session = new Session({
        ...validSessionData,
        class: classId,
        capacity: 3,
        attendees: [
          {
            client: clientId,
            bookingType: 'credits',
            status: 'confirmed',
            joinedAt: new Date()
          }
        ]
      });
      await session.save();
    });

    it('should check if session has capacity', () => {
      expect(session.hasCapacity()).toBe(true);
      
      // Fill to capacity
      session.attendees.push(
        {
          client: new mongoose.Types.ObjectId() as any,
          bookingType: 'subscription',
          status: 'confirmed',
          joinedAt: new Date()
        },
        {
          client: new mongoose.Types.ObjectId() as any,
          bookingType: 'credits',
          status: 'confirmed',
          joinedAt: new Date()
        }
      );
      
      expect(session.hasCapacity()).toBe(false);
    });

    it('should get available spots', () => {
      expect(session.getAvailableSpots()).toBe(2);
      
      session.attendees.push({
        client: new mongoose.Types.ObjectId() as any,
        bookingType: 'subscription',
        status: 'confirmed',
        joinedAt: new Date()
      });
      
      expect(session.getAvailableSpots()).toBe(1);
    });

    it('should check if client is booked', () => {
      expect(session.isClientBooked(clientId as any)).toBe(true);
      expect(session.isClientBooked(new mongoose.Types.ObjectId() as any)).toBe(false);
    });

    it('should check if session can be cancelled', () => {
      expect(session.canBeCancelled()).toBe(true);
      
      // Past session
      session.dateTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
      expect(session.canBeCancelled()).toBe(false);
      
      // Future but not scheduled
      session.dateTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
      session.status = 'completed';
      expect(session.canBeCancelled()).toBe(false);
    });
  });

  describe('Virtuals', () => {
    it('should provide availableSpots virtual', async () => {
      const session = new Session({
        ...validSessionData,
        class: classId,
        capacity: 5,
        attendees: [
          {
            client: clientId,
            bookingType: 'credits',
            status: 'confirmed',
            joinedAt: new Date()
          }
        ]
      });
      const savedSession = await session.save();
      
      expect(savedSession.availableSpots).toBe(4);
    });

    it('should include virtuals in JSON output', async () => {
      const session = new Session({
        ...validSessionData,
        class: classId,
        capacity: 5
      });
      const savedSession = await session.save();
      
      const json = savedSession.toJSON();
      expect(json.availableSpots).toBe(5);
    });
  });

  describe('Static Methods', () => {
    it('should find available sessions', async () => {
      // Create sessions with different availability
      await Session.create([
        {
          class: classId,
          dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
          capacity: 2,
          attendees: [{
            client: clientId,
            bookingType: 'credits',
            status: 'confirmed',
            joinedAt: new Date()
          }],
          status: 'scheduled'
        },
        {
          class: classId,
          dateTime: new Date(Date.now() + 48 * 60 * 60 * 1000),
          capacity: 2,
          attendees: [
            {
              client: clientId,
              bookingType: 'credits',
              status: 'confirmed',
              joinedAt: new Date()
            },
            {
              client: new mongoose.Types.ObjectId() as any,
              bookingType: 'subscription',
              status: 'confirmed',
              joinedAt: new Date()
            }
          ],
          status: 'scheduled'
        }
      ]);

      const availableSessions = await Session.findAvailable();
      expect(availableSessions).toHaveLength(1);
      expect(availableSessions[0].availableSpots).toBe(1);
    });
  });

  describe('Indexes', () => {
    it('should have class and dateTime compound index', async () => {
      const indexes = await Session.collection.getIndexes();
      expect(indexes).toHaveProperty('class_1_dateTime_1');
    });

    it('should have dateTime and status compound index', async () => {
      const indexes = await Session.collection.getIndexes();
      expect(indexes).toHaveProperty('dateTime_1_status_1');
    });

    it('should have compound index for efficient queries', async () => {
      const indexes = await Session.collection.getIndexes();
      expect(indexes).toHaveProperty('class_1_dateTime_1_status_1');
    });
  });
});