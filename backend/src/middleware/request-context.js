import { randomUUID } from 'node:crypto';

export function requestContext(request, response, next) {
  request.id = randomUUID();
  response.set('X-Request-Id', request.id);
  next();
}
