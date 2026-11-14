import { HttpError } from '../utils/http-error.js';

const statuses = new Set([
  'draft',
  'submitted',
  'under_review',
  'approved',
  'rejected',
  'manual_review',
  'pending_admin_approval',
  'dispatched',
]);

function parseDate(value, field) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new HttpError(400, 'VALIDATION_ERROR', `${field} must be a valid ISO date.`);
  }
  return new Date(value);
}

export function validateApplicationReportQuery(request, _response, next) {
  try {
    const page = Number.parseInt(request.query.page ?? '1', 10);
    const limit = Number.parseInt(request.query.limit ?? '20', 10);
    const status = request.query.status?.trim();
    const search = request.query.search?.trim();
    const dateFrom = parseDate(request.query.dateFrom, 'dateFrom');
    const dateTo = parseDate(request.query.dateTo, 'dateTo');
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Page must be at least 1 and limit must be between 1 and 100.');
    }
    if (status && !statuses.has(status)) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Status is not supported.');
    }
    if (search && (search.length > 80 || !/^[A-Z0-9-]+$/i.test(search))) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Search must contain only letters, numbers, and hyphens.');
    }
    if (dateFrom && dateTo && dateFrom > dateTo) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'dateFrom must be before dateTo.');
    }
    request.reportQuery = {
      page,
      limit,
      skip: (page - 1) * limit,
      status,
      search: search?.toUpperCase(),
      dateFrom,
      dateTo,
    };
    return next();
  } catch (error) {
    return next(error);
  }
}

export function validateAuditQuery(request, _response, next) {
  try {
    const page = Number.parseInt(request.query.page ?? '1', 10);
    const limit = Number.parseInt(request.query.limit ?? '20', 10);
    const action = request.query.action?.trim();
    const targetResource = request.query.targetResource?.trim();
    const dateFrom = parseDate(request.query.dateFrom, 'dateFrom');
    const dateTo = parseDate(request.query.dateTo, 'dateTo');
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Page must be at least 1 and limit must be between 1 and 100.');
    }
    if (action && (action.length > 80 || !/^[A-Z0-9_]+$/i.test(action))) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Action contains unsupported characters.');
    }
    if (targetResource && (targetResource.length > 120 || !/^[A-Z0-9_-]+$/i.test(targetResource))) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Target resource contains unsupported characters.');
    }
    if (dateFrom && dateTo && dateFrom > dateTo) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'dateFrom must be before dateTo.');
    }
    request.auditQuery = {
      page,
      limit,
      skip: (page - 1) * limit,
      action,
      targetResource,
      dateFrom,
      dateTo,
    };
    return next();
  } catch (error) {
    return next(error);
  }
}
