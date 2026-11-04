import { HttpError } from '../utils/http-error.js';

const decisionValues = new Set(['approved', 'rejected']);
const reviewableStatuses = new Set(['submitted', 'under_review', 'manual_review']);

export function validateApprovalQuery(request, _response, next) {
  const page = Number.parseInt(request.query.page ?? '1', 10);
  const limit = Number.parseInt(request.query.limit ?? '10', 10);
  const status = request.query.status?.trim();
  const search = request.query.search?.trim();
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 50) {
    return next(new HttpError(400, 'VALIDATION_ERROR', 'Page must be at least 1 and limit must be between 1 and 50.'));
  }
  if (status && !reviewableStatuses.has(status)) {
    return next(new HttpError(400, 'VALIDATION_ERROR', 'Status must be submitted, under_review, or manual_review.'));
  }
  if (search && (search.length > 80 || /[^\w\-\s]/.test(search))) {
    return next(new HttpError(400, 'VALIDATION_ERROR', 'Search contains unsupported characters.'));
  }
  request.approvalQuery = {
    page,
    limit,
    skip: (page - 1) * limit,
    status,
    search,
  };
  return next();
}

export function validateApprovalDecision(request, _response, next) {
  const { decision, reason } = request.body;
  if (!decisionValues.has(decision)) {
    return next(new HttpError(400, 'VALIDATION_ERROR', 'Decision must be approved or rejected.'));
  }
  if (typeof reason !== 'string' || reason.trim().length < 5 || reason.trim().length > 1000) {
    return next(new HttpError(400, 'VALIDATION_ERROR', 'A reason of 5 to 1000 characters is required.'));
  }
  request.body = { decision, reason: reason.trim() };
  return next();
}
