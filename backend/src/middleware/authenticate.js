import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { normalizeAccountStatus, normalizeUserRole, User } from '../models/user.model.js';
import { authTokenOptions } from '../services/auth.service.js';
import { HttpError } from '../utils/http-error.js';

export function authenticate({ jwtSecret, userModel = User, jwtLibrary = jwt }) {
  return async (request, _response, next) => {
    const authorization = request.get('Authorization') ?? '';
    const match = /^Bearer ([^\s]+)$/i.exec(authorization);
    if (!match) {
      return next(new HttpError(401, 'UNAUTHENTICATED', 'Authentication is required.'));
    }

    let payload;
    try {
      payload = jwtLibrary.verify(match[1], jwtSecret, authTokenOptions);
    } catch (error) {
      const code = error.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN';
      const message = error.name === 'TokenExpiredError'
        ? 'The access token has expired.'
        : 'The access token is invalid.';
      return next(new HttpError(401, code, message));
    }

    if (typeof payload !== 'object' || !mongoose.isValidObjectId(payload.sub)) {
      return next(new HttpError(401, 'INVALID_TOKEN', 'The access token is invalid.'));
    }

    try {
      const user = await userModel.findById(payload.sub);
      if (!user || normalizeAccountStatus(user.accountStatus) !== 'ACTIVE') {
        return next(new HttpError(401, 'ACCOUNT_INACTIVE', 'This account is not active.'));
      }

      request.auth = {
        userId: user._id.toString(),
        role: normalizeUserRole(user.role),
      };
      return next();
    } catch (error) {
      return next(error);
    }
  };
}
