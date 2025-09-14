import JwtUtils, { JwtPayload } from '../../utils/jwt';
import config from '../../config/environment';

// Mock the config to use test values
jest.mock('../../config/environment', () => ({
  jwt: {
    accessSecret: 'test-access-secret',
    refreshSecret: 'test-refresh-secret',
    accessExpiresIn: '15m',
    refreshExpiresIn: '7d',
    issuer: 'test-issuer',
    audience: 'test-audience',
  },
}));

describe('JwtUtils', () => {
  const mockPayload: JwtPayload = {
    id: '507f1f77bcf86cd799439011',
    type: 'brand',
    email: 'test@example.com',
  };

  describe('generateAccessToken', () => {
    it('should generate a valid access token', () => {
      const token = JwtUtils.generateAccessToken(mockPayload);
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should generate different tokens for different payloads', () => {
      const payload1: JwtPayload = { ...mockPayload, id: 'id1' };
      const payload2: JwtPayload = { ...mockPayload, id: 'id2' };
      
      const token1 = JwtUtils.generateAccessToken(payload1);
      const token2 = JwtUtils.generateAccessToken(payload2);
      
      expect(token1).not.toBe(token2);
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid refresh token', () => {
      const token = JwtUtils.generateRefreshToken(mockPayload);
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('should generate different refresh tokens than access tokens', () => {
      const accessToken = JwtUtils.generateAccessToken(mockPayload);
      const refreshToken = JwtUtils.generateRefreshToken(mockPayload);
      
      expect(accessToken).not.toBe(refreshToken);
    });
  });

  describe('generateTokenPair', () => {
    it('should generate both access and refresh tokens', () => {
      const tokenPair = JwtUtils.generateTokenPair(mockPayload);
      
      expect(tokenPair).toHaveProperty('accessToken');
      expect(tokenPair).toHaveProperty('refreshToken');
      expect(typeof tokenPair.accessToken).toBe('string');
      expect(typeof tokenPair.refreshToken).toBe('string');
      expect(tokenPair.accessToken).not.toBe(tokenPair.refreshToken);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify a valid access token', () => {
      const token = JwtUtils.generateAccessToken(mockPayload);
      const decoded = JwtUtils.verifyAccessToken(token);
      
      expect(decoded.id).toBe(mockPayload.id);
      expect(decoded.type).toBe(mockPayload.type);
      expect(decoded.email).toBe(mockPayload.email);
    });

    it('should throw error for invalid token', () => {
      expect(() => {
        JwtUtils.verifyAccessToken('invalid-token');
      }).toThrow('Invalid access token');
    });

    it('should throw error for refresh token used as access token', () => {
      const refreshToken = JwtUtils.generateRefreshToken(mockPayload);
      
      expect(() => {
        JwtUtils.verifyAccessToken(refreshToken);
      }).toThrow('Invalid access token');
    });

    it('should throw error for empty token', () => {
      expect(() => {
        JwtUtils.verifyAccessToken('');
      }).toThrow('Invalid access token');
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify a valid refresh token', () => {
      const token = JwtUtils.generateRefreshToken(mockPayload);
      const decoded = JwtUtils.verifyRefreshToken(token);
      
      expect(decoded.id).toBe(mockPayload.id);
      expect(decoded.type).toBe(mockPayload.type);
      expect(decoded.email).toBe(mockPayload.email);
    });

    it('should throw error for invalid token', () => {
      expect(() => {
        JwtUtils.verifyRefreshToken('invalid-token');
      }).toThrow('Invalid refresh token');
    });

    it('should throw error for access token used as refresh token', () => {
      const accessToken = JwtUtils.generateAccessToken(mockPayload);
      
      expect(() => {
        JwtUtils.verifyRefreshToken(accessToken);
      }).toThrow('Invalid refresh token');
    });
  });

  describe('extractTokenFromHeader', () => {
    it('should extract token from valid Bearer header', () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
      const header = `Bearer ${token}`;
      
      const extracted = JwtUtils.extractTokenFromHeader(header);
      expect(extracted).toBe(token);
    });

    it('should return null for undefined header', () => {
      const extracted = JwtUtils.extractTokenFromHeader(undefined);
      expect(extracted).toBeNull();
    });

    it('should return null for invalid header format', () => {
      expect(JwtUtils.extractTokenFromHeader('InvalidHeader')).toBeNull();
      expect(JwtUtils.extractTokenFromHeader('Basic token')).toBeNull();
      expect(JwtUtils.extractTokenFromHeader('Bearer')).toBeNull();
      expect(JwtUtils.extractTokenFromHeader('Bearer token extra')).toBeNull();
    });

    it('should return null for empty header', () => {
      const extracted = JwtUtils.extractTokenFromHeader('');
      expect(extracted).toBeNull();
    });
  });

  describe('getTokenExpiration', () => {
    it('should return expiration date for valid token', () => {
      const token = JwtUtils.generateAccessToken(mockPayload);
      const expiration = JwtUtils.getTokenExpiration(token);
      
      expect(expiration).toBeInstanceOf(Date);
      expect(expiration!.getTime()).toBeGreaterThan(Date.now());
    });

    it('should return null for invalid token', () => {
      const expiration = JwtUtils.getTokenExpiration('invalid-token');
      expect(expiration).toBeNull();
    });

    it('should return null for empty token', () => {
      const expiration = JwtUtils.getTokenExpiration('');
      expect(expiration).toBeNull();
    });
  });

  describe('isTokenExpired', () => {
    it('should return false for valid non-expired token', () => {
      const token = JwtUtils.generateAccessToken(mockPayload);
      const isExpired = JwtUtils.isTokenExpired(token);
      
      expect(isExpired).toBe(false);
    });

    it('should return true for invalid token', () => {
      const isExpired = JwtUtils.isTokenExpired('invalid-token');
      expect(isExpired).toBe(true);
    });

    it('should return true for empty token', () => {
      const isExpired = JwtUtils.isTokenExpired('');
      expect(isExpired).toBe(true);
    });
  });

  describe('token integration', () => {
    it('should create and verify token round trip', () => {
      const originalPayload = mockPayload;
      const token = JwtUtils.generateAccessToken(originalPayload);
      const decodedPayload = JwtUtils.verifyAccessToken(token);
      
      expect(decodedPayload.id).toBe(originalPayload.id);
      expect(decodedPayload.type).toBe(originalPayload.type);
      expect(decodedPayload.email).toBe(originalPayload.email);
    });

    it('should handle different user types', () => {
      const brandPayload: JwtPayload = { ...mockPayload, type: 'brand' };
      const clientPayload: JwtPayload = { ...mockPayload, type: 'client' };
      
      const brandToken = JwtUtils.generateAccessToken(brandPayload);
      const clientToken = JwtUtils.generateAccessToken(clientPayload);
      
      const decodedBrand = JwtUtils.verifyAccessToken(brandToken);
      const decodedClient = JwtUtils.verifyAccessToken(clientToken);
      
      expect(decodedBrand.type).toBe('brand');
      expect(decodedClient.type).toBe('client');
    });
  });
});