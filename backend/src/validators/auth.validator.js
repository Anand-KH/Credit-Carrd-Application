import { HttpError } from '../utils/http-error.js';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function rejectUnknownFields(body, allowedFields) {
  const unknownFields = Object.keys(body).filter((field) => !allowedFields.has(field));
  if (unknownFields.length > 0) {
    throw new HttpError(400, 'INVALID_REQUEST_BODY', 'Request contains unsupported fields.');
  }
}

export function validateRegistration(request, _response, next) {
  const { body } = request;
  const allowedFields = new Set(['name', 'email', 'password']);
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';

  try {
    rejectUnknownFields(body, allowedFields);
    if (
      name.length < 2
      || name.length > 120
      || !emailPattern.test(email)
      || password.length < 12
      || password.length > 72
      || Buffer.byteLength(password, 'utf8') > 72
    ) {
      throw new HttpError(
        400,
        'VALIDATION_ERROR',
        'Provide a valid name, email, and password (12–72 characters).',
      );
    }

    request.body = { name, email, password };
    return next();
  } catch (error) {
    return next(error);
  }
}

export function validateLogin(request, _response, next) {
  const { body } = request;

  try {
    rejectUnknownFields(body, new Set(['email', 'password']));
    if (
      typeof body.email !== 'string'
      || !emailPattern.test(body.email.trim())
      || typeof body.password !== 'string'
      || body.password.length === 0
      || body.password.length > 72
      || Buffer.byteLength(body.password, 'utf8') > 72
    ) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Provide a valid email and password.');
    }

    request.body = {
      email: body.email.trim(),
      password: body.password,
    };
    return next();
  } catch (error) {
    return next(error);
  }
}
