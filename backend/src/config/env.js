import 'dotenv/config';

export function loadConfig(env = process.env) {
  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  const allowedOrigins = (env.ALLOWED_ORIGINS ?? 'http://localhost:4200')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (allowedOrigins.length === 0) {
    throw new Error('ALLOWED_ORIGINS must contain at least one origin');
  }

  const jwtSecret = env.JWT_SECRET?.trim();
  if (
    !jwtSecret
    || jwtSecret.length < 32
    || jwtSecret.toLowerCase().includes('replace-')
  ) {
    throw new Error('JWT_SECRET must be set and contain at least 32 characters');
  }
  const creditLimit300kTo500k = Number(env.CREDIT_LIMIT_300K_TO_500K ?? 1000000);
  if (!Number.isFinite(creditLimit300kTo500k) || creditLimit300kTo500k < 0) {
    throw new Error('CREDIT_LIMIT_300K_TO_500K must be a non-negative number');
  }

  return {
    port,
    nodeEnv: env.NODE_ENV ?? 'development',
    mongoUri: env.MONGODB_URI?.trim() || null,
    allowedOrigins,
    jwtSecret,
    creditLimit300kTo500k,
    creditLimit300kTo500kRequiresConfirmation: (
      env.CREDIT_LIMIT_300K_TO_500K_REQUIRES_CONFIRMATION ?? 'true'
    ).toLowerCase() === 'true',
  };
}
