export function createApplicationController(applicationService) {
  return {
    submit: async (request, response) => {
      const application = await applicationService.submit(request.auth.userId, request.body);
      response.status(201).json({ application });
    },
    listMine: async (request, response) => {
      const result = await applicationService.listForUser(request.auth.userId, request.pagination);
      response.status(200).json(result);
    },
    trackMine: async (request, response) => {
      const result = await applicationService.getTrackingForUser(
        request.auth.userId,
        request.params.applicationNumber,
      );
      response.status(200).json({ application: result });
    },
  };
}
