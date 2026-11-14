import { describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { createApplicationService } from '../src/services/application.service.js';
import { createDispatchService } from '../src/services/dispatch.service.js';

const applicantId = new mongoose.Types.ObjectId();
const applicationId = new mongoose.Types.ObjectId();
const actor = { userId: new mongoose.Types.ObjectId().toString() };

function session() {
  return {
    withTransaction: async (callback) => callback(),
    endSession: vi.fn(),
  };
}

function chain(value) {
  return {
    session: async () => value,
    lean: async () => value,
    select: () => ({
      lean: async () => value,
      sort: () => ({ lean: async () => value }),
    }),
  };
}

describe('application tracking and card dispatch', () => {
  it('rejects invalid tracking application numbers and unauthorised ownership', async () => {
    const service = createApplicationService({
      applicantModel: {
        findOne: () => ({
          select: () => ({ lean: async () => ({ _id: applicantId }) }),
        }),
      },
      applicationModel: {
        findOne: () => ({
          select: () => ({ lean: async () => null }),
        }),
      },
      statusHistoryModel: { find: () => chain([]) },
    });

    await expect(service.getTrackingForUser(actor.userId, 'not-valid'))
      .rejects.toMatchObject({ code: 'INVALID_APPLICATION_NUMBER' });
    await expect(service.getTrackingForUser(actor.userId, 'APP-NOT-MINE'))
      .rejects.toMatchObject({ code: 'APPLICATION_NOT_FOUND' });
  });

  it('lists the dispatch queue with database-side filtering and pagination', async () => {
    const aggregate = vi.fn(async () => [{
      items: [{
        applicationNumber: 'APP-ONE',
        dispatchReference: '',
        dispatchDate: new Date('2026-10-01T00:00:00.000Z'),
        dispatchStatus: 'pending',
        createdAt: new Date('2026-10-01T00:00:00.000Z'),
        updatedAt: new Date('2026-10-01T00:00:00.000Z'),
      }],
      total: [{ count: 11 }],
    }]);
    const service = createDispatchService({
      applicationModel: { aggregate },
      dispatchModel: { collection: { name: 'carddispatches' } },
    });

    const result = await service.list({ page: 2, limit: 10, skip: 10, status: 'pending' });

    expect(result).toMatchObject({ page: 2, limit: 10, total: 11, totalPages: 2 });
    expect(result.items).toEqual([expect.objectContaining({
      applicationNumber: 'APP-ONE',
      dispatchStatus: 'pending',
    })]);
    const pipeline = aggregate.mock.calls[0][0];
    expect(pipeline).toContainEqual({ $match: { dispatchStatus: 'pending' } });
    expect(pipeline.at(-1).$facet.items).toEqual([{ $skip: 10 }, { $limit: 10 }]);
  });

  it('returns an empty dispatch page when nothing matches', async () => {
    const service = createDispatchService({
      applicationModel: { aggregate: async () => [{ items: [], total: [] }] },
      dispatchModel: {},
    });
    await expect(service.list({ page: 1, limit: 10, skip: 0 }))
      .resolves.toEqual({ items: [], page: 1, limit: 10, total: 0, totalPages: 0 });
  });

  it('rejects dispatching an unapproved application', async () => {
    const service = createDispatchService({
      applicationModel: {
        findOne: () => ({ session: async () => ({ _id: applicationId, status: 'rejected' }) }),
      },
      sessionFactory: async () => session(),
    });
    await expect(service.update(actor, {
      applicationNumber: 'APP-REJECTED',
      dispatchStatus: 'pending',
    })).rejects.toMatchObject({ code: 'APPLICATION_NOT_APPROVED' });
  });

  it('creates one dispatch and rejects duplicate dispatch actions', async () => {
    const application = { _id: applicationId, status: 'approved' };
    let dispatch = null;
    const histories = [];
    const service = createDispatchService({
      applicationModel: {
        findOne: () => ({ session: async () => application }),
        findOneAndUpdate: async () => ({ ...application, status: 'dispatched' }),
      },
      dispatchModel: {
        findOne: () => ({ session: async () => dispatch }),
        create: async (records) => {
          dispatch = {
            ...records[0],
            _id: new mongoose.Types.ObjectId(),
            createdAt: new Date(),
            updatedAt: new Date(),
            toObject() { return this; },
          };
          return [dispatch];
        },
      },
      statusHistoryModel: { create: async (records) => histories.push(records[0]) },
      auditLogModel: { create: async () => [] },
      sessionFactory: async () => session(),
    });

    const created = await service.update(actor, {
      applicationNumber: 'APP-APPROVED',
      dispatchStatus: 'pending',
      dispatchReference: 'DSP-ONE',
    });
    expect(created).toMatchObject({
      applicationNumber: 'APP-APPROVED',
      dispatchReference: 'DSP-ONE',
      dispatchStatus: 'pending',
    });
    await expect(service.update(actor, {
      applicationNumber: 'APP-APPROVED',
      dispatchStatus: 'pending',
    })).rejects.toMatchObject({ code: 'DUPLICATE_DISPATCH_ACTION' });
    expect(histories).toHaveLength(1);
  });

  it('allows valid pending, in-transit, and delivered transitions', async () => {
    const application = { _id: applicationId, status: 'approved' };
    let dispatch = null;
    const service = createDispatchService({
      applicationModel: {
        findOne: () => ({ session: async () => application }),
        findOneAndUpdate: async () => ({ ...application, status: 'dispatched' }),
      },
      dispatchModel: {
        findOne: () => ({ session: async () => dispatch }),
        create: async (records) => {
          dispatch = {
            ...records[0],
            _id: new mongoose.Types.ObjectId(),
            createdAt: new Date(),
            updatedAt: new Date(),
            toObject() { return this; },
          };
          return [dispatch];
        },
        findOneAndUpdate: async (_query, update) => {
          dispatch = { ...dispatch, ...update.$set };
          return dispatch;
        },
      },
      statusHistoryModel: { create: async () => [] },
      auditLogModel: { create: async () => [] },
      sessionFactory: async () => session(),
    });

    await service.update(actor, { applicationNumber: 'APP-APPROVED', dispatchStatus: 'pending' });
    await expect(service.update(actor, { applicationNumber: 'APP-APPROVED', dispatchStatus: 'in_transit' }))
      .resolves.toMatchObject({ dispatchStatus: 'in_transit' });
    await expect(service.update(actor, { applicationNumber: 'APP-APPROVED', dispatchStatus: 'delivered' }))
      .resolves.toMatchObject({ dispatchStatus: 'delivered' });
  });
});
