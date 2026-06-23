import CodexV1 from './codex-v1.js';

import { createSwarm } from './core.js';
import { log } from '../services.js';
import { sleep } from '../utils/helper.js';
import conf from '../conf.js';

const swarm = createSwarm({
  archetypeClasses: {
    "codex-v1.0": CodexV1,
  },
  service: 'swarm-codex'
});

(async () => {
  const sleepTime = Math.random() * 3;
  log(`Sleeping for ${sleepTime.toFixed(3)} seconds`);
  await sleep(sleepTime * 1000);

  log(`Starting swarm-codex container: ${conf.container.id}`);
  swarm.monitorAgents();
})();
