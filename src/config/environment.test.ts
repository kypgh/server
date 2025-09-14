import config from './environment';

describe('Environment Configuration', () => {
  it('should load configuration values', () => {
    expect(config.port).toBeDefined();
    expect(config.nodeEnv).toBeDefined();
    expect(config.mongodbUri).toBeDefined();
    expect(config.jwt.accessSecret).toBeDefined();
    expect(config.jwt.refreshSecret).toBeDefined();
  });

  it('should have default values', () => {
    expect(config.port).toBe(3000);
    expect(config.nodeEnv).toBe('test'); // Jest sets NODE_ENV to 'test'
    expect(config.jwt.accessSecret).toBe('fallback-access-secret-key');
    expect(config.jwt.refreshSecret).toBe('fallback-refresh-secret-key');
  });

  it('should have JWT configuration', () => {
    expect(config.jwt.accessExpiresIn).toBeDefined();
    expect(config.jwt.refreshExpiresIn).toBeDefined();
    expect(config.jwt.issuer).toBeDefined();
    expect(config.jwt.audience).toBeDefined();
    expect(typeof config.jwt.accessExpiresIn).toBe('string');
    expect(typeof config.jwt.refreshExpiresIn).toBe('string');
  });

  it('should have rate limiting configuration', () => {
    expect(config.rateLimit.windowMs).toBeDefined();
    expect(config.rateLimit.maxRequests).toBeDefined();
    expect(typeof config.rateLimit.windowMs).toBe('number');
    expect(typeof config.rateLimit.maxRequests).toBe('number');
  });
});