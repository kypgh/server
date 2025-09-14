import mongoose from 'mongoose';
import { Brand } from '../../models/Brand';
import { Class, IClass } from '../../models/Class';
import { setupTestDB, teardownTestDB, clearTestDB } from './testSetup';

describe('Class Model', () => {
  let brandId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    
    // Create a test brand
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
  });

  const validClassData = {
    name: 'Morning Yoga',
    description: 'A relaxing morning yoga session to start your day',
    category: 'yoga',
    difficulty: 'beginner' as const,
    slots: 15,
    duration: 60,
    cancellationPolicy: 24,
    timeBlocks: [
      {
        day: 'monday' as const,
        startTime: '08:00',
        endTime: '09:00'
      },
      {
        day: 'wednesday' as const,
        startTime: '08:00',
        endTime: '09:00'
      }
    ]
  };

  describe('Validation', () => {
    it('should create a valid class', async () => {
      const classData = { ...validClassData, brand: brandId };
      const fitnessClass = new Class(classData);
      const savedClass = await fitnessClass.save();
      
      expect(savedClass._id).toBeDefined();
      expect(savedClass.name).toBe(validClassData.name);
      expect(savedClass.brand.toString()).toBe(brandId.toString());
      expect(savedClass.status).toBe('active');
    });

    it('should require name', async () => {
      const classData = { ...validClassData, brand: brandId };
      delete (classData as any).name;
      
      const fitnessClass = new Class(classData);
      await expect(fitnessClass.save()).rejects.toThrow('Class name is required');
    });

    it('should require brand', async () => {
      const classData = { ...validClassData };
      delete (classData as any).brand;
      
      const fitnessClass = new Class(classData);
      await expect(fitnessClass.save()).rejects.toThrow('Brand is required');
    });

    it('should validate name length', async () => {
      const fitnessClass = new Class({
        ...validClassData,
        brand: brandId,
        name: 'A' // Too short
      });
      
      await expect(fitnessClass.save()).rejects.toThrow('Class name must be at least 2 characters');
    });

    it('should validate description length', async () => {
      const fitnessClass = new Class({
        ...validClassData,
        brand: brandId,
        description: 'Short' // Too short
      });
      
      await expect(fitnessClass.save()).rejects.toThrow('Description must be at least 10 characters');
    });

    it('should validate difficulty enum', async () => {
      const fitnessClass = new Class({
        ...validClassData,
        brand: brandId,
        difficulty: 'invalid' as any
      });
      
      await expect(fitnessClass.save()).rejects.toThrow('Difficulty must be beginner, intermediate, or advanced');
    });

    it('should validate slots minimum', async () => {
      const fitnessClass = new Class({
        ...validClassData,
        brand: brandId,
        slots: 0
      });
      
      await expect(fitnessClass.save()).rejects.toThrow('Class must have at least 1 slot');
    });

    it('should validate slots maximum', async () => {
      const fitnessClass = new Class({
        ...validClassData,
        brand: brandId,
        slots: 101
      });
      
      await expect(fitnessClass.save()).rejects.toThrow('Class cannot have more than 100 slots');
    });

    it('should validate duration minimum', async () => {
      const fitnessClass = new Class({
        ...validClassData,
        brand: brandId,
        duration: 10
      });
      
      await expect(fitnessClass.save()).rejects.toThrow('Class duration must be at least 15 minutes');
    });

    it('should validate duration is multiple of 15', async () => {
      const fitnessClass = new Class({
        ...validClassData,
        brand: brandId,
        duration: 37 // Not multiple of 15
      });
      
      await expect(fitnessClass.save()).rejects.toThrow('Duration must be a multiple of 15 minutes');
    });

    it('should validate time block format', async () => {
      const fitnessClass = new Class({
        ...validClassData,
        brand: brandId,
        timeBlocks: [{
          day: 'monday' as const,
          startTime: '25:00', // Invalid time
          endTime: '09:00'
        }]
      });
      
      await expect(fitnessClass.save()).rejects.toThrow('Start time must be in HH:MM format');
    });

    it('should validate time block logic', async () => {
      const fitnessClass = new Class({
        ...validClassData,
        brand: brandId,
        timeBlocks: [{
          day: 'monday' as const,
          startTime: '09:00',
          endTime: '08:00' // End before start
        }]
      });
      
      await expect(fitnessClass.save()).rejects.toThrow('end time must be after start time');
    });

    it('should validate time block duration matches class duration', async () => {
      const fitnessClass = new Class({
        ...validClassData,
        brand: brandId,
        duration: 90, // 90 minutes
        timeBlocks: [{
          day: 'monday' as const,
          startTime: '08:00',
          endTime: '09:00' // Only 60 minutes
        }]
      });
      
      await expect(fitnessClass.save()).rejects.toThrow('Time block duration (60 minutes) must match class duration (90 minutes)');
    });

    it('should prevent duplicate time blocks', async () => {
      const fitnessClass = new Class({
        ...validClassData,
        brand: brandId,
        timeBlocks: [
          {
            day: 'monday' as const,
            startTime: '08:00',
            endTime: '09:00'
          },
          {
            day: 'monday' as const,
            startTime: '08:00',
            endTime: '09:00' // Duplicate
          }
        ]
      });
      
      await expect(fitnessClass.save()).rejects.toThrow('Duplicate time blocks are not allowed');
    });

    it('should allow empty time blocks', async () => {
      const fitnessClass = new Class({
        ...validClassData,
        brand: brandId,
        timeBlocks: []
      });
      
      const savedClass = await fitnessClass.save();
      expect(savedClass.timeBlocks).toHaveLength(0);
    });
  });

  describe('Instance Methods', () => {
    it('should check availability correctly', async () => {
      const fitnessClass = new Class({
        ...validClassData,
        brand: brandId
      });
      const savedClass = await fitnessClass.save();
      
      expect(savedClass.isAvailableAt('monday', '08:30')).toBe(true);
      expect(savedClass.isAvailableAt('monday', '07:30')).toBe(false);
      expect(savedClass.isAvailableAt('tuesday', '08:30')).toBe(false);
    });

    it('should return false for inactive classes', async () => {
      const fitnessClass = new Class({
        ...validClassData,
        brand: brandId,
        status: 'inactive'
      });
      const savedClass = await fitnessClass.save();
      
      expect(savedClass.isAvailableAt('monday', '08:30')).toBe(false);
    });
  });

  describe('Indexes', () => {
    it('should have brand and status compound index', async () => {
      const indexes = await Class.collection.getIndexes();
      expect(indexes).toHaveProperty('brand_1_status_1');
    });

    it('should have category and difficulty compound index', async () => {
      const indexes = await Class.collection.getIndexes();
      expect(indexes).toHaveProperty('category_1_difficulty_1');
    });
  });
});