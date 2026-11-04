import mongoose from 'mongoose';

const forbiddenMetadataKeys = new Set([
  'password',
  'passwordHash',
  'token',
  'accesstoken',
  'jwt',
  'pan',
  'panNumber',
  'fullPan',
]);

function hasForbiddenKey(value, visited = new WeakSet()) {
  if (!value || typeof value !== 'object') return false;
  if (typeof value.toObject === 'function') {
    return hasForbiddenKey(value.toObject({ depopulate: true }), visited);
  }
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype) {
    return false;
  }
  if (visited.has(value)) return false;
  visited.add(value);
  return Object.entries(value).some(([key, child]) => (
    forbiddenMetadataKeys.has(key.toLowerCase()) || hasForbiddenKey(child, visited)
  ));
}

const safeMetadataSchema = new mongoose.Schema({
  decision: String,
  reason: String,
  creditLimit: {
    type: Number,
    min: 0,
    max: 10000000,
  },
  previousStatus: String,
  newStatus: String,
  dispatchReference: String,
  dispatchStatus: String,
  applicationNumber: String,
  safeNote: String,
}, { _id: false, strict: true });

const auditLogSchema = new mongoose.Schema({
  actor: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  action: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  targetResource: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
    index: true,
  },
  metadata: {
    type: safeMetadataSchema,
    default: {},
    validate: {
      validator(value) {
        return (value === null || typeof value === 'object') && !hasForbiddenKey(value);
      },
      message: 'Audit metadata must be a safe object without sensitive fields.',
    },
  },
}, {
  timestamps: true,
});

auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ targetResource: 1, timestamp: -1 });
auditLogSchema.pre('validate', function validateSafeMetadata() {
  if (hasForbiddenKey(this.metadata)) {
    this.invalidate('metadata', 'Audit metadata must be a safe object without sensitive fields.');
  }
});

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);

export default AuditLog;
