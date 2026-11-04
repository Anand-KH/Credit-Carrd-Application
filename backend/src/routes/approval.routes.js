import { Router } from 'express';
import { createApprovalController } from '../controllers/approval.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorizeRoles } from '../middleware/authorize-roles.js';
import { validateApprovalDecision, validateApprovalQuery, validateManualReview } from '../validators/approval.validator.js';

export function createApprovalRouter({ config, approvalService, userModel }) {
  const router = Router();
  const controller = createApprovalController(approvalService);
  const reviewReaders = [
    authenticate({ jwtSecret: config.jwtSecret, userModel }),
    authorizeRoles('APPROVER', 'ADMIN'),
  ];
  const approverOnly = [
    authenticate({ jwtSecret: config.jwtSecret, userModel }),
    authorizeRoles('APPROVER'),
  ];
  const decisionActors = [
    authenticate({ jwtSecret: config.jwtSecret, userModel }),
    authorizeRoles('APPROVER', 'ADMIN'),
  ];

  router.get('/', ...reviewReaders, validateApprovalQuery, controller.list);
  router.get('/:applicationNumber', ...reviewReaders, controller.get);
  router.post('/:applicationNumber/decision', ...decisionActors, validateApprovalDecision, controller.decide);
  router.post('/:applicationNumber/manual-review', ...approverOnly, validateManualReview, controller.manualReview);
  return router;
}
