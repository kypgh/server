import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import App from '../../app';
import { Brand } from '../../models/Brand';
import { PasswordUtils, JwtUtils } from '../../utils/auth';

describe('Brand Profile Management Integration Tests', () => {
  let app: App;
  let mongoServer: MongoMemoryServer;
  let server: any;
  let testBrand: any;
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
    await Brand.deleteMany({});

    // Create a test brand
    const hashedPassword = await PasswordUtils.hashPassword('TestPass123!');
    testBrand = await Brand.create({
      name: 'Test Fitness Studio',
      email: 'test@studio.com',
      password: hashedPassword,
      description: 'A test fitness studio',
      address: {
        street: '123 Main St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        country: 'US'
      },
      contact: {
        phone: '+1-555-123-4567',
        website: 'https://teststudio.com',
        socialMedia: {
          instagram: '@teststudio',
          facebook: 'teststudio',
          twitter: '@teststudio'
        }
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
          isClosed: true
        }
      ],
      status: 'active'
    });

    // Generate access token
    accessToken = JwtUtils.generateAccessToken({
      id: testBrand._id.toString(),
      type: 'brand',
      email: testBrand.email
    });
  });

  describe('GET /api/brand/profile', () => {
    it('should get brand profile successfully', async () => {
      const response = await request(server)
        .get('/api/brand/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Brand profile retrieved successfully');
      expect(response.body.data.brand).toBeDefined();
      expect(response.body.data.brand.email).toBe(testBrand.email);
      expect(response.body.data.brand.name).toBe(testBrand.name);
      expect(response.body.data.brand.password).toBeUndefined(); // Should be excluded
      expect(response.body.data.brand.address).toBeDefined();
      expect(response.body.data.brand.contact).toBeDefined();
      expect(response.body.data.brand.businessHours).toBeDefined();
    });

    it('should reject request without authentication token', async () => {
      const response = await request(server)
        .get('/api/brand/profile')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTH_001');
    });

    it('should reject request with invalid token', async () => {
      const response = await request(server)
        .get('/api/brand/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTH_002');
    });

    it('should reject request for non-existent brand', async () => {
      // Delete the brand
      await Brand.findByIdAndDelete(testBrand._id);

      const response = await request(server)
        .get('/api/brand/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('BRAND_001');
    });

    it('should reject request for inactive brand', async () => {
      // Update brand status to inactive
      await Brand.findByIdAndUpdate(testBrand._id, { status: 'inactive' });

      const response = await request(server)
        .get('/api/brand/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('BRAND_002');
    });

    it('should reject client token for brand endpoint', async () => {
      // Generate client token
      const clientToken = JwtUtils.generateAccessToken({
        id: testBrand._id.toString(),
        type: 'client',
        email: 'client@example.com'
      });

      const response = await request(server)
        .get('/api/brand/profile')
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTH_005');
    });
  });

  describe('PUT /api/brand/profile', () => {
    it('should update brand profile successfully', async () => {
      const updateData = {
        name: 'Updated Fitness Studio',
        description: 'An updated description',
        logo: 'https://example.com/new-logo.png',
        address: {
          street: '456 New St',
          city: 'New City',
          state: 'NC',
          zipCode: '54321'
        },
        contact: {
          phone: '+1-555-987-6543',
          website: 'https://newstudio.com',
          socialMedia: {
            instagram: '@newstudio',
            facebook: 'newstudio'
          }
        },
        businessHours: [
          {
            day: 'monday',
            openTime: '05:00',
            closeTime: '23:00',
            isClosed: false
          },
          {
            day: 'tuesday',
            openTime: '06:00',
            closeTime: '22:00',
            isClosed: false
          }
        ]
      };

      const response = await request(server)
        .put('/api/brand/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Brand profile updated successfully');
      expect(response.body.data.brand.name).toBe(updateData.name);
      expect(response.body.data.brand.description).toBe(updateData.description);
      expect(response.body.data.brand.logo).toBe(updateData.logo);
      expect(response.body.data.brand.address.street).toBe(updateData.address.street);
      expect(response.body.data.brand.contact.phone).toBe(updateData.contact.phone);
      expect(response.body.data.brand.businessHours).toHaveLength(2);

      // Verify in database
      const updatedBrand = await Brand.findById(testBrand._id);
      expect(updatedBrand?.name).toBe(updateData.name);
      expect(updatedBrand?.description).toBe(updateData.description);
    });

    it('should update partial brand profile successfully', async () => {
      const updateData = {
        name: 'Partially Updated Studio',
        contact: {
          phone: '+1-555-111-2222'
        }
      };

      const response = await request(server)
        .put('/api/brand/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.brand.name).toBe(updateData.name);
      expect(response.body.data.brand.contact.phone).toBe(updateData.contact.phone);
      // Other fields should remain unchanged
      expect(response.body.data.brand.email).toBe(testBrand.email);
      expect(response.body.data.brand.address.street).toBe(testBrand.address.street);
    });

    it('should reject update without authentication token', async () => {
      const updateData = { name: 'Updated Studio' };

      const response = await request(server)
        .put('/api/brand/profile')
        .send(updateData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTH_001');
    });

    it('should reject update with invalid data', async () => {
      const updateData = {
        name: 'A', // Too short
        contact: {
          phone: 'invalid-phone',
          website: 'not-a-url'
        }
      };

      const response = await request(server)
        .put('/api/brand/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_001');
      expect(response.body.error.details).toBeDefined();
    });

    it('should reject update for non-existent brand', async () => {
      // Delete the brand
      await Brand.findByIdAndDelete(testBrand._id);

      const updateData = { name: 'Updated Studio' };

      const response = await request(server)
        .put('/api/brand/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('BRAND_001');
    });

    it('should reject update for inactive brand', async () => {
      // Update brand status to inactive
      await Brand.findByIdAndUpdate(testBrand._id, { status: 'inactive' });

      const updateData = { name: 'Updated Studio' };

      const response = await request(server)
        .put('/api/brand/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('BRAND_002');
    });

    it('should reject update with invalid business hours', async () => {
      const updateData = {
        businessHours: [
          {
            day: 'monday',
            openTime: '25:00', // Invalid time
            closeTime: '22:00',
            isClosed: false
          }
        ]
      };

      const response = await request(server)
        .put('/api/brand/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_001');
    });

    it('should handle empty update gracefully', async () => {
      const response = await request(server)
        .put('/api/brand/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.brand.name).toBe(testBrand.name); // Should remain unchanged
    });
  });
});