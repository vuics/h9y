import ClaudeCodeV1 from './claudecode-v1.js';

import { createSwarm } from './core.js';
import { log } from '../services.js';
import { sleep } from '../utils/helper.js';
import conf from '../conf.js';

const swarm = createSwarm({
  archetypeClasses: {
    "claudecode-v1.0": ClaudeCodeV1,
  },
  service: 'swarm-claudecode'
});

(async () => {
  const sleepTime = Math.random() * 3;
  log(`Sleeping for ${sleepTime.toFixed(3)} seconds`);
  await sleep(sleepTime * 1000);

  log(`Starting claudecode container: ${conf.container.id}`);
  swarm.monitorAgents();
})();
