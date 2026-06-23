import { Client } from '@opensearch-project/opensearch';

import { log, warn, error, Verbose } from './services.js'
import conf, { hasProfile } from './conf.js'

const verbose = Verbose('sd:opensearch'); verbose('')

let opensearch = null

if (hasProfile(['all', 'h9y', 'logs'])) {
  try {
    opensearch = new Client({
      node: `http${conf.opensearch.secure && 's'}://${conf.opensearch.username}:${conf.opensearch.password}@${conf.opensearch.host}:${conf.opensearch.port}`,
      ssl: {
        ca: null,
        rejectUnauthorized: false,
      },
    });
    // verbose('opensearch:', opensearch)
  } catch (err) {
    error('Error connecting to OpenSearch:', err)
  }
}

export default opensearch

export async function sendLog(level, message, meta = {}) {
  if (!hasProfile(['all', 'h9y', 'logs'])) {
    return;
  }
  // verbose('sendLogs level:', level, ', message:', message, ', meta:', meta)
  const doc = {
    '@timestamp': new Date().toISOString(),
    level,
    message,
    ...meta,
  };

  await opensearch.index({
    index: 'logs',
    body: doc,
  });
}
