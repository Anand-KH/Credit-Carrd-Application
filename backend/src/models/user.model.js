import mongoose from 'mongoose';

export const USER_ROLES = ['APPLICANT', 'APPROVER', 'ADMIN', 'DISPATCH_OFFICER'];
const accountStatuses = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'BLOCKED'];
const legacyRoles = {
  applicant: 'APPLICANT',
  approver: 'APPROVER',
  administrator: 'ADMIN',
  admin: 'ADMIN',
  dispatch_officer: 'DISPATCH_OFFICER',
};

export function normalizeUserRole(role) {
  return legacyRoles[typeof role === 'string' ? role.toLowerCase() : role] ?? role;
}

export function normalizeAccountStatus(status) {
  return typeof status === 'string' ? status.toUpperCase() : status;
}

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 120,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address.'],
  },
  passwordHash: {
    type: String,
    required: true,
    select: false,
    match: [/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/, 'Password must be stored as a bcrypt hash.'],
  },
  role: {
    type: String,
    enum: USER_ROLES,
    required: true,
    default: 'APPLICANT',
    set: normalizeUserRole,
    index: true,
  },
  accountStatus: {
    type: String,
    enum: accountStatuses,
    required: true,
    default: 'ACTIVE',
    set: normalizeAccountStatus,
    index: true,
  },
}, {
  timestamps: true,
});

export const User = mongoose.model('User', userSchema);

export default User;
