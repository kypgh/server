import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import App from '../../app';
import { Client } from '../../models/Client';
import { PasswordUtils, JwtUtils, JwtPayload } from '../../utils/auth';

describe('Client Profile Integration Tests', () => {
  let app: App;
  let mongoServer: MongoMemoryServer;
  let server: any;
  let clientId: string;
  let accessToken: string;

  beforeAll(async () => {
    // Start in-memory MongoDB instance
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    // Connect to the in-memory database
    await mongoose.connect(mongoUri);
    
    // Create app instance
    app = new App();
    server = app.getApp();
  });

  afterAll(async () => {
    // Clean up
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear all collections before each test
    await Client.deleteMany({});

    // Create a test client
    const hashedPassword = await PasswordUtils.hashPassword('TestPass123!');
    const client = await Client.create({
      email: 'profile@client.com',
      password: hashedPassword,
      firstName: 'Profile',
      lastName: 'Test',
      phone: '+1-555-123-4567',
      preferences: {
        favoriteCategories: ['yoga', 'pilates'],
        preferredDifficulty: 'intermediate',
        notifications: {
          email: true,
          sms: false,
          push: true
        },
        timezone: 'America/New_York'
      },
      status: 'active'
    });

    clientId = client._id.toString();

    // Generate access token
    const jwtPayload: JwtPayload = {
      id: clientId,
      type: 'client',
      email: client.email
    };
    accessToken = JwtUtils.generateAccessToken(jwtPayload);
  });

  describe('GET /api/client/profile', () => {
    it('should get client profile with valid token', async () => {
      const response = await request(server)
        .get('/api/client/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Profile retrieved successfully');
      expect(response.body.data.client).toBeDefined();
      expect(response.body.data.client.email).toBe('profile@client.com');
      expect(response.body.data.client.firstName).toBe('Profile');
      expect(response.body.data.client.lastName).toBe('Test');
      expect(response.body.data.client.fullName).toBe('Profile Test');
      expect(response.body.data.client.password).toBeUndefined();
      expect(response.body.data.client.preferences).toBeDefined();
      expect(response.body.data.client.preferences.favoriteCategories).toEqual(['yoga', 'pilates']);
    });

    it('should reject request without token', async () => {
      const response = await request(server)
        .get('/api/client/profile')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTH_001');
    });

    it('should reject request with invalid token', async () => {
      const response = await request(server)
        .get('/api/client/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTH_002');
    });

    it('should reject request with brand token', async () => {
      // Create a brand token
      const brandPayload: JwtPayload = {
        id: 'brand-id',
        type: 'brand',
        email: 'brand@test.com'
      };
      const brandToken = JwtUtils.generateAccessToken(brandPayload);

      const response = await request(server)
        .get('/api/client/profile')
        .set('Authorization', `Bearer ${brandToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTH_006');
      expect(response.body.error.message).toBe('Client access required');
    });

    it('should return 404 for non-existent client', async () => {
      // Delete the client but keep using the token
      await Client.deleteOne({ _id: clientId });

      const response = await request(server)
        .get('/api/client/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('CLIENT_001');
      expect(response.body.error.message).toBe('Client not found');
    });
  });

  describe('PUT /api/client/profile', () => {
    it('should update client profile with valid data', async () => {
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name',
        phone: '+1-555-987-6543',
        profilePhoto: 'https://example.com/photo.jpg',
        preferences: {
          favoriteCategories: ['crossfit', 'boxing'],
          preferredDifficulty: 'advanced',
          notifications: {
            email: false,
            sms: true,
            push: false
          },
          timezone: 'America/Los_Angeles'
        }
      };

      const response = await request(server)
        .put('/api/client/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Profile updated successfully');
      expect(response.body.data.client.firstName).toBe('Updated');
      expect(response.body.data.client.lastName).toBe('Name');
      expect(response.body.data.client.fullName).toBe('Updated Name');
      expect(response.body.data.client.phone).toBe('+1-555-987-6543');
      expect(response.body.data.client.profilePhoto).toBe('https://example.com/photo.jpg');
      expect(response.body.data.client.preferences.favoriteCategories).toEqual(['crossfit', 'boxing']);
      expect(response.body.data.client.preferences.preferredDifficulty).toBe('advanced');
      expect(response.body.data.client.preferences.notifications.email).toBe(false);
      expect(response.body.data.client.preferences.notifications.sms).toBe(true);
      expect(response.body.data.client.preferences.timezone).toBe('America/Los_Angeles');

      // Verify in database
      const updatedClient = await Client.findById(clientId);
      expect(updatedClient?.firstName).toBe('Updated');
      expect(updatedClient?.lastName).toBe('Name');
    });

    it('should update partial profile data', async () => {
      const updateData = {
        firstName: 'PartialUpdate'
      };

      const response = await request(server)
        .put('/api/client/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.client.firstName).toBe('PartialUpdate');
      expect(response.body.data.client.lastName).toBe('Test'); // Should remain unchanged
      expect(response.body.data.client.preferences.favoriteCategories).toEqual(['yoga', 'pilates']); // Should remain unchanged
    });

    it('should update only notification preferences', async () => {
      const updateData = {
        preferences: {
          notifications: {
            email: false,
            push: false
          }
        }
      };

      const response = await request(server)
        .put('/api/client/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.client.preferences.notifications.email).toBe(false);
      expect(response.body.data.client.preferences.notifications.sms).toBe(false); // Should remain unchanged
      expect(response.body.data.client.preferences.notifications.push).toBe(false);
      expect(response.body.data.client.preferences.favoriteCategories).toEqual(['yoga', 'pilates']); // Should remain unchanged
    });

    it('should reject update with invalid data', async () => {
      const invalidData = {
        firstName: '', // Empty string should be rejected
        phone: 'invalid-phone-format'
      };

      const response = await request(server)
        .put('/api/client/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_001');
      expect(response.body.error.details).toBeDefined();
    });

    it('should reject update with invalid profile photo URL', async () => {
      const invalidData = {
        profilePhoto: 'not-a-valid-url'
      };

      const response = await request(server)
        .put('/api/client/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_001');
    });

    it('should reject update without token', async () => {
      const updateData = { firstName: 'NoToken' };

      const response = await request(server)
        .put('/api/client/profile')
        .send(updateData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTH_001');
    });

    it('should reject update with brand token', async () => {
      const brandPayload: JwtPayload = {
        id: 'brand-id',
        type: 'brand',
        email: 'brand@test.com'
      };
      const brandToken = JwtUtils.generateAccessToken(brandPayload);

      const updateData = { firstName: 'BrandToken' };

      const response = await request(server)
        .put('/api/client/profile')
        .set('Authorization', `Bearer ${brandToken}`)
        .send(updateData)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTH_006');
    });

    it('should return 404 for non-existent client', async () => {
      // Delete the client but keep using the token
      await Client.deleteOne({ _id: clientId });

      const updateData = { firstName: 'NonExistent' };

      const response = await request(server)
        .put('/api/client/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('CLIENT_001');
    });

    it('should handle empty update gracefully', async () => {
      const response = await request(server)
        .put('/api/client/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.client.firstName).toBe('Profile'); // Should remain unchanged
    });
  });
});