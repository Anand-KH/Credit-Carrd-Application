import { HttpError } from '../utils/http-error.js';

const allowedFields = new Set([
  'dateOfBirth',
  'gender',
  'phone',
  'address',
  'annualIncome',
  'employmentType',
  'panLast4',
]);
const genders = new Set(['male', 'female', 'other', 'prefer_not_to_say']);
const employmentTypes = new Set(['salaried', 'self_employed', 'business_owner', 'retired']);
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const phonePattern = /^[0-9+()\-\s]{8,20}$/;
const panLast4Pattern = /^[A-Z0-9]{4}$/;

function invalid(message) {
  return new HttpError(400, 'VALIDATION_ERROR', message);
}

export function validateApplicationSubmission(request, _response, next) {
  try {
    const body = request.body;
    const unknownField = Object.keys(body).find((field) => !allowedFields.has(field));
    if (unknownField) {
      throw invalid('Request contains unsupported fields.');
    }

    const dateOfBirth = typeof body.dateOfBirth === 'string' ? body.dateOfBirth : '';
    const parsedDate = datePattern.test(dateOfBirth) ? new Date(`${dateOfBirth}T00:00:00.000Z`) : null;
    const [year, month, day] = dateOfBirth.split('-').map(Number);
    const isCalendarDate = parsedDate
      && parsedDate.getUTCFullYear() === year
      && parsedDate.getUTCMonth() + 1 === month
      && parsedDate.getUTCDate() === day;
    const today = new Date();
    const minimumAdultDate = new Date(Date.UTC(
      today.getUTCFullYear() - 18,
      today.getUTCMonth(),
      today.getUTCDate(),
    ));

    if (!isCalendarDate || Number.isNaN(parsedDate.getTime()) || parsedDate >= minimumAdultDate) {
      throw invalid('Applicant must provide a valid date of birth and be older than 18 years.');
    }
    if (!genders.has(body.gender)) {
      throw invalid('Gender is required and must use a supported value.');
    }
    if (typeof body.phone !== 'string' || !phonePattern.test(body.phone.trim())) {
      throw invalid('Phone number is required and must use a valid format.');
    }
    if (!body.address || typeof body.address !== 'object' || Array.isArray(body.address)) {
      throw invalid('Address is required.');
    }
    const requiredAddressFields = ['line1', 'city', 'state', 'postalCode'];
    if (requiredAddressFields.some((field) => (
      typeof body.address[field] !== 'string' || body.address[field].trim().length === 0
    ))) {
      throw invalid('Address must include line1, city, state, and postalCode.');
    }
    if (
      typeof body.annualIncome !== 'number'
      || !Number.isFinite(body.annualIncome)
      || body.annualIncome < 0
      || body.annualIncome > 1000000000
    ) {
      throw invalid('Annual income must be a non-negative number.');
    }
    if (!employmentTypes.has(body.employmentType)) {
      throw invalid('Employment type is required and must use a supported value.');
    }
    if (typeof body.panLast4 !== 'string' || !panLast4Pattern.test(body.panLast4.trim().toUpperCase())) {
      throw invalid('PAN test input must contain exactly four alphanumeric characters.');
    }

    request.body = {
      dateOfBirth: parsedDate,
      gender: body.gender,
      phone: body.phone.trim(),
      address: {
        line1: body.address.line1.trim(),
        line2: typeof body.address.line2 === 'string' ? body.address.line2.trim() : '',
        city: body.address.city.trim(),
        state: body.address.state.trim(),
        postalCode: body.address.postalCode.trim(),
        country: typeof body.address.country === 'string' && body.address.country.trim()
          ? body.address.country.trim()
          : 'India',
      },
      annualIncome: body.annualIncome,
      employmentType: body.employmentType,
      panLast4: body.panLast4.trim().toUpperCase(),
    };
    return next();
  } catch (error) {
    return next(error);
  }
}

export function parsePagination(request, _response, next) {
  const page = Number.parseInt(request.query.page ?? '1', 10);
  const limit = Number.parseInt(request.query.limit ?? '10', 10);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 50) {
    return next(new HttpError(400, 'VALIDATION_ERROR', 'Page must be at least 1 and limit must be between 1 and 50.'));
  }
  request.pagination = { page, limit, skip: (page - 1) * limit };
  return next();
}
