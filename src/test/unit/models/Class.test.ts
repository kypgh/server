import mongoose from 'mongoose';
import { Class, IClass, TimeBlock } from '../../../models/Class';
import { Brand } from '../../../models/Brand';
import { MongoMemoryServer } from 'mongodb-memory-server';

describe('Class Model', () => {
  let mongoServer: MongoMemoryServer;
  let brandId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Create a test brand
    const brand = new Brand({
      name: 'Test Fitness Studio',
      email: 'test@studio.com',
      password: 'hashedPassword',
      address: {
        street: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345'
      }
    });
    await brand.save();
    brandId = brand._id;
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  afterEach(async () => {
    await Class.deleteMany({});
  });

  describe('Class Creation', () => {
    it('should create a valid class with required fields', async () => {
      const classData = {
        name: 'Yoga Flow',
        brand: brandId,
        description: 'A relaxing yoga flow class for all levels',
        category: 'yoga',
        difficulty: 'beginner' as const,
        slots: 15,
        duration: 60,
        cancellationPolicy: 24
      };

      const newClass = new Class(classData);
      const savedClass = await newClass.save();

      expect(savedClass._id).toBeDefined();
      expect(savedClass.name).toBe(classData.name);
      expect(savedClass.brand.toString()).toBe(brandId.toString());
      expect(savedClass.description).toBe(classData.description);
      expect(savedClass.category).toBe(classData.category);
      expect(savedClass.difficulty).toBe(classData.difficulty);
      expect(savedClass.slots).toBe(classData.slots);
      expect(savedClass.duration).toBe(classData.duration);
      expect(savedClass.cancellationPolicy).toBe(classData.cancellationPolicy);
      expect(savedClass.status).toBe('active'); // default value
      expect(savedClass.timeBlocks).toEqual([]); // default empty array
      expect(savedClass.createdAt).toBeDefined();
      expect(savedClass.updatedAt).toBeDefined();
    });

    it('should create a class with time blocks', async () => {
      const timeBlocks: TimeBlock[] = [
        { day: 'monday', startTime: '09:00', endTime: '10:00' },
        { day: 'wednesday', startTime: '18:00', endTime: '19:00' },
        { day: 'friday', startTime: '07:00', endTime: '08:00' }
      ];

      const classData = {
        name: 'Morning HIIT',
        brand: brandId,
        description: 'High intensity interval training to start your day',
        category: 'hiit',
        difficulty: 'advanced' as const,
        slots: 12,
        duration: 60,
        timeBlocks
      };

      const newClass = new Class(classData);
      const savedClass = await newClass.save();

      expect(savedClass.timeBlocks).toHaveLength(3);
      expect(savedClass.timeBlocks[0].day).toBe('monday');
      expect(savedClass.timeBlocks[0].startTime).toBe('09:00');
      expect(savedClass.timeBlocks[0].endTime).toBe('10:00');
    });

    it('should fail validation for missing required fields', async () => {
      const invalidClass = new Class({
        name: 'Test Class'
        // Missing required fields
      });

      await expect(invalidClass.save()).rejects.toThrow();
    });

    it('should fail validation for invalid difficulty level', async () => {
      const classData = {
        name: 'Test Class',
        brand: brandId,
        description: 'A test class with invalid difficulty',
        category: 'test',
        difficulty: 'expert' as any, // Invalid difficulty
        slots: 10,
        duration: 45
      };

      const invalidClass = new Class(classData);
      await expect(invalidClass.save()).rejects.toThrow();
    });

    it('should fail validation for invalid slots count', async () => {
      const classData = {
        name: 'Test Class',
        brand: brandId,
        description: 'A test class with invalid slots',
        category: 'test',
        difficulty: 'beginner' as const,
        slots: 0, // Invalid: must be at least 1
        duration: 45
      };

      const invalidClass = new Class(classData);
      await expect(invalidClass.save()).rejects.toThrow();
    });

    it('should fail validation for invalid duration', async () => {
      const classData = {
        name: 'Test Class',
        brand: brandId,
        description: 'A test class with invalid duration',
        category: 'test',
        difficulty: 'beginner' as const,
        slots: 10,
        duration: 37 // Invalid: not a multiple of 15
      };

      const invalidClass = new Class(classData);
      await expect(invalidClass.save()).rejects.toThrow();
    });
  });

  describe('Time Block Validation', () => {
    it('should validate time block format', async () => {
      const classData = {
        name: 'Test Class',
        brand: brandId,
        description: 'A test class with invalid time format',
        category: 'test',
        difficulty: 'beginner' as const,
        slots: 10,
        duration: 60,
        timeBlocks: [
          { day: 'monday', startTime: '25:00', endTime: '10:00' } // Invalid time format
        ]
      };

      const invalidClass = new Class(classData);
      await expect(invalidClass.save()).rejects.toThrow();
    });

    it('should validate that end time is after start time', async () => {
      const classData = {
        name: 'Test Class',
        brand: brandId,
        description: 'A test class with invalid time range',
        category: 'test',
        difficulty: 'beginner' as const,
        slots: 10,
        duration: 60,
        timeBlocks: [
          { day: 'monday', startTime: '10:00', endTime: '09:00' } // End before start
        ]
      };

      const invalidClass = new Class(classData);
      await expect(invalidClass.save()).rejects.toThrow();
    });

    it('should validate that time block duration matches class duration', async () => {
      const classData = {
        name: 'Test Class',
        brand: brandId,
        description: 'A test class with mismatched duration',
        category: 'test',
        difficulty: 'beginner' as const,
        slots: 10,
        duration: 60, // 60 minutes
        timeBlocks: [
          { day: 'monday', startTime: '09:00', endTime: '10:30' } // 90 minutes
        ]
      };

      const invalidClass = new Class(classData);
      await expect(invalidClass.save()).rejects.toThrow();
    });

    it('should prevent duplicate time blocks', async () => {
      const classData = {
        name: 'Test Class',
        brand: brandId,
        description: 'A test class with duplicate time blocks',
        category: 'test',
        difficulty: 'beginner' as const,
        slots: 10,
        duration: 60,
        timeBlocks: [
          { day: 'monday', startTime: '09:00', endTime: '10:00' },
          { day: 'monday', startTime: '09:00', endTime: '10:00' } // Duplicate
        ]
      };

      const invalidClass = new Class(classData);
      await expect(invalidClass.save()).rejects.toThrow();
    });
  });

  describe('Instance Methods', () => {
    let testClass: IClass;

    beforeEach(async () => {
      const classData = {
        name: 'Test Class',
        brand: brandId,
        description: 'A test class for method testing',
        category: 'test',
        difficulty: 'beginner' as const,
        slots: 10,
        duration: 60,
        timeBlocks: [
          { day: 'monday', startTime: '09:00', endTime: '10:00' },
          { day: 'wednesday', startTime: '18:00', endTime: '19:00' },
          { day: 'friday', startTime: '07:00', endTime: '08:00' }
        ]
      };

      testClass = new Class(classData);
      await testClass.save();
    });

    describe('isAvailableAt', () => {
      it('should return true for valid day and time', () => {
        expect(testClass.isAvailableAt('monday', '09:30')).toBe(true);
        expect(testClass.isAvailableAt('wednesday', '18:15')).toBe(true);
        expect(testClass.isAvailableAt('friday', '07:45')).toBe(true);
      });

      it('should return false for invalid day', () => {
        expect(testClass.isAvailableAt('tuesday', '09:30')).toBe(false);
        expect(testClass.isAvailableAt('saturday', '10:00')).toBe(false);
      });

      it('should return false for time outside time blocks', () => {
        expect(testClass.isAvailableAt('monday', '08:30')).toBe(false); // Before start
        expect(testClass.isAvailableAt('monday', '10:30')).toBe(false); // After end
        expect(testClass.isAvailableAt('wednesday', '17:30')).toBe(false); // Before start
      });

      it('should return false for exact end time', () => {
        expect(testClass.isAvailableAt('monday', '10:00')).toBe(false);
      });

      it('should return true for exact start time', () => {
        expect(testClass.isAvailableAt('monday', '09:00')).toBe(true);
      });

      it('should handle case insensitive day matching', () => {
        expect(testClass.isAvailableAt('MONDAY', '09:30')).toBe(true);
        expect(testClass.isAvailableAt('Monday', '09:30')).toBe(true);
      });

      it('should return false for inactive class', async () => {
        testClass.status = 'inactive';
        await testClass.save();

        expect(testClass.isAvailableAt('monday', '09:30')).toBe(false);
      });
    });
  });

  describe('Database Indexes', () => {
    it('should have proper indexes for efficient queries', async () => {
      const indexes = await Class.collection.getIndexes();
      
      // Check that required indexes exist
      const indexNames = Object.keys(indexes);
      expect(indexNames).toContain('brand_1_status_1');
      expect(indexNames).toContain('category_1_difficulty_1');
      expect(indexNames).toContain('brand_1_name_1');
      expect(indexNames).toContain('status_1');
    });
  });

  describe('Model Validation Edge Cases', () => {
    it('should allow empty time blocks array', async () => {
      const classData = {
        name: 'Flexible Class',
        brand: brandId,
        description: 'A class with flexible scheduling',
        category: 'flexible',
        difficulty: 'beginner' as const,
        slots: 10,
        duration: 45,
        timeBlocks: [] // Empty array should be allowed
      };

      const newClass = new Class(classData);
      const savedClass = await newClass.save();

      expect(savedClass.timeBlocks).toEqual([]);
    });

    it('should trim and validate string fields', async () => {
      const classData = {
        name: '  Yoga Flow  ', // Should be trimmed
        brand: brandId,
        description: '  A relaxing yoga class  ', // Should be trimmed
        category: '  YOGA  ', // Should be trimmed and lowercased
        difficulty: 'beginner' as const,
        slots: 15,
        duration: 60
      };

      const newClass = new Class(classData);
      const savedClass = await newClass.save();

      expect(savedClass.name).toBe('Yoga Flow');
      expect(savedClass.description).toBe('A relaxing yoga class');
      expect(savedClass.category).toBe('yoga');
    });

    it('should enforce maximum field lengths', async () => {
      const longString = 'a'.repeat(1001); // Exceeds 1000 character limit

      const classData = {
        name: 'Test Class',
        brand: brandId,
        description: longString, // Too long
        category: 'test',
        difficulty: 'beginner' as const,
        slots: 10,
        duration: 60
      };

      const invalidClass = new Class(classData);
      await expect(invalidClass.save()).rejects.toThrow();
    });
  });
});