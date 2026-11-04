import { Router } from 'express';
import { createDispatchController } from '../controllers/dispatch.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorizeRoles } from '../middleware/authorize-roles.js';
import { User } from '../models/user.model.js';
import { validateDispatchQuery, validateDispatchUpdate } from '../validators/dispatch.validator.js';

export function createDispatchRouter({ config, dispatchService, userModel = User }) {
  const router = Router();
  const controller = createDispatchController(dispatchService);
  const dispatchOnly = [
    authenticate({ jwtSecret: config.jwtSecret, userModel }),
    authorizeRoles('DISPATCH_OFFICER', 'ADMIN'),
  ];
  router.get('/', ...dispatchOnly, validateDispatchQuery, controller.list);
  router.patch('/', ...dispatchOnly, validateDispatchUpdate, controller.update);
  return router;
}
