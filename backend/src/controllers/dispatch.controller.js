export function createDispatchController(dispatchService) {
  return {
    list: async (request, response) => {
      response.status(200).json(await dispatchService.list(request.dispatchQuery));
    },
    update: async (request, response) => {
      response.status(200).json({
        dispatch: await dispatchService.update(request.auth, request.body),
      });
    },
  };
}
