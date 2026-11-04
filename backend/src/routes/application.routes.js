import { Router } from 'express';
import { createApplicationController } from '../controllers/application.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorizeRoles } from '../middleware/authorize-roles.js';
import { validateApplicationSubmission, parsePagination } from '../validators/application.validator.js';
import { User } from '../models/user.model.js';

export function createApplicationRouter({ config, applicationService, userModel = User }) {
  const router = Router();
  const controller = createApplicationController(applicationService);
  const applicantOnly = [
    authenticate({ jwtSecret: config.jwtSecret, userModel }),
    authorizeRoles('APPLICANT'),
  ];

  router.post('/', ...applicantOnly, validateApplicationSubmission, controller.submit);
  router.get('/me', ...applicantOnly, parsePagination, controller.listMine);
  router.get('/:applicationNumber/status', ...applicantOnly, controller.trackMine);
  return router;
}
