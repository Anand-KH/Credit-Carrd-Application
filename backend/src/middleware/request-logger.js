import { performance } from 'node:perf_hooks';

export function requestLogger(logger) {
  return (_request, response, next) => {
    const startedAt = performance.now();
    response.on('finish', () => {
      logger.info('request.completed', {
        requestId: response.get('X-Request-Id'),
        method: _request.method,
        status: response.statusCode,
        durationMs: Math.round(performance.now() - startedAt),
      });
    });
    next();
  };
}
