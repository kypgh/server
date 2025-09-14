import { Request, Response, NextFunction } from 'express';
import JwtUtils, { JwtPayload } from '../utils/jwt';

// Extend Express Request interface to include user information
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      brand?: JwtPayload;
      client?: JwtPayload;
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

class AuthMiddleware {
  /**
   * Generic authentication middleware that verifies JWT token
   */
  public static authenticate = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const authHeader = req.headers.authorization;
      const token = JwtUtils.extractTokenFromHeader(authHeader);

      if (!token) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTH_001',
            message: 'Access token is required'
          }
        });
        return;
      }

      const decoded = JwtUtils.verifyAccessToken(token);
      req.user = decoded;
      
      // Also set specific user type for convenience
      if (decoded.type === 'brand') {
        req.brand = decoded;
      } else if (decoded.type === 'client') {
        req.client = decoded;
      }

      next();
    } catch (error) {
      let errorMessage = 'Authentication failed';
      let errorCode = 'AUTH_002';

      if (error instanceof Error) {
        if (error.message.includes('expired')) {
          errorMessage = 'Access token expired';
          errorCode = 'AUTH_003';
        } else if (error.message.includes('invalid')) {
          errorMessage = 'Invalid access token';
          errorCode = 'AUTH_004';
        }
      }

      res.status(401).json({
        success: false,
        error: {
          code: errorCode,
          message: errorMessage
        }
      });
    }
  };

  /**
   * Middleware to ensure the authenticated user is a brand
   */
  public static requireBrand = (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_001',
          message: 'Authentication required'
        }
      });
      return;
    }

    if (req.user.type !== 'brand') {
      res.status(403).json({
        success: false,
        error: {
          code: 'AUTH_005',
          message: 'Brand access required'
        }
      });
      return;
    }

    next();
  };

  /**
   * Middleware to ensure the authenticated user is a client
   */
  public static requireClient = (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_001',
          message: 'Authentication required'
        }
      });
      return;
    }

    if (req.user.type !== 'client') {
      res.status(403).json({
        success: false,
        error: {
          code: 'AUTH_006',
          message: 'Client access required'
        }
      });
      return;
    }

    next();
  };

  /**
   * Combined middleware for brand authentication and authorization
   */
  public static brandAuth = [
    AuthMiddleware.authenticate,
    AuthMiddleware.requireBrand
  ];

  /**
   * Combined middleware for client authentication and authorization
   */
  public static clientAuth = [
    AuthMiddleware.authenticate,
    AuthMiddleware.requireClient
  ];

  /**
   * Optional authentication middleware - doesn't fail if no token provided
   */
  public static optionalAuth = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const authHeader = req.headers.authorization;
      const token = JwtUtils.extractTokenFromHeader(authHeader);

      if (token) {
        const decoded = JwtUtils.verifyAccessToken(token);
        req.user = decoded;
        
        if (decoded.type === 'brand') {
          req.brand = decoded;
        } else if (decoded.type === 'client') {
          req.client = decoded;
        }
      }

      next();
    } catch (error) {
      // For optional auth, we don't fail on invalid tokens
      // Just proceed without setting user
      next();
    }
  };

  /**
   * Middleware to check if user owns the resource (for brand-specific resources)
   */
  public static requireResourceOwnership = (resourceIdParam: string = 'brandId') => {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user || req.user.type !== 'brand') {
        res.status(403).json({
          success: false,
          error: {
            code: 'AUTH_005',
            message: 'Brand access required'
          }
        });
        return;
      }

      const resourceId = req.params[resourceIdParam] || req.body[resourceIdParam];
      
      if (resourceId && resourceId !== req.user.id) {
        res.status(403).json({
          success: false,
          error: {
            code: 'AUTH_007',
            message: 'Access denied: insufficient permissions'
          }
        });
        return;
      }

      next();
    };
  };

  /**
   * Middleware to validate refresh token
   */
  public static validateRefreshToken = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({
          success: false,
          error: {
            code: 'AUTH_008',
            message: 'Refresh token is required'
          }
        });
        return;
      }

      const decoded = JwtUtils.verifyRefreshToken(refreshToken);
      req.user = decoded;
      next();
    } catch (error) {
      let errorMessage = 'Invalid refresh token';
      let errorCode = 'AUTH_009';

      if (error instanceof Error && error.message.includes('expired')) {
        errorMessage = 'Refresh token expired';
        errorCode = 'AUTH_010';
      }

      res.status(401).json({
        success: false,
        error: {
          code: errorCode,
          message: errorMessage
        }
      });
    }
  };
}

export default AuthMiddleware;