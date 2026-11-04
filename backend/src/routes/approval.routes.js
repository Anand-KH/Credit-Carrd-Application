import { Router } from 'express';
import { createApprovalController } from '../controllers/approval.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorizeRoles } from '../middleware/authorize-roles.js';
import { validateApprovalDecision, validateApprovalQuery } from '../validators/approval.validator.js';

export function createApprovalRouter({ config, approvalService, userModel }) {
  const router = Router();
  const controller = createApprovalController(approvalService);
  const approverOnly = [
    authenticate({ jwtSecret: config.jwtSecret, userModel }),
    authorizeRoles('APPROVER', 'ADMIN'),
  ];

  router.get('/', ...approverOnly, validateApprovalQuery, controller.list);
  router.get('/:applicationNumber', ...approverOnly, controller.get);
  router.post('/:applicationNumber/decision', ...approverOnly, validateApprovalDecision, controller.decide);
  return router;
}
