import jwt from 'jsonwebtoken';
import config from '../config/environment';

export interface JwtPayload {
  id: string;
  type: 'brand' | 'client';
  email: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

class JwtUtils {
  /**
   * Generate access token with short expiration
   */
  public static generateAccessToken(payload: JwtPayload): string {
    return jwt.sign(payload, config.jwt.accessSecret, {
      expiresIn: config.jwt.accessExpiresIn,
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    } as jwt.SignOptions);
  }

  /**
   * Generate refresh token with longer expiration
   */
  public static generateRefreshToken(payload: JwtPayload): string {
    return jwt.sign(payload, config.jwt.refreshSecret, {
      expiresIn: config.jwt.refreshExpiresIn,
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    } as jwt.SignOptions);
  }

  /**
   * Generate both access and refresh tokens
   */
  public static generateTokenPair(payload: JwtPayload): TokenPair {
    return {
      accessToken: this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken(payload),
    };
  }

  /**
   * Verify access token
   */
  public static verifyAccessToken(token: string): JwtPayload {
    try {
      const decoded = jwt.verify(token, config.jwt.accessSecret, {
        issuer: config.jwt.issuer,
        audience: config.jwt.audience,
      }) as JwtPayload;
      
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Access token expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid access token');
      }
      throw new Error('Token verification failed');
    }
  }

  /**
   * Verify refresh token
   */
  public static verifyRefreshToken(token: string): JwtPayload {
    try {
      const decoded = jwt.verify(token, config.jwt.refreshSecret, {
        issuer: config.jwt.issuer,
        audience: config.jwt.audience,
      }) as JwtPayload;
      
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Refresh token expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid refresh token');
      }
      throw new Error('Token verification failed');
    }
  }

  /**
   * Extract token from Authorization header
   */
  public static extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader) {
      return null;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }

    return parts[1];
  }

  /**
   * Get token expiration time
   */
  public static getTokenExpiration(token: string): Date | null {
    try {
      const decoded = jwt.decode(token) as any;
      if (!decoded || !decoded.exp) {
        return null;
      }
      return new Date(decoded.exp * 1000);
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if token is expired
   */
  public static isTokenExpired(token: string): boolean {
    const expiration = this.getTokenExpiration(token);
    if (!expiration) {
      return true;
    }
    return expiration.getTime() < Date.now();
  }
}

export default JwtUtils;