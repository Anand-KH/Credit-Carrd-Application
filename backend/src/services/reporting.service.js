import { Application } from '../models/application.model.js';
import { AuditLog } from '../models/audit-log.model.js';
import { CardDispatch } from '../models/card-dispatch.model.js';

const applicationStatuses = [
  'submitted',
  'under_review',
  'manual_review',
  'pending_admin_approval',
  'approved',
  'rejected',
  'dispatched',
];

function applicationFilter({ status, search, dateFrom, dateTo }) {
  const filter = {};
  if (status) filter.status = status;
  if (search) filter.applicationNumber = { $regex: `^${search}`, $options: 'i' };
  if (dateFrom || dateTo) {
    filter.applicationDate = {};
    if (dateFrom) filter.applicationDate.$gte = dateFrom;
    if (dateTo) filter.applicationDate.$lte = dateTo;
  }
  return filter;
}

function safeApplication(application) {
  return {
    applicationNumber: application.applicationNumber,
    applicationDate: application.applicationDate,
    status: application.status,
    income: application.income,
    creditScoreResult: application.creditScoreResult,
    creditDecision: application.creditDecision,
    dispatchStatus: application.dispatchStatus ?? null,
  };
}

function safeAudit(audit) {
  const metadata = audit.metadata ?? {};
  return {
    actor: audit.actor,
    action: audit.action,
    targetResource: audit.targetResource,
    timestamp: audit.timestamp,
    status: metadata.newStatus ?? metadata.dispatchStatus ?? metadata.decision ?? null,
  };
}

export function createReportingService({
  applicationModel = Application,
  auditLogModel = AuditLog,
  dispatchModel = CardDispatch,
} = {}) {
  return {
    async statusCounts() {
      const rows = await applicationModel.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]);
      const counts = Object.fromEntries(applicationStatuses.map((status) => [status, 0]));
      for (const row of rows) {
        if (row._id in counts) counts[row._id] = row.count;
      }
      return counts;
    },

    async listApplications(query) {
      const filter = applicationFilter(query);
      const [items, total] = await Promise.all([
        applicationModel.find(filter)
          .select('applicationNumber applicationDate status income creditScoreResult creditDecision')
          .sort({ applicationDate: -1 })
          .skip(query.skip)
          .limit(query.limit)
          .lean(),
        applicationModel.countDocuments(filter),
      ]);
      const applicationIds = items.map((item) => item._id).filter(Boolean);
      const dispatches = applicationIds.length > 0
        ? await dispatchModel.find({ application: { $in: applicationIds } })
          .select('application dispatchStatus')
          .lean()
        : [];
      const dispatchStatusByApplication = new Map(
        dispatches.map((dispatch) => [dispatch.application.toString(), dispatch.dispatchStatus]),
      );
      return {
        items: items.map((item) => safeApplication({
          ...item,
          dispatchStatus: item._id
            ? dispatchStatusByApplication.get(item._id.toString()) ?? null
            : null,
        })),
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      };
    },

    async listAuditLogs(query) {
      const filter = {};
      if (query.action) filter.action = query.action;
      if (query.targetResource) filter.targetResource = query.targetResource;
      if (query.dateFrom || query.dateTo) {
        filter.timestamp = {};
        if (query.dateFrom) filter.timestamp.$gte = query.dateFrom;
        if (query.dateTo) filter.timestamp.$lte = query.dateTo;
      }
      const [items, total] = await Promise.all([
        auditLogModel.find(filter)
          .select('actor action targetResource timestamp metadata')
          .sort({ timestamp: -1 })
          .skip(query.skip)
          .limit(query.limit)
          .lean(),
        auditLogModel.countDocuments(filter),
      ]);
      return {
        items: items.map(safeAudit),
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      };
    },
  };
}
