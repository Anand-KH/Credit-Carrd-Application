import { USER_ROLES } from '../models/user.model.js';
import { HttpError } from '../utils/http-error.js';

export function authorizeRoles(...allowedRoles) {
  const invalidRoles = allowedRoles.filter((role) => !USER_ROLES.includes(role));
  if (invalidRoles.length > 0) {
    throw new Error(`Unknown authorization role: ${invalidRoles.join(', ')}`);
  }

  return (request, _response, next) => {
    if (!request.auth) {
      return next(new HttpError(401, 'UNAUTHENTICATED', 'Authentication is required.'));
    }

    if (!allowedRoles.includes(request.auth.role)) {
      return next(new HttpError(403, 'FORBIDDEN', 'You do not have permission to access this resource.'));
    }

    return next();
  };
}
