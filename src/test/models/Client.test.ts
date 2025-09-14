import { Client, IClient } from '../../models/Client';
import { setupTestDB, teardownTestDB, clearTestDB } from './testSetup';

describe('Client Model', () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  const validClientData = {
    email: 'client@example.com',
    password: 'password123',
    firstName: 'John',
    lastName: 'Doe',
    phone: '+1-555-0123',
    preferences: {
      favoriteCategories: ['yoga', 'pilates'],
      preferredDifficulty: 'intermediate' as const,
      notifications: {
        email: true,
        sms: false,
        push: true
      },
      timezone: 'America/New_York'
    }
  };

  describe('Validation', () => {
    it('should create a valid client', async () => {
      const client = new Client(validClientData);
      const savedClient = await client.save();
      
      expect(savedClient._id).toBeDefined();
      expect(savedClient.email).toBe(validClientData.email);
      expect(savedClient.firstName).toBe(validClientData.firstName);
      expect(savedClient.lastName).toBe(validClientData.lastName);
      expect(savedClient.status).toBe('active');
    });

    it('should require email', async () => {
      const clientData = { ...validClientData };
      delete (clientData as any).email;
      
      const client = new Client(clientData);
      await expect(client.save()).rejects.toThrow('Email is required');
    });

    it('should validate email format', async () => {
      const client = new Client({
        ...validClientData,
        email: 'invalid-email'
      });
      
      await expect(client.save()).rejects.toThrow('Invalid email format');
    });

    it('should enforce unique email', async () => {
      await new Client(validClientData).save();
      
      const duplicateClient = new Client(validClientData);
      await expect(duplicateClient.save()).rejects.toThrow();
    });

    it('should require password', async () => {
      const clientData = { ...validClientData };
      delete (clientData as any).password;
      
      const client = new Client(clientData);
      await expect(client.save()).rejects.toThrow('Password is required');
    });

    it('should validate password length', async () => {
      const client = new Client({
        ...validClientData,
        password: '123'
      });
      
      await expect(client.save()).rejects.toThrow('Password must be at least 8 characters');
    });

    it('should require firstName', async () => {
      const clientData = { ...validClientData };
      delete (clientData as any).firstName;
      
      const client = new Client(clientData);
      await expect(client.save()).rejects.toThrow('First name is required');
    });

    it('should require lastName', async () => {
      const clientData = { ...validClientData };
      delete (clientData as any).lastName;
      
      const client = new Client(clientData);
      await expect(client.save()).rejects.toThrow('Last name is required');
    });

    it('should validate firstName length', async () => {
      const client = new Client({
        ...validClientData,
        firstName: ''
      });
      
      await expect(client.save()).rejects.toThrow('First name is required');
    });

    it('should validate lastName length', async () => {
      const client = new Client({
        ...validClientData,
        lastName: 'a'.repeat(51) // Too long
      });
      
      await expect(client.save()).rejects.toThrow('Last name cannot exceed 50 characters');
    });

    it('should validate phone number format', async () => {
      const client = new Client({
        ...validClientData,
        phone: 'invalid-phone'
      });
      
      await expect(client.save()).rejects.toThrow('Invalid phone number format');
    });

    it('should validate profile photo URL', async () => {
      const client = new Client({
        ...validClientData,
        profilePhoto: 'invalid-url'
      });
      
      await expect(client.save()).rejects.toThrow('Profile photo must be a valid URL');
    });

    it('should validate preferred difficulty', async () => {
      const client = new Client({
        ...validClientData,
        preferences: {
          ...validClientData.preferences,
          preferredDifficulty: 'invalid' as any
        }
      });
      
      await expect(client.save()).rejects.toThrow();
    });

    it('should set default preferences', async () => {
      const clientData = { ...validClientData };
      delete (clientData as any).preferences;
      
      const client = new Client(clientData);
      const savedClient = await client.save();
      
      expect(savedClient.preferences.notifications?.email).toBe(true);
      expect(savedClient.preferences.notifications?.sms).toBe(false);
      expect(savedClient.preferences.notifications?.push).toBe(true);
      expect(savedClient.preferences.timezone).toBe('UTC');
    });
  });

  describe('Virtuals', () => {
    it('should provide fullName virtual', async () => {
      const client = new Client(validClientData);
      const savedClient = await client.save();
      
      expect(savedClient.fullName).toBe('John Doe');
    });

    it('should include virtuals in JSON output', async () => {
      const client = new Client(validClientData);
      const savedClient = await client.save();
      
      const json = savedClient.toJSON();
      expect(json.fullName).toBe('John Doe');
    });
  });

  describe('JSON Transformation', () => {
    it('should exclude password from JSON output', async () => {
      const client = new Client(validClientData);
      const savedClient = await client.save();
      
      const json = savedClient.toJSON();
      expect(json.password).toBeUndefined();
      expect(json.firstName).toBe(validClientData.firstName);
    });
  });

  describe('Indexes', () => {
    it('should have email index', async () => {
      const indexes = await Client.collection.getIndexes();
      expect(indexes).toHaveProperty('email_1');
    });

    it('should have status index', async () => {
      const indexes = await Client.collection.getIndexes();
      expect(indexes).toHaveProperty('status_1');
    });

    it('should have brands index', async () => {
      const indexes = await Client.collection.getIndexes();
      expect(indexes).toHaveProperty('brands_1');
    });
  });
});