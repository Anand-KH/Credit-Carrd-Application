import { HttpError } from '../utils/http-error.js';

const allowedMethods = 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS';
const allowedHeaders = 'Content-Type,Authorization';

export function cors(allowedOrigins) {
  const allowedOriginSet = new Set(allowedOrigins);

  return (request, response, next) => {
    const origin = request.get('Origin');
    if (origin && !allowedOriginSet.has(origin)) {
      return next(new HttpError(403, 'ORIGIN_NOT_ALLOWED', 'Origin is not allowed'));
    }

    if (origin) {
      response.vary('Origin');
      response.set('Access-Control-Allow-Origin', origin);
      response.set('Access-Control-Allow-Methods', allowedMethods);
      response.set('Access-Control-Allow-Headers', allowedHeaders);
    }

    if (request.method === 'OPTIONS') {
      return response.sendStatus(204);
    }

    return next();
  };
}
