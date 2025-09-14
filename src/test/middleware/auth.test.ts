import { Request, Response, NextFunction } from 'express';
import AuthMiddleware from '../../middleware/auth';
import JwtUtils, { JwtPayload } from '../../utils/jwt';

// Mock the JWT utils
jest.mock('../../utils/jwt');
const mockJwtUtils = JwtUtils as jest.Mocked<typeof JwtUtils>;

describe('AuthMiddleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  const mockBrandPayload: JwtPayload = {
    id: '507f1f77bcf86cd799439011',
    type: 'brand',
    email: 'brand@example.com',
  };

  const mockClientPayload: JwtPayload = {
    id: '507f1f77bcf86cd799439012',
    type: 'client',
    email: 'client@example.com',
  };

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    
    mockRequest = {
      headers: {},
      params: {},
      body: {},
    };
    
    mockResponse = {
      status: statusMock,
      json: jsonMock,
    };
    
    mockNext = jest.fn();
    
    // Reset mocks
    jest.clearAllMocks();
  });

  describe('authenticate', () => {
    it('should authenticate valid token and set user', () => {
      const token = 'valid-token';
      mockRequest.headers = { authorization: `Bearer ${token}` };
      
      mockJwtUtils.extractTokenFromHeader.mockReturnValue(token);
      mockJwtUtils.verifyAccessToken.mockReturnValue(mockBrandPayload);

      AuthMiddleware.authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockJwtUtils.extractTokenFromHeader).toHaveBeenCalledWith(`Bearer ${token}`);
      expect(mockJwtUtils.verifyAccessToken).toHaveBeenCalledWith(token);
      expect(mockRequest.user).toEqual(mockBrandPayload);
      expect(mockRequest.brand).toEqual(mockBrandPayload);
      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should set client when token is for client', () => {
      const token = 'valid-token';
      mockRequest.headers = { authorization: `Bearer ${token}` };
      
      mockJwtUtils.extractTokenFromHeader.mockReturnValue(token);
      mockJwtUtils.verifyAccessToken.mockReturnValue(mockClientPayload);

      AuthMiddleware.authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toEqual(mockClientPayload);
      expect(mockRequest.client).toEqual(mockClientPayload);
      expect(mockRequest.brand).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 401 when no authorization header', () => {
      mockJwtUtils.extractTokenFromHeader.mockReturnValue(null);

      AuthMiddleware.authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTH_001',
          message: 'Access token is required'
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when token extraction fails', () => {
      mockRequest.headers = { authorization: 'Invalid header' };
      mockJwtUtils.extractTokenFromHeader.mockReturnValue(null);

      AuthMiddleware.authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTH_001',
          message: 'Access token is required'
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when token verification fails', () => {
      const token = 'invalid-token';
      mockRequest.headers = { authorization: `Bearer ${token}` };
      
      mockJwtUtils.extractTokenFromHeader.mockReturnValue(token);
      mockJwtUtils.verifyAccessToken.mockImplementation(() => {
        throw new Error('Token verification failed');
      });

      AuthMiddleware.authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTH_002',
          message: 'Authentication failed'
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 with expired token error', () => {
      const token = 'expired-token';
      mockRequest.headers = { authorization: `Bearer ${token}` };
      
      mockJwtUtils.extractTokenFromHeader.mockReturnValue(token);
      mockJwtUtils.verifyAccessToken.mockImplementation(() => {
        throw new Error('Access token expired');
      });

      AuthMiddleware.authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTH_003',
          message: 'Access token expired'
        }
      });
    });
  });

  describe('requireBrand', () => {
    it('should allow access for authenticated brand', () => {
      mockRequest.user = mockBrandPayload;

      AuthMiddleware.requireBrand(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should deny access when no user is authenticated', () => {
      AuthMiddleware.requireBrand(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTH_001',
          message: 'Authentication required'
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should deny access for client user', () => {
      mockRequest.user = mockClientPayload;

      AuthMiddleware.requireBrand(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTH_005',
          message: 'Brand access required'
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requireClient', () => {
    it('should allow access for authenticated client', () => {
      mockRequest.user = mockClientPayload;

      AuthMiddleware.requireClient(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should deny access when no user is authenticated', () => {
      AuthMiddleware.requireClient(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTH_001',
          message: 'Authentication required'
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should deny access for brand user', () => {
      mockRequest.user = mockBrandPayload;

      AuthMiddleware.requireClient(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTH_006',
          message: 'Client access required'
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('optionalAuth', () => {
    it('should set user when valid token is provided', () => {
      const token = 'valid-token';
      mockRequest.headers = { authorization: `Bearer ${token}` };
      
      mockJwtUtils.extractTokenFromHeader.mockReturnValue(token);
      mockJwtUtils.verifyAccessToken.mockReturnValue(mockBrandPayload);

      AuthMiddleware.optionalAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toEqual(mockBrandPayload);
      expect(mockRequest.brand).toEqual(mockBrandPayload);
      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should proceed without user when no token is provided', () => {
      mockJwtUtils.extractTokenFromHeader.mockReturnValue(null);

      AuthMiddleware.optionalAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should proceed without user when token is invalid', () => {
      const token = 'invalid-token';
      mockRequest.headers = { authorization: `Bearer ${token}` };
      
      mockJwtUtils.extractTokenFromHeader.mockReturnValue(token);
      mockJwtUtils.verifyAccessToken.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      AuthMiddleware.optionalAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });
  });

  describe('requireResourceOwnership', () => {
    it('should allow access when user owns the resource', () => {
      mockRequest.user = mockBrandPayload;
      mockRequest.params = { brandId: mockBrandPayload.id };

      const middleware = AuthMiddleware.requireResourceOwnership('brandId');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should allow access when no resource ID is provided', () => {
      mockRequest.user = mockBrandPayload;
      mockRequest.params = {};

      const middleware = AuthMiddleware.requireResourceOwnership('brandId');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should deny access when user does not own the resource', () => {
      mockRequest.user = mockBrandPayload;
      mockRequest.params = { brandId: 'different-brand-id' };

      const middleware = AuthMiddleware.requireResourceOwnership('brandId');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTH_007',
          message: 'Access denied: insufficient permissions'
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should deny access for non-brand user', () => {
      mockRequest.user = mockClientPayload;
      mockRequest.params = { brandId: 'some-brand-id' };

      const middleware = AuthMiddleware.requireResourceOwnership('brandId');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTH_005',
          message: 'Brand access required'
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should check resource ID in body when not in params', () => {
      mockRequest.user = mockBrandPayload;
      mockRequest.params = {};
      mockRequest.body = { brandId: mockBrandPayload.id };

      const middleware = AuthMiddleware.requireResourceOwnership('brandId');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });
  });

  describe('validateRefreshToken', () => {
    it('should validate valid refresh token', () => {
      const refreshToken = 'valid-refresh-token';
      mockRequest.body = { refreshToken };
      
      mockJwtUtils.verifyRefreshToken.mockReturnValue(mockBrandPayload);

      AuthMiddleware.validateRefreshToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockJwtUtils.verifyRefreshToken).toHaveBeenCalledWith(refreshToken);
      expect(mockRequest.user).toEqual(mockBrandPayload);
      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should return 400 when refresh token is missing', () => {
      mockRequest.body = {};

      AuthMiddleware.validateRefreshToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTH_008',
          message: 'Refresh token is required'
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when refresh token is invalid', () => {
      const refreshToken = 'invalid-refresh-token';
      mockRequest.body = { refreshToken };
      
      mockJwtUtils.verifyRefreshToken.mockImplementation(() => {
        throw new Error('Invalid refresh token');
      });

      AuthMiddleware.validateRefreshToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTH_009',
          message: 'Invalid refresh token'
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when refresh token is expired', () => {
      const refreshToken = 'expired-refresh-token';
      mockRequest.body = { refreshToken };
      
      mockJwtUtils.verifyRefreshToken.mockImplementation(() => {
        throw new Error('Refresh token expired');
      });

      AuthMiddleware.validateRefreshToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTH_010',
          message: 'Refresh token expired'
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('combined middleware arrays', () => {
    it('should have brandAuth with correct middleware', () => {
      expect(AuthMiddleware.brandAuth).toHaveLength(2);
      expect(AuthMiddleware.brandAuth[0]).toBe(AuthMiddleware.authenticate);
      expect(AuthMiddleware.brandAuth[1]).toBe(AuthMiddleware.requireBrand);
    });

    it('should have clientAuth with correct middleware', () => {
      expect(AuthMiddleware.clientAuth).toHaveLength(2);
      expect(AuthMiddleware.clientAuth[0]).toBe(AuthMiddleware.authenticate);
      expect(AuthMiddleware.clientAuth[1]).toBe(AuthMiddleware.requireClient);
    });
  });
});