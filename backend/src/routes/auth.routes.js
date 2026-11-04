import { Router } from 'express';
import { createAuthController } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { validateLogin, validateRegistration } from '../validators/auth.validator.js';
import { User } from '../models/user.model.js';

export function createAuthRouter({ config, authService, userModel = User }) {
  const router = Router();
  const controller = createAuthController(authService, config);

  router.post('/register', validateRegistration, controller.register);
  router.post('/login', validateLogin, controller.login);
  router.get('/me', authenticate({ jwtSecret: config.jwtSecret, userModel }), controller.currentUser);

  return router;
}
