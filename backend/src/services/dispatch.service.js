import mongoose from 'mongoose';
import { Application } from '../models/application.model.js';
import { ApplicationStatusHistory } from '../models/application-status-history.model.js';
import { AuditLog } from '../models/audit-log.model.js';
import { CardDispatch } from '../models/card-dispatch.model.js';
import { HttpError } from '../utils/http-error.js';

const transitions = {
  pending: new Set(['in_transit', 'failed']),
  in_transit: new Set(['delivered', 'failed']),
  failed: new Set(['pending']),
  delivered: new Set(),
};

function generateDispatchReference() {
  return `DSP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

function safeDispatch(dispatch) {
  return {
    applicationNumber: dispatch.applicationNumber,
    dispatchReference: dispatch.dispatchReference,
    dispatchDate: dispatch.dispatchDate,
    dispatchStatus: dispatch.dispatchStatus,
    createdAt: dispatch.createdAt,
    updatedAt: dispatch.updatedAt,
  };
}

export function createDispatchService({
  applicationModel = Application,
  dispatchModel = CardDispatch,
  statusHistoryModel = ApplicationStatusHistory,
  auditLogModel = AuditLog,
  sessionFactory = () => mongoose.startSession(),
} = {}) {
  return {
    async list({ page, limit, skip, status }) {
      // Approved applications without a dispatch record are shown as virtual
      // `pending` rows. Doing the join, filter, sort and pagination in MongoDB
      // keeps memory use flat however many applications exist.
      const [result] = await applicationModel.aggregate([
        { $match: { status: { $in: ['approved', 'dispatched'] } } },
        {
          $lookup: {
            from: dispatchModel.collection?.name ?? 'carddispatches',
            localField: '_id',
            foreignField: 'application',
            as: 'dispatch',
          },
        },
        { $unwind: { path: '$dispatch', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            applicationNumber: 1,
            dispatchReference: { $ifNull: ['$dispatch.dispatchReference', ''] },
            dispatchDate: { $ifNull: ['$dispatch.dispatchDate', '$applicationDate'] },
            dispatchStatus: { $ifNull: ['$dispatch.dispatchStatus', 'pending'] },
            createdAt: { $ifNull: ['$dispatch.createdAt', '$createdAt'] },
            updatedAt: { $ifNull: ['$dispatch.updatedAt', '$updatedAt'] },
          },
        },
        ...(status ? [{ $match: { dispatchStatus: status } }] : []),
        { $sort: { dispatchDate: -1, applicationNumber: 1 } },
        {
          $facet: {
            items: [{ $skip: skip }, { $limit: limit }],
            total: [{ $count: 'count' }],
          },
        },
      ]);
      const total = result?.total?.[0]?.count ?? 0;
      return {
        items: (result?.items ?? []).map(safeDispatch),
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      };
    },

    async update(actor, details) {
      const session = await sessionFactory();
      try {
        let result;
        await session.withTransaction(async () => {
          const application = await applicationModel.findOne({
            applicationNumber: details.applicationNumber,
          }).session(session);
          if (!application) {
            throw new HttpError(404, 'APPLICATION_NOT_FOUND', 'Application was not found.');
          }
          if (application.status !== 'approved' && application.status !== 'dispatched') {
            throw new HttpError(409, 'APPLICATION_NOT_APPROVED', 'Only approved applications can be dispatched.');
          }

          const current = await dispatchModel.findOne({ application: application._id }).session(session);
          const now = new Date();
          if (!current) {
            if (details.dispatchStatus !== 'pending') {
              throw new HttpError(409, 'INVALID_DISPATCH_TRANSITION', 'A new dispatch must start in pending status.');
            }
            const created = (await dispatchModel.create([{
              application: application._id,
              dispatchReference: details.dispatchReference ?? generateDispatchReference(),
              dispatchDate: now,
              dispatchStatus: 'pending',
            }], { session }))[0];
            await applicationModel.findOneAndUpdate(
              { _id: application._id, status: 'approved' },
              { $set: { status: 'dispatched' } },
              { returnDocument: 'after', runValidators: true, session },
            );
            await statusHistoryModel.create([{
              application: application._id,
              previousStatus: 'approved',
              newStatus: 'dispatched',
              actor: actor.userId,
              timestamp: now,
              reason: 'Card dispatch created.',
            }], { session });
            await auditLogModel.create([{
              actor: actor.userId,
              action: 'card_dispatch_created',
              targetResource: details.applicationNumber,
              timestamp: now,
              metadata: { dispatchReference: created.dispatchReference, dispatchStatus: created.dispatchStatus },
            }], { session });
            result = safeDispatch({ ...created.toObject(), applicationNumber: details.applicationNumber });
            return;
          }

          if (current.dispatchStatus === details.dispatchStatus) {
            throw new HttpError(409, 'DUPLICATE_DISPATCH_ACTION', 'The dispatch already has this status.');
          }
          if (!transitions[current.dispatchStatus]?.has(details.dispatchStatus)) {
            throw new HttpError(409, 'INVALID_DISPATCH_TRANSITION', 'The dispatch status transition is not allowed.');
          }
          const updated = await dispatchModel.findOneAndUpdate(
            { _id: current._id, dispatchStatus: current.dispatchStatus },
            { $set: { dispatchStatus: details.dispatchStatus } },
            { returnDocument: 'after', runValidators: true, session },
          );
          if (!updated) {
            throw new HttpError(409, 'DUPLICATE_DISPATCH_ACTION', 'The dispatch was updated by another request.');
          }
          await statusHistoryModel.create([{
            application: application._id,
            previousStatus: 'dispatched',
            newStatus: 'dispatched',
            actor: actor.userId,
            timestamp: now,
            reason: `Card dispatch status changed to ${details.dispatchStatus}.`,
          }], { session });
          await auditLogModel.create([{
            actor: actor.userId,
            action: 'card_dispatch_updated',
            targetResource: details.applicationNumber,
            timestamp: now,
            metadata: { dispatchReference: updated.dispatchReference, dispatchStatus: updated.dispatchStatus },
          }], { session });
          result = safeDispatch({ ...updated.toObject(), applicationNumber: details.applicationNumber });
        });
        return result;
      } catch (error) {
        if (error.code === 11000) {
          throw new HttpError(409, 'DUPLICATE_DISPATCH', 'A dispatch record already exists for this application.');
        }
        throw error;
      } finally {
        await session.endSession();
      }
    },
  };
}
