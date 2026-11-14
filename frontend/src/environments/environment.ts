export const environment = {
  production: true,
  // Same-origin path: serve the built app and the API behind one host (reverse
  // proxy routes /api to the backend). Change this if the API lives on another
  // origin, and add that frontend origin to the backend's ALLOWED_ORIGINS.
  apiBaseUrl: '/api',
};
