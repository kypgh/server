import bcrypt from 'bcryptjs';

class PasswordUtils {
  private static readonly SALT_ROUNDS = 12;

  /**
   * Hash a plain text password
   */
  public static async hashPassword(plainPassword: string): Promise<string> {
    if (!plainPassword || typeof plainPassword !== 'string') {
      throw new Error('Password must be a non-empty string');
    }

    if (plainPassword.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    try {
      const salt = await bcrypt.genSalt(this.SALT_ROUNDS);
      const hashedPassword = await bcrypt.hash(plainPassword, salt);
      return hashedPassword;
    } catch (error) {
      throw new Error('Failed to hash password');
    }
  }

  /**
   * Compare a plain text password with a hashed password
   */
  public static async comparePassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    if (!plainPassword || typeof plainPassword !== 'string') {
      throw new Error('Password must be a non-empty string');
    }

    if (!hashedPassword || typeof hashedPassword !== 'string') {
      throw new Error('Hashed password must be a non-empty string');
    }

    try {
      const isMatch = await bcrypt.compare(plainPassword, hashedPassword);
      return isMatch;
    } catch (error) {
      throw new Error('Failed to compare password');
    }
  }

  /**
   * Validate password strength
   */
  public static validatePasswordStrength(password: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!password || typeof password !== 'string') {
      errors.push('Password must be a string');
      return { isValid: false, errors };
    }

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (password.length > 128) {
      errors.push('Password must be less than 128 characters long');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    // Check for common weak passwords
    const commonPasswords = [
      'password', '123456', '123456789', 'qwerty', 'abc123',
      'password123', 'admin', 'letmein', 'welcome', 'monkey'
    ];

    if (commonPasswords.includes(password.toLowerCase())) {
      errors.push('Password is too common and easily guessable');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate a secure random password
   */
  public static generateSecurePassword(length: number = 16): string {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    const allChars = lowercase + uppercase + numbers + symbols;
    
    let password = '';
    
    // Ensure at least one character from each category
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    
    // Fill the rest randomly
    for (let i = 4; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }
}

export default PasswordUtils;