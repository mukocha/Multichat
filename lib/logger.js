function logPollError(platform, operation, error) {
  const message = error && error.message ? error.message : String(error || 'error desconocido');
  console.warn(`[Polling:${platform}] ${operation}: ${message}`);
}

module.exports = { logPollError };
