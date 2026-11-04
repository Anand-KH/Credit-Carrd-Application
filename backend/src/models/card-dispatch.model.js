import mongoose from 'mongoose';

const dispatchStatuses = ['pending', 'in_transit', 'delivered', 'failed'];

const cardDispatchSchema = new mongoose.Schema({
  application: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Application',
    required: true,
    unique: true,
    index: true,
  },
  dispatchReference: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
  },
  dispatchDate: {
    type: Date,
    required: true,
    default: Date.now,
  },
  dispatchStatus: {
    type: String,
    enum: dispatchStatuses,
    required: true,
    default: 'pending',
    index: true,
  },
}, {
  timestamps: true,
});

cardDispatchSchema.index({ application: 1, dispatchDate: -1 });

export const CardDispatch = mongoose.model('CardDispatch', cardDispatchSchema);

export default CardDispatch;
