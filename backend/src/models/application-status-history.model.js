import mongoose from 'mongoose';

const applicationStatusHistorySchema = new mongoose.Schema({
  application: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Application',
    required: true,
  },
  previousStatus: {
    type: String,
    required: false,
    trim: true,
    default: null,
  },
  newStatus: {
    type: String,
    required: true,
    trim: true,
  },
  actor: {
    type: String,
    required: true,
    trim: true,
  },
  reason: {
    type: String,
    required: false,
    trim: true,
    maxlength: 1000,
    default: '',
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
    index: true,
  },
}, {
  timestamps: true,
});

applicationStatusHistorySchema.index({ application: 1, timestamp: -1 });

export const ApplicationStatusHistory = mongoose.model('ApplicationStatusHistory', applicationStatusHistorySchema);

export default ApplicationStatusHistory;
