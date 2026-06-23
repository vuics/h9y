import OpenclawV1 from './openclaw-v1.js';

import { createSwarm } from './core.js';
import { log } from '../services.js';
import { sleep } from '../utils/helper.js';
import conf from '../conf.js';

const swarm = createSwarm({
  archetypeClasses: {
    "openclaw-v1.0": OpenclawV1,
  },
  service: 'swarm-openclaw'
});

(async () => {
  const sleepTime = Math.random() * 3;
  log(`Sleeping for ${sleepTime.toFixed(3)} seconds`);
  await sleep(sleepTime * 1000);

  log(`Starting swarm-openclaw container: ${conf.container.id}`);
  swarm.monitorAgents();
})();
