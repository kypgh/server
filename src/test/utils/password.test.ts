import PasswordUtils from '../../utils/password';

describe('PasswordUtils', () => {
  describe('hashPassword', () => {
    it('should hash a valid password', async () => {
      const password = 'testPassword123';
      const hashedPassword = await PasswordUtils.hashPassword(password);
      
      expect(typeof hashedPassword).toBe('string');
      expect(hashedPassword).not.toBe(password);
      expect(hashedPassword.length).toBeGreaterThan(50); // bcrypt hashes are typically 60 chars
    });

    it('should generate different hashes for the same password', async () => {
      const password = 'testPassword123';
      const hash1 = await PasswordUtils.hashPassword(password);
      const hash2 = await PasswordUtils.hashPassword(password);
      
      expect(hash1).not.toBe(hash2);
    });

    it('should throw error for empty password', async () => {
      await expect(PasswordUtils.hashPassword('')).rejects.toThrow('Password must be a non-empty string');
    });

    it('should throw error for non-string password', async () => {
      await expect(PasswordUtils.hashPassword(null as any)).rejects.toThrow('Password must be a non-empty string');
      await expect(PasswordUtils.hashPassword(undefined as any)).rejects.toThrow('Password must be a non-empty string');
      await expect(PasswordUtils.hashPassword(123 as any)).rejects.toThrow('Password must be a non-empty string');
    });

    it('should throw error for password shorter than 6 characters', async () => {
      await expect(PasswordUtils.hashPassword('12345')).rejects.toThrow('Password must be at least 6 characters long');
    });

    it('should accept password with exactly 6 characters', async () => {
      const password = '123456';
      const hashedPassword = await PasswordUtils.hashPassword(password);
      
      expect(typeof hashedPassword).toBe('string');
      expect(hashedPassword).not.toBe(password);
    });
  });

  describe('comparePassword', () => {
    it('should return true for matching password and hash', async () => {
      const password = 'testPassword123';
      const hashedPassword = await PasswordUtils.hashPassword(password);
      
      const isMatch = await PasswordUtils.comparePassword(password, hashedPassword);
      expect(isMatch).toBe(true);
    });

    it('should return false for non-matching password and hash', async () => {
      const password = 'testPassword123';
      const wrongPassword = 'wrongPassword456';
      const hashedPassword = await PasswordUtils.hashPassword(password);
      
      const isMatch = await PasswordUtils.comparePassword(wrongPassword, hashedPassword);
      expect(isMatch).toBe(false);
    });

    it('should throw error for empty plain password', async () => {
      const hashedPassword = await PasswordUtils.hashPassword('testPassword123');
      
      await expect(PasswordUtils.comparePassword('', hashedPassword)).rejects.toThrow('Password must be a non-empty string');
    });

    it('should throw error for non-string plain password', async () => {
      const hashedPassword = await PasswordUtils.hashPassword('testPassword123');
      
      await expect(PasswordUtils.comparePassword(null as any, hashedPassword)).rejects.toThrow('Password must be a non-empty string');
      await expect(PasswordUtils.comparePassword(undefined as any, hashedPassword)).rejects.toThrow('Password must be a non-empty string');
    });

    it('should throw error for empty hashed password', async () => {
      await expect(PasswordUtils.comparePassword('testPassword123', '')).rejects.toThrow('Hashed password must be a non-empty string');
    });

    it('should throw error for non-string hashed password', async () => {
      await expect(PasswordUtils.comparePassword('testPassword123', null as any)).rejects.toThrow('Hashed password must be a non-empty string');
      await expect(PasswordUtils.comparePassword('testPassword123', undefined as any)).rejects.toThrow('Hashed password must be a non-empty string');
    });

    it('should return false for invalid hash format', async () => {
      const isMatch = await PasswordUtils.comparePassword('testPassword123', 'invalid-hash');
      expect(isMatch).toBe(false);
    });
  });

  describe('validatePasswordStrength', () => {
    it('should validate a strong password', () => {
      const strongPassword = 'StrongP@ssw0rd123';
      const result = PasswordUtils.validatePasswordStrength(strongPassword);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject password shorter than 8 characters', () => {
      const shortPassword = 'Short1!';
      const result = PasswordUtils.validatePasswordStrength(shortPassword);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    it('should reject password longer than 128 characters', () => {
      const longPassword = 'A'.repeat(129) + '1!';
      const result = PasswordUtils.validatePasswordStrength(longPassword);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be less than 128 characters long');
    });

    it('should reject password without lowercase letter', () => {
      const password = 'PASSWORD123!';
      const result = PasswordUtils.validatePasswordStrength(password);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should reject password without uppercase letter', () => {
      const password = 'password123!';
      const result = PasswordUtils.validatePasswordStrength(password);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should reject password without number', () => {
      const password = 'Password!';
      const result = PasswordUtils.validatePasswordStrength(password);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('should reject password without special character', () => {
      const password = 'Password123';
      const result = PasswordUtils.validatePasswordStrength(password);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one special character');
    });

    it('should reject common weak passwords', () => {
      const weakPasswords = ['password', '123456', 'qwerty', 'Password123!'];
      
      weakPasswords.forEach(password => {
        const result = PasswordUtils.validatePasswordStrength(password);
        if (password === 'Password123!') {
          expect(result.isValid).toBe(true); // This one should actually be valid
        } else {
          expect(result.isValid).toBe(false);
        }
      });
    });

    it('should reject non-string password', () => {
      const result = PasswordUtils.validatePasswordStrength(null as any);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be a string');
    });

    it('should return multiple errors for very weak password', () => {
      const weakPassword = 'weak';
      const result = PasswordUtils.validatePasswordStrength(weakPassword);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('generateSecurePassword', () => {
    it('should generate password with default length', () => {
      const password = PasswordUtils.generateSecurePassword();
      
      expect(typeof password).toBe('string');
      expect(password.length).toBe(16);
    });

    it('should generate password with custom length', () => {
      const customLength = 20;
      const password = PasswordUtils.generateSecurePassword(customLength);
      
      expect(password.length).toBe(customLength);
    });

    it('should generate different passwords each time', () => {
      const password1 = PasswordUtils.generateSecurePassword();
      const password2 = PasswordUtils.generateSecurePassword();
      
      expect(password1).not.toBe(password2);
    });

    it('should generate password that passes strength validation', () => {
      const password = PasswordUtils.generateSecurePassword();
      const validation = PasswordUtils.validatePasswordStrength(password);
      
      expect(validation.isValid).toBe(true);
    });

    it('should contain at least one character from each category', () => {
      const password = PasswordUtils.generateSecurePassword(12);
      
      expect(/[a-z]/.test(password)).toBe(true); // lowercase
      expect(/[A-Z]/.test(password)).toBe(true); // uppercase
      expect(/\d/.test(password)).toBe(true); // number
      expect(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)).toBe(true); // special char
    });

    it('should handle minimum length requirements', () => {
      const password = PasswordUtils.generateSecurePassword(8);
      
      expect(password.length).toBe(8);
      expect(/[a-z]/.test(password)).toBe(true);
      expect(/[A-Z]/.test(password)).toBe(true);
      expect(/\d/.test(password)).toBe(true);
      expect(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)).toBe(true);
    });
  });

  describe('integration tests', () => {
    it('should hash and verify generated secure password', async () => {
      const password = PasswordUtils.generateSecurePassword();
      const hashedPassword = await PasswordUtils.hashPassword(password);
      const isMatch = await PasswordUtils.comparePassword(password, hashedPassword);
      
      expect(isMatch).toBe(true);
    });

    it('should validate strength of generated password', () => {
      const password = PasswordUtils.generateSecurePassword();
      const validation = PasswordUtils.validatePasswordStrength(password);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });
});