import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { normalizeAccountStatus, normalizeUserRole, User } from '../models/user.model.js';
import { HttpError } from '../utils/http-error.js';

const bcryptRounds = 12;
// Compared against when no user matches, so a login for an unknown email costs
// the same bcrypt work as one for a known email (prevents account enumeration
// via response timing). It is a hash of a random value nobody knows.
const dummyPasswordHash = '$2b$12$Cqd/GovxLvK8eRsCijwgHO8kVVUnoRAFkcK5XedqC8YDyiTz8fDjW';
export const jwtLifetime = '15m';
const jwtIssuer = 'credit-card-application-api';
const jwtAudience = 'credit-card-application-client';

function publicUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: normalizeUserRole(user.role),
  };
}

export function createAuthService({
  userModel = User,
  passwordHasher = bcrypt,
  jwtLibrary = jwt,
} = {}) {
  function createToken(user, jwtSecret) {
    return {
      user: publicUser(user),
      accessToken: jwtLibrary.sign({}, jwtSecret, {
        subject: user._id.toString(),
        issuer: jwtIssuer,
        audience: jwtAudience,
        expiresIn: jwtLifetime,
        algorithm: 'HS256',
      }),
      tokenType: 'Bearer',
      expiresInSeconds: 900,
    };
  }

  return {
    async register({ name, email, password }, jwtSecret) {
      const passwordHash = await passwordHasher.hash(password, bcryptRounds);
      let user;

      try {
        user = await userModel.create({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          passwordHash,
          role: 'APPLICANT',
          accountStatus: 'ACTIVE',
        });
      } catch (error) {
        if (error.code === 11000) {
          throw new HttpError(409, 'EMAIL_ALREADY_REGISTERED', 'An account with this email already exists.');
        }
        throw error;
      }

      return createToken(user, jwtSecret);
    },

    async login({ email, password }, jwtSecret) {
      const user = await userModel.findOne({ email: email.trim().toLowerCase() })
        .select('+passwordHash');
      const passwordMatches = await passwordHasher.compare(
        password,
        user?.passwordHash ?? dummyPasswordHash,
      );

      if (!user || !passwordMatches) {
        throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
      }

      if (normalizeAccountStatus(user.accountStatus) !== 'ACTIVE') {
        throw new HttpError(403, 'ACCOUNT_INACTIVE', 'This account is not active.');
      }

      return createToken(user, jwtSecret);
    },

    async getCurrentUser(userId) {
      const user = await userModel.findById(userId);
      if (!user || normalizeAccountStatus(user.accountStatus) !== 'ACTIVE') {
        throw new HttpError(401, 'UNAUTHENTICATED', 'Authentication is required.');
      }
      return publicUser(user);
    },
  };
}

export const authTokenOptions = {
  audience: jwtAudience,
  issuer: jwtIssuer,
  algorithms: ['HS256'],
};
