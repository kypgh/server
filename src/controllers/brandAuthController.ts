import { Request, Response } from 'express';
import { Brand, IBrand } from '../models/Brand';
import { PasswordUtils, JwtUtils, JwtPayload } from '../utils/auth';
import { 
  brandRegistrationSchema, 
  brandLoginSchema, 
  refreshTokenSchema 
} from '../validation/brandAuth';

interface BrandRegistrationRequest {
  name: string;
  email: string;
  password: string;
  description?: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country?: string;
  };
  contact?: {
    phone?: string;
    website?: string;
    socialMedia?: {
      instagram?: string;
      facebook?: string;
      twitter?: string;
    };
  };
  businessHours?: Array<{
    day: string;
    openTime?: string;
    closeTime?: string;
    isClosed: boolean;
  }>;
}

interface BrandLoginRequest {
  email: string;
  password: string;
}

interface RefreshTokenRequest {
  refreshToken: string;
}

class BrandAuthController {
  /**
   * Register a new brand
   */
  public static async register(req: Request, res: Response): Promise<void> {
    try {
      // Validate request body
      const { error, value } = brandRegistrationSchema.validate(req.body, { 
        abortEarly: false,
        stripUnknown: true 
      });

      if (error) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_001',
            message: 'Invalid input data',
            details: error.details.map(detail => ({
              field: detail.path.join('.'),
              message: detail.message
            }))
          }
        });
        return;
      }

      const brandData: BrandRegistrationRequest = value;

      // Check if brand with email already exists
      const existingBrand = await Brand.findOne({ email: brandData.email });
      if (existingBrand) {
        res.status(409).json({
          success: false,
          error: {
            code: 'AUTH_011',
            message: 'Brand with this email already exists'
          }
        });
        return;
      }

      // Hash password
      const hashedPassword = await PasswordUtils.hashPassword(brandData.password);

      // Create brand
      const brand = new Brand({
        ...brandData,
        password: hashedPassword,
        status: 'active'
      });

      await brand.save();

      // Generate JWT tokens
      const jwtPayload: JwtPayload = {
        id: brand._id.toString(),
        type: 'brand',
        email: brand.email
      };

      const tokens = JwtUtils.generateTokenPair(jwtPayload);

      // Return success response (password is automatically excluded by toJSON transform)
      res.status(201).json({
        success: true,
        data: {
          brand: brand.toJSON(),
          tokens: {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: JwtUtils.getTokenExpiration(tokens.accessToken)
          }
        },
        message: 'Brand registered successfully'
      });

    } catch (error) {
      console.error('Brand registration error:', error);
      
      // Handle MongoDB duplicate key error
      if (error instanceof Error && 'code' in error && (error as any).code === 11000) {
        res.status(409).json({
          success: false,
          error: {
            code: 'AUTH_011',
            message: 'Brand with this email already exists'
          }
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_001',
          message: 'Internal server error'
        }
      });
    }
  }

  /**
   * Login brand
   */
  public static async login(req: Request, res: Response): Promise<void> {
    try {
      // Validate request body
      const { error, value } = brandLoginSchema.validate(req.body, { 
        abortEarly: false,
        stripUnknown: true 
      });

      if (error) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_001',
            message: 'Invalid input data',
            details: error.details.map(detail => ({
              field: detail.path.join('.'),
              message: detail.message
            }))
          }
        });
        return;
      }

      const { email, password }: BrandLoginRequest = value;

      // Find brand by email
      const brand = await Brand.findOne({ email, status: 'active' }).select('+password');
      if (!brand) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTH_012',
            message: 'Invalid email or password'
          }
        });
        return;
      }

      // Verify password
      const isPasswordValid = await PasswordUtils.comparePassword(password, brand.password);
      if (!isPasswordValid) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTH_012',
            message: 'Invalid email or password'
          }
        });
        return;
      }

      // Generate JWT tokens
      const jwtPayload: JwtPayload = {
        id: brand._id.toString(),
        type: 'brand',
        email: brand.email
      };

      const tokens = JwtUtils.generateTokenPair(jwtPayload);

      // Return success response
      res.status(200).json({
        success: true,
        data: {
          brand: brand.toJSON(),
          tokens: {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: JwtUtils.getTokenExpiration(tokens.accessToken)
          }
        },
        message: 'Login successful'
      });

    } catch (error) {
      console.error('Brand login error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_001',
          message: 'Internal server error'
        }
      });
    }
  }

  /**
   * Refresh access token
   */
  public static async refresh(req: Request, res: Response): Promise<void> {
    try {
      // Validate request body
      const { error, value } = refreshTokenSchema.validate(req.body, { 
        abortEarly: false,
        stripUnknown: true 
      });

      if (error) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_001',
            message: 'Invalid input data',
            details: error.details.map(detail => ({
              field: detail.path.join('.'),
              message: detail.message
            }))
          }
        });
        return;
      }

      const { refreshToken }: RefreshTokenRequest = value;

      // Verify refresh token
      let decoded: JwtPayload;
      try {
        decoded = JwtUtils.verifyRefreshToken(refreshToken);
      } catch (tokenError) {
        let errorMessage = 'Invalid refresh token';
        let errorCode = 'AUTH_009';

        if (tokenError instanceof Error && tokenError.message.includes('expired')) {
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
        return;
      }

      // Verify brand still exists and is active
      const brand = await Brand.findById(decoded.id);
      if (!brand || brand.status !== 'active') {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTH_013',
            message: 'Brand account not found or inactive'
          }
        });
        return;
      }

      // Generate new access token (create fresh payload without exp)
      const freshPayload: JwtPayload = {
        id: decoded.id,
        type: decoded.type,
        email: decoded.email
      };
      const newAccessToken = JwtUtils.generateAccessToken(freshPayload);

      res.status(200).json({
        success: true,
        data: {
          accessToken: newAccessToken,
          expiresIn: JwtUtils.getTokenExpiration(newAccessToken)
        },
        message: 'Token refreshed successfully'
      });

    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_001',
          message: 'Internal server error'
        }
      });
    }
  }
}

export default BrandAuthController;