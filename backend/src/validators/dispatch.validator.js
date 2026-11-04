import { HttpError } from '../utils/http-error.js';

const statuses = new Set(['pending', 'in_transit', 'delivered', 'failed']);
const applicationNumberPattern = /^APP-[A-Z0-9-]+$/;
const dispatchReferencePattern = /^DSP-[A-Z0-9-]+$/;

export function validateDispatchQuery(request, _response, next) {
  const page = Number.parseInt(request.query.page ?? '1', 10);
  const limit = Number.parseInt(request.query.limit ?? '10', 10);
  const status = request.query.status?.trim();
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 50) {
    return next(new HttpError(400, 'VALIDATION_ERROR', 'Page must be at least 1 and limit must be between 1 and 50.'));
  }
  if (status && !statuses.has(status)) {
    return next(new HttpError(400, 'VALIDATION_ERROR', 'Dispatch status is not supported.'));
  }
  request.dispatchQuery = { page, limit, skip: (page - 1) * limit, status };
  return next();
}

export function validateDispatchUpdate(request, _response, next) {
  const { applicationNumber, dispatchStatus, dispatchReference } = request.body;
  if (typeof applicationNumber !== 'string' || !applicationNumberPattern.test(applicationNumber.trim().toUpperCase())) {
    return next(new HttpError(400, 'VALIDATION_ERROR', 'A valid application number is required.'));
  }
  if (typeof dispatchStatus !== 'string' || !statuses.has(dispatchStatus)) {
    return next(new HttpError(400, 'VALIDATION_ERROR', 'A valid dispatch status is required.'));
  }
  if (dispatchReference !== undefined
    && (typeof dispatchReference !== 'string' || !dispatchReferencePattern.test(dispatchReference.trim().toUpperCase()))) {
    return next(new HttpError(400, 'VALIDATION_ERROR', 'Dispatch reference must use the DSP- format.'));
  }
  request.body = {
    applicationNumber: applicationNumber.trim().toUpperCase(),
    dispatchStatus,
    ...(dispatchReference ? { dispatchReference: dispatchReference.trim().toUpperCase() } : {}),
  };
  return next();
}
