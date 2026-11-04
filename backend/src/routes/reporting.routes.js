import { Router } from 'express';
import { createReportingController } from '../controllers/reporting.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorizeRoles } from '../middleware/authorize-roles.js';
import { validateApplicationReportQuery, validateAuditQuery } from '../validators/reporting.validator.js';

export function createReportingRouter({ config, reportingService, userModel }) {
  const router = Router();
  const controller = createReportingController(reportingService);
  const adminOnly = [
    authenticate({ jwtSecret: config.jwtSecret, userModel }),
    authorizeRoles('ADMIN'),
  ];
  router.get('/application-counts', ...adminOnly, controller.statusCounts);
  router.get('/applications', ...adminOnly, validateApplicationReportQuery, controller.applications);
  router.get('/audit-logs', ...adminOnly, validateAuditQuery, controller.auditLogs);
  return router;
}
