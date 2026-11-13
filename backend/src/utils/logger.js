const safeFields = new Set([
  'requestId',
  'method',
  'status',
  'durationMs',
  'code',
  'errorName',
  'errorMessage',
  'causes',
  'errorLocation',
  'signal',
  'port',
  'databaseState',
]);

function sanitizeErrorMessage(message) {
  return String(message).replace(
    /(mongodb(?:\+srv)?:\/\/)[^\s/@]+@/gi,
    '$1[redacted]@',
  );
}

export function getErrorLogDetails(error) {
  const serverErrors = error?.reason?.servers instanceof Map
    ? [...error.reason.servers.values()].map((server) => server.error).filter(Boolean)
    : [];
  const causes = [error?.cause, ...serverErrors]
    .filter((cause) => cause?.message)
    .map((cause) => sanitizeErrorMessage(cause.message));

  return {
    errorMessage: sanitizeErrorMessage(error?.message ?? error),
    causes: [...new Set(causes)],
  };
}

/**
 * Returns where an error was thrown (file:line:column of the first stack frame
 * outside node_modules and Node internals). Unlike the message, a stack location
 * never contains request data, so it is safe to log for unexpected errors.
 */
export function getErrorLocation(error) {
  const frames = typeof error?.stack === 'string' ? error.stack.split('\n').slice(1) : [];
  for (const frame of frames) {
    const match = /\(?((?:file:\/\/)?[^()\s]+?):(\d+):(\d+)\)?\s*$/.exec(frame.trim());
    if (!match || match[1].startsWith('node:') || match[1].includes('node_modules')) {
      continue;
    }
    const file = match[1].replace(/^file:\/\/\/?/, '').replace(/\\/g, '/');
    const srcIndex = file.lastIndexOf('/src/');
    const relative = srcIndex >= 0 ? file.slice(srcIndex + 1) : file.split('/').slice(-2).join('/');
    return `${relative}:${match[2]}:${match[3]}`;
  }
  return null;
}

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
