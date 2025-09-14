import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import App from '../../app';
import { Brand } from '../../models/Brand';
import { PasswordUtils } from '../../utils/auth';

describe('Brand Authentication Integration Tests', () => {
  let app: App;
  let mongoServer: MongoMemoryServer;
  let server: any;

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
  });

  describe('POST /api/auth/brand/register', () => {
    const validBrandData = {
      name: 'Test Fitness Studio',
      email: 'test@studio.com',
      password: 'TestPass123!',
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
      ]
    };

    it('should register a new brand successfully', async () => {
      const response = await request(server)
        .post('/api/auth/brand/register')
        .send(validBrandData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Brand registered successfully');
      expect(response.body.data.brand).toBeDefined();
      expect(response.body.data.brand.email).toBe(validBrandData.email);
      expect(response.body.data.brand.name).toBe(validBrandData.name);
      expect(response.body.data.brand.password).toBeUndefined(); // Should be excluded
      expect(response.body.data.tokens).toBeDefined();
      expect(response.body.data.tokens.accessToken).toBeDefined();
      expect(response.body.data.tokens.refreshToken).toBeDefined();

      // Verify brand was created in database
      const brand = await Brand.findOne({ email: validBrandData.email });
      expect(brand).toBeTruthy();
      expect(brand?.name).toBe(validBrandData.name);
      expect(brand?.status).toBe('active');
    });

    it('should reject registration with invalid email', async () => {
      const invalidData = { ...validBrandData, email: 'invalid-email' };

      const response = await request(server)
        .post('/api/auth/brand/register')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_001');
      expect(response.body.error.details).toBeDefined();
    });

    it('should reject registration with weak password', async () => {
      const invalidData = { ...validBrandData, password: 'weak' };

      const response = await request(server)
        .post('/api/auth/brand/register')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_001');
    });

    it('should reject registration with missing required fields', async () => {
      const invalidData = { email: 'test@example.com', password: 'TestPass123!' };

      const response = await request(server)
        .post('/api/auth/brand/register')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_001');
    });

    it('should reject registration with duplicate email', async () => {
      // First registration
      await request(server)
        .post('/api/auth/brand/register')
        .send(validBrandData)
        .expect(201);

      // Second registration with same email
      const response = await request(server)
        .post('/api/auth/brand/register')
        .send(validBrandData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTH_011');
      expect(response.body.error.message).toBe('Brand with this email already exists');
    });

    it('should reject registration with invalid business hours', async () => {
      const invalidData = {
        ...validBrandData,
        businessHours: [
          {
            day: 'monday',
            openTime: '22:00',
            closeTime: '06:00', // Close time before open time
            isClosed: false
          }
        ]
      };

      const response = await request(server)
        .post('/api/auth/brand/register')
        .send(invalidData)
        .expect(500); // This will be caught by Mongoose validation

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/brand/login', () => {
    let testBrand: any;

    beforeEach(async () => {
      // Create a test brand
      const hashedPassword = await PasswordUtils.hashPassword('TestPass123!');
      testBrand = await Brand.create({
        name: 'Test Studio',
        email: 'test@studio.com',
        password: hashedPassword,
        address: {
          street: '123 Main St',
          city: 'Test City',
          state: 'TS',
          zipCode: '12345',
          country: 'US'
        },
        status: 'active'
      });
    });

    it('should login successfully with valid credentials', async () => {
      const loginData = {
        email: 'test@studio.com',
        password: 'TestPass123!'
      };

      const response = await request(server)
        .post('/api/auth/brand/login')
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Login successful');
      expect(response.body.data.brand).toBeDefined();
      expect(response.body.data.brand.email).toBe(loginData.email);
      expect(response.body.data.brand.password).toBeUndefined();
      expect(response.body.data.tokens).toBeDefined();
      expect(response.body.data.tokens.accessToken).toBeDefined();
      expect(response.body.data.tokens.refreshToken).toBeDefined();
    });

    it('should reject login with invalid email', async () => {
      const loginData = {
        email: 'nonexistent@studio.com',
        password: 'TestPass123!'
      };

      const response = await request(server)
        .post('/api/auth/brand/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTH_012');
      expect(response.body.error.message).toBe('Invalid email or password');
    });

    it('should reject login with invalid password', async () => {
      const loginData = {
        email: 'test@studio.com',
        password: 'WrongPassword123!'
      };

      const response = await request(server)
        .post('/api/auth/brand/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTH_012');
      expect(response.body.error.message).toBe('Invalid email or password');
    });

    it('should reject login for inactive brand', async () => {
      // Update brand status to inactive
      await Brand.findByIdAndUpdate(testBrand._id, { status: 'inactive' });

      const loginData = {
        email: 'test@studio.com',
        password: 'TestPass123!'
      };

      const response = await request(server)
        .post('/api/auth/brand/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTH_012');
    });

    it('should reject login with invalid email format', async () => {
      const loginData = {
        email: 'invalid-email',
        password: 'TestPass123!'
      };

      const response = await request(server)
        .post('/api/auth/brand/login')
        .send(loginData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_001');
    });

    it('should reject login with missing fields', async () => {
      const loginData = {
        email: 'test@studio.com'
        // Missing password
      };

      const response = await request(server)
        .post('/api/auth/brand/login')
        .send(loginData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_001');
    });
  });

  describe('POST /api/auth/brand/refresh', () => {
    let testBrand: any;
    let refreshToken: string;

    beforeEach(async () => {
      // Create a test brand and get tokens
      const hashedPassword = await PasswordUtils.hashPassword('TestPass123!');
      testBrand = await Brand.create({
        name: 'Test Studio',
        email: 'test@studio.com',
        password: hashedPassword,
        address: {
          street: '123 Main St',
          city: 'Test City',
          state: 'TS',
          zipCode: '12345',
          country: 'US'
        },
        status: 'active'
      });

      // Login to get refresh token
      const loginResponse = await request(server)
        .post('/api/auth/brand/login')
        .send({
          email: 'test@studio.com',
          password: 'TestPass123!'
        });

      refreshToken = loginResponse.body.data.tokens.refreshToken;
    });

    it('should refresh access token successfully', async () => {
      const response = await request(server)
        .post('/api/auth/brand/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Token refreshed successfully');
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.expiresIn).toBeDefined();
    });

    it('should reject refresh with invalid token', async () => {
      const response = await request(server)
        .post('/api/auth/brand/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTH_009');
    });

    it('should reject refresh with missing token', async () => {
      const response = await request(server)
        .post('/api/auth/brand/refresh')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_001');
    });

    it('should reject refresh for inactive brand', async () => {
      // Update brand status to inactive
      await Brand.findByIdAndUpdate(testBrand._id, { status: 'inactive' });

      const response = await request(server)
        .post('/api/auth/brand/refresh')
        .send({ refreshToken })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTH_013');
    });
  });
});