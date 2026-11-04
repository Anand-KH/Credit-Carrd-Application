export function createApprovalController(approvalService) {
  return {
    list: async (request, response) => {
      const result = await approvalService.list(request.approvalQuery);
      response.status(200).json(result);
    },
    get: async (request, response) => {
      const application = await approvalService.get(request.params.applicationNumber);
      response.status(200).json({ application });
    },
    decide: async (request, response) => {
      const application = await approvalService.decide(
        request.params.applicationNumber,
        request.auth,
        request.body,
      );
      response.status(200).json({ application });
    },
  };
}
