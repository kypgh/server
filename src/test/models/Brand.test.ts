import { Brand, IBrand } from '../../models/Brand';
import { setupTestDB, teardownTestDB, clearTestDB } from './testSetup';

describe('Brand Model', () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  const validBrandData = {
    name: 'Test Fitness Studio',
    email: 'test@studio.com',
    password: 'password123',
    address: {
      street: '123 Main St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      country: 'US'
    },
    contact: {
      phone: '+1-555-0123',
      website: 'https://teststudio.com'
    },
    businessHours: [
      {
        day: 'monday',
        openTime: '06:00',
        closeTime: '22:00',
        isClosed: false
      },
      {
        day: 'sunday',
        openTime: '',
        closeTime: '',
        isClosed: true
      }
    ]
  };

  describe('Validation', () => {
    it('should create a valid brand', async () => {
      const brand = new Brand(validBrandData);
      const savedBrand = await brand.save();
      
      expect(savedBrand._id).toBeDefined();
      expect(savedBrand.name).toBe(validBrandData.name);
      expect(savedBrand.email).toBe(validBrandData.email);
      expect(savedBrand.status).toBe('active');
      expect(savedBrand.stripeOnboardingComplete).toBe(false);
    });

    it('should require name', async () => {
      const brandData = { ...validBrandData };
      delete (brandData as any).name;
      
      const brand = new Brand(brandData);
      await expect(brand.save()).rejects.toThrow('Brand name is required');
    });

    it('should require email', async () => {
      const brandData = { ...validBrandData };
      delete (brandData as any).email;
      
      const brand = new Brand(brandData);
      await expect(brand.save()).rejects.toThrow('Email is required');
    });

    it('should validate email format', async () => {
      const brand = new Brand({
        ...validBrandData,
        email: 'invalid-email'
      });
      
      await expect(brand.save()).rejects.toThrow('Invalid email format');
    });

    it('should enforce unique email', async () => {
      await new Brand(validBrandData).save();
      
      const duplicateBrand = new Brand(validBrandData);
      await expect(duplicateBrand.save()).rejects.toThrow();
    });

    it('should validate password length', async () => {
      const brand = new Brand({
        ...validBrandData,
        password: '123'
      });
      
      await expect(brand.save()).rejects.toThrow('Password must be at least 8 characters');
    });

    it('should validate phone number format', async () => {
      const brand = new Brand({
        ...validBrandData,
        contact: {
          phone: 'invalid-phone'
        }
      });
      
      await expect(brand.save()).rejects.toThrow('Invalid phone number format');
    });

    it('should validate website URL format', async () => {
      const brand = new Brand({
        ...validBrandData,
        contact: {
          website: 'invalid-url'
        }
      });
      
      await expect(brand.save()).rejects.toThrow('Website must be a valid URL');
    });

    it('should validate business hours time format', async () => {
      const brand = new Brand({
        ...validBrandData,
        businessHours: [{
          day: 'monday',
          openTime: '25:00', // Invalid time
          closeTime: '22:00',
          isClosed: false
        }]
      });
      
      await expect(brand.save()).rejects.toThrow('Time must be in HH:MM format');
    });

    it('should validate business hours logic', async () => {
      const brand = new Brand({
        ...validBrandData,
        businessHours: [{
          day: 'monday',
          openTime: '22:00',
          closeTime: '06:00', // Close before open
          isClosed: false
        }]
      });
      
      await expect(brand.save()).rejects.toThrow('close time must be after open time');
    });

    it('should prevent duplicate days in business hours', async () => {
      const brand = new Brand({
        ...validBrandData,
        businessHours: [
          {
            day: 'monday',
            openTime: '06:00',
            closeTime: '12:00',
            isClosed: false
          },
          {
            day: 'monday', // Duplicate day
            openTime: '14:00',
            closeTime: '22:00',
            isClosed: false
          }
        ]
      });
      
      await expect(brand.save()).rejects.toThrow('Each day can only appear once in business hours');
    });

    it('should allow closed days without times', async () => {
      const brand = new Brand({
        ...validBrandData,
        businessHours: [{
          day: 'sunday',
          openTime: '',
          closeTime: '',
          isClosed: true
        }]
      });
      
      const savedBrand = await brand.save();
      expect(savedBrand.businessHours[0].isClosed).toBe(true);
    });
  });

  describe('JSON Transformation', () => {
    it('should exclude password from JSON output', async () => {
      const brand = new Brand(validBrandData);
      const savedBrand = await brand.save();
      
      const json = savedBrand.toJSON();
      expect(json.password).toBeUndefined();
      expect(json.name).toBe(validBrandData.name);
    });
  });

  describe('Indexes', () => {
    it('should have email index', async () => {
      const indexes = await Brand.collection.getIndexes();
      expect(indexes).toHaveProperty('email_1');
    });

    it('should have status index', async () => {
      const indexes = await Brand.collection.getIndexes();
      expect(indexes).toHaveProperty('status_1');
    });
  });
});