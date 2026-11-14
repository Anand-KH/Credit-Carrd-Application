import { getErrorLocation } from '../utils/logger.js';

export function errorHandler(logger) {
  return (error, request, response, next) => {
    if (response.headersSent) {
      return next(error);
    }

    let status = 500;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected error occurred.';

    if (error.type === 'entity.parse.failed') {
      status = 400;
      code = 'INVALID_JSON';
      message = 'Request body must contain valid JSON.';
    } else if (error.type === 'entity.too.large') {
      status = 413;
      code = 'REQUEST_BODY_TOO_LARGE';
      message = 'Request body exceeds the allowed size.';
    } else if (error.status === 415) {
      status = 415;
      code = error.code ?? 'UNSUPPORTED_MEDIA_TYPE';
      message = error.message;
    } else if (error.code === 11000) {
      status = 409;
      code = 'CONFLICT';
      message = 'The requested resource already exists.';
    } else if (error.name === 'ValidationError') {
      status = 400;
      code = 'VALIDATION_ERROR';
      const validationMessages = Object.values(error.errors ?? {})
        .map((validationError) => `${validationError.path}: ${validationError.message}`)
        .join('; ');
      message = validationMessages
        ? `The request could not be saved because ${validationMessages}`
        : 'The request could not be saved because one or more values are invalid.';
    } else if (Number.isInteger(error.status) && error.status >= 400 && error.status < 500) {
      status = error.status;
      code = error.code ?? 'REQUEST_ERROR';
      message = error.message;
    }

    logger.error('request.failed', {
      requestId: request.id,
      status,
      code,
      errorName: error.name,
      // Error messages can contain applicant data, so unexpected failures log only
      // the source location of the throw, which is enough to start debugging.
      ...(status >= 500 ? { errorLocation: getErrorLocation(error) } : {}),
    });

    response.status(status).json({
      error: {
        code,
        message,
        requestId: request.id,
      },
    });
  };
}
