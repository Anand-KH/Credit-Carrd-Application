export function createReportingController(reportingService) {
  return {
    statusCounts: async (_request, response) => {
      response.status(200).json({ counts: await reportingService.statusCounts() });
    },
    applications: async (request, response) => {
      response.status(200).json(await reportingService.listApplications(request.reportQuery));
    },
    auditLogs: async (request, response) => {
      response.status(200).json(await reportingService.listAuditLogs(request.auditQuery));
    },
  };
}
