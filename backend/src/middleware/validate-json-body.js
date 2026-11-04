import { HttpError } from '../utils/http-error.js';
import { isJsonObject } from '../validators/request.validator.js';

const bodyMethods = new Set(['POST', 'PUT', 'PATCH']);

export function validateJsonBody(request, _response, next) {
  if (!bodyMethods.has(request.method)) {
    return next();
  }

  if (!request.is('application/json')) {
    return next(new HttpError(
      415,
      'UNSUPPORTED_MEDIA_TYPE',
      'Content-Type must be application/json.',
    ));
  }

  if (!isJsonObject(request.body)) {
    return next(new HttpError(
      400,
      'INVALID_REQUEST_BODY',
      'Request body must be a JSON object.',
    ));
  }

  return next();
}
