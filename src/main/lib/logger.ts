import log from 'electron-log/main.js';

log.transports.file.level = 'info';
log.transports.console.level = 'debug';

export const logger = {
  debug: log.debug.bind(log),
  info: log.info.bind(log),
  warn: log.warn.bind(log),
  error: log.error.bind(log),
};
