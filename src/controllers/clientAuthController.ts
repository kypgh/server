import { Request, Response } from 'express';
import { Client, IClient } from '../models/Client';
import { PasswordUtils, JwtUtils, JwtPayload } from '../utils/auth';
import { 
  clientRegistrationSchema, 
  clientLoginSchema, 
  refreshTokenSchema 
} from '../validation/clientAuth';

interface ClientRegistrationRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  preferences?: {
    favoriteCategories?: string[];
    preferredDifficulty?: 'beginner' | 'intermediate' | 'advanced';
    notifications?: {
      email: boolean;
      sms: boolean;
      push: boolean;
    };
    timezone?: string;
  };
}

interface ClientLoginRequest {
  email: string;
  password: string;
}

interface RefreshTokenRequest {
  refreshToken: string;
}

class ClientAuthController {
  /**
   * Register a new client
   */
  public static async register(req: Request, res: Response): Promise<void> {
    try {
      // Validate request body
      const { error, value } = clientRegistrationSchema.validate(req.body, { 
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

      const clientData: ClientRegistrationRequest = value;

      // Check if client with email already exists
      const existingClient = await Client.findOne({ email: clientData.email });
      if (existingClient) {
        res.status(409).json({
          success: false,
          error: {
            code: 'AUTH_021',
            message: 'Client with this email already exists'
          }
        });
        return;
      }

      // Hash password
      const hashedPassword = await PasswordUtils.hashPassword(clientData.password);

      // Create client
      const client = new Client({
        ...clientData,
        password: hashedPassword,
        status: 'active'
      });

      await client.save();

      // Generate JWT tokens
      const jwtPayload: JwtPayload = {
        id: client._id.toString(),
        type: 'client',
        email: client.email
      };

      const tokens = JwtUtils.generateTokenPair(jwtPayload);

      // Return success response (password is automatically excluded by toJSON transform)
      res.status(201).json({
        success: true,
        data: {
          client: client.toJSON(),
          tokens: {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: JwtUtils.getTokenExpiration(tokens.accessToken)
          }
        },
        message: 'Client registered successfully'
      });

    } catch (error) {
      console.error('Client registration error:', error);
      
      // Handle MongoDB duplicate key error
      if (error instanceof Error && 'code' in error && (error as any).code === 11000) {
        res.status(409).json({
          success: false,
          error: {
            code: 'AUTH_021',
            message: 'Client with this email already exists'
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
   * Login client
   */
  public static async login(req: Request, res: Response): Promise<void> {
    try {
      // Validate request body
      const { error, value } = clientLoginSchema.validate(req.body, { 
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

      const { email, password }: ClientLoginRequest = value;

      // Find client by email
      const client = await Client.findOne({ email, status: 'active' }).select('+password');
      if (!client) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTH_022',
            message: 'Invalid email or password'
          }
        });
        return;
      }

      // Verify password
      const isPasswordValid = await PasswordUtils.comparePassword(password, client.password);
      if (!isPasswordValid) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTH_022',
            message: 'Invalid email or password'
          }
        });
        return;
      }

      // Generate JWT tokens
      const jwtPayload: JwtPayload = {
        id: client._id.toString(),
        type: 'client',
        email: client.email
      };

      const tokens = JwtUtils.generateTokenPair(jwtPayload);

      // Return success response
      res.status(200).json({
        success: true,
        data: {
          client: client.toJSON(),
          tokens: {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: JwtUtils.getTokenExpiration(tokens.accessToken)
          }
        },
        message: 'Login successful'
      });

    } catch (error) {
      console.error('Client login error:', error);
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

      // Verify client still exists and is active
      const client = await Client.findById(decoded.id);
      if (!client || client.status !== 'active') {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTH_023',
            message: 'Client account not found or inactive'
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

export default ClientAuthController;