const safeFields = new Set([
  'requestId',
  'method',
  'status',
  'durationMs',
  'code',
  'errorName',
  'signal',
  'port',
  'databaseState',
]);

export function createLogger(output = console) {
  function write(level, event, fields = {}) {
    const safeValues = Object.fromEntries(
      Object.entries(fields).filter(([key]) => safeFields.has(key)),
    );
    output.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      event,
      ...safeValues,
    }));
  }

  return {
    info: (event, fields) => write('info', event, fields),
    error: (event, fields) => write('error', event, fields),
  };
}
