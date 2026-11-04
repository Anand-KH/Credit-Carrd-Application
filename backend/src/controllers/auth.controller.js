export function createAuthController(authService, config) {
  return {
    register: async (request, response) => {
      const result = await authService.register(request.body, config.jwtSecret);
      response.status(201).json(result);
    },
    login: async (request, response) => {
      const result = await authService.login(request.body, config.jwtSecret);
      response.status(200).json(result);
    },
    currentUser: async (request, response) => {
      const user = await authService.getCurrentUser(request.auth.userId);
      response.status(200).json({ user });
    },
  };
}
