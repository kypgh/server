import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import App from '../../app';
import { Client } from '../../models/Client';
import { PasswordUtils } from '../../utils/auth';

describe('Client Authentication Integration Tests', () => {
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
    await Client.deleteMany({});
  });

  describe('POST /api/auth/client/register', () => {
    const validClientData = {
      email: 'test@client.com',
      password: 'TestPass123!',
      firstName: 'John',
      lastName: 'Doe',
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
      }
    };

    it('should register a new client successfully', async () => {
      const response = await request(server)
        .post('/api/auth/client/register')
        .send(validClientData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Client registered successfully');
      expect(response.body.data.client).toBeDefined();
      expect(response.body.data.client.email).toBe(validClientData.email);
      expect(response.body.data.client.firstName).toBe(validClientData.firstName);
      expect(response.body.data.client.lastName).toBe(validClientData.lastName);
      expect(response.body.data.client.fullName).toBe('John Doe');
      expect(response.body.data.client.password).toBeUndefined(); // Should be excluded
      expect(response.body.data.tokens).toBeDefined();
      expect(response.body.data.tokens.accessToken).toBeDefined();
      expect(response.body.data.tokens.refreshToken).toBeDefined();

      // Verify client was created in database
      const client = await Client.findOne({ email: validClientData.email });
      expect(client).toBeTruthy();
      expect(client?.firstName).toBe(validClientData.firstName);
      expect(client?.lastName).toBe(validClientData.lastName);
      expect(client?.status).toBe('active');
      expect(client?.preferences.favoriteCategories).toEqual(['yoga', 'pilates']);
      expect(client?.preferences.preferredDifficulty).toBe('intermediate');
    });

    it('should register a client with minimal required data', async () => {
      const minimalData = {
        email: 'minimal@client.com',
        password: 'TestPass123!',
        firstName: 'Jane',
        lastName: 'Smith'
      };

      const response = await request(server)
        .post('/api/auth/client/register')
        .send(minimalData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.client.email).toBe(minimalData.email);
      expect(response.body.data.client.preferences).toBeDefined();
      expect(response.body.data.client.preferences.notifications.email).toBe(true);
      expect(response.body.data.client.preferences.timezone).toBe('UTC');
    });

    it('should reject registration with invalid email', async () => {
      const invalidData = { ...validClientData, email: 'invalid-email' };

      const response = await request(server)
        .post('/api/auth/client/register')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_001');
      expect(response.body.error.details).toBeDefined();
    });

    it('should reject registration with weak password', async () => {
      const invalidData = { ...validClientData, password: 'weak' };

      const response = await request(server)
        .post('/api/auth/client/register')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_001');
    });

    it('should reject registration with missing required fields', async () => {
      const invalidData = { email: 'test@example.com', password: 'TestPass123!' };

      const response = await request(server)
        .post('/api/auth/client/register')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_001');
    });

    it('should reject registration with invalid phone number', async () => {
      const invalidData = { ...validClientData, phone: 'invalid-phone' };

      const response = await request(server)
        .post('/api/auth/client/register')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_001');
    });

    it('should reject registration with duplicate email', async () => {
      // First registration
      await request(server)
        .post('/api/auth/client/register')
        .send(validClientData)
        .expect(201);

      // Second registration with same email
      const response = await request(server)
        .post('/api/auth/client/register')
        .send(validClientData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTH_021');
      expect(response.body.error.message).toBe('Client with this email already exists');
    });
  });

  describe('POST /api/auth/client/login', () => {
    const clientData = {
      email: 'login@client.com',
      password: 'TestPass123!',
      firstName: 'Login',
      lastName: 'Test'
    };

    beforeEach(async () => {
      // Create a client for login tests
      const hashedPassword = await PasswordUtils.hashPassword(clientData.password);
      await Client.create({
        ...clientData,
        password: hashedPassword,
        status: 'active'
      });
    });

    it('should login with valid credentials', async () => {
      const response = await request(server)
        .post('/api/auth/client/login')
        .send({
          email: clientData.email,
          password: clientData.password
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Login successful');
      expect(response.body.data.client).toBeDefined();
      expect(response.body.data.client.email).toBe(clientData.email);
      expect(response.body.data.client.password).toBeUndefined();
      expect(response.body.data.tokens).toBeDefined();
      expect(response.body.data.tokens.accessToken).toBeDefined();
      expect(response.body.data.tokens.refreshToken).toBeDefined();
    });

    it('should reject login with invalid email', async () => {
      const response = await request(server)
        .post('/api/auth/client/login')
        .send({
          email: 'nonexistent@client.com',
          password: clientData.password
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTH_022');
      expect(response.body.error.message).toBe('Invalid email or password');
    });

    it('should reject login with invalid password', async () => {
      const response = await request(server)
        .post('/api/auth/client/login')
        .send({
          email: clientData.email,
          password: 'WrongPassword123!'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTH_022');
      expect(response.body.error.message).toBe('Invalid email or password');
    });

    it('should reject login with missing credentials', async () => {
      const response = await request(server)
        .post('/api/auth/client/login')
        .send({
          email: clientData.email
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_001');
    });

    it('should reject login for inactive client', async () => {
      // Set client to inactive
      await Client.updateOne({ email: clientData.email }, { status: 'inactive' });

      const response = await request(server)
        .post('/api/auth/client/login')
        .send({
          email: clientData.email,
          password: clientData.password
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTH_022');
    });
  });

  describe('POST /api/auth/client/refresh', () => {
    let refreshToken: string;
    let clientId: string;

    beforeEach(async () => {
      // Create a client and get tokens
      const clientData = {
        email: 'refresh@client.com',
        password: 'TestPass123!',
        firstName: 'Refresh',
        lastName: 'Test'
      };

      const response = await request(server)
        .post('/api/auth/client/register')
        .send(clientData);

      refreshToken = response.body.data.tokens.refreshToken;
      clientId = response.body.data.client._id;
    });

    it('should refresh access token with valid refresh token', async () => {
      const response = await request(server)
        .post('/api/auth/client/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Token refreshed successfully');
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.expiresIn).toBeDefined();
    });

    it('should reject refresh with invalid token', async () => {
      const response = await request(server)
        .post('/api/auth/client/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTH_009');
    });

    it('should reject refresh with missing token', async () => {
      const response = await request(server)
        .post('/api/auth/client/refresh')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_001');
    });

    it('should reject refresh for inactive client', async () => {
      // Set client to inactive
      await Client.updateOne({ _id: clientId }, { status: 'inactive' });

      const response = await request(server)
        .post('/api/auth/client/refresh')
        .send({ refreshToken })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTH_023');
      expect(response.body.error.message).toBe('Client account not found or inactive');
    });
  });
});