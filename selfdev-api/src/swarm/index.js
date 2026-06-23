import MaptrixV1 from './maptrix-v1.js';
import SystemV1 from './system-v1.js';
import TransformV1 from './transform-v1.js';
import ProxyV1 from './proxy-v1.js';
import McpV1 from './mcp-v1.js';
import CurlV1 from './curl-v1.js';
import A2aV1 from './a2a-v1.js';

import { createSwarm } from './core.js';
import { log } from '../services.js';
import { sleep } from '../utils/helper.js';
import conf from '../conf.js';

const swarm = createSwarm({
  archetypeClasses: {
    "maptrix-v1.0": MaptrixV1,
    "system-v1.0": SystemV1,
    "transform-v1.0": TransformV1,
    "proxy-v1.0": ProxyV1,
    "mcp-v1.0": McpV1,
    "curl-v1.0": CurlV1,
    "a2a-v1.0": A2aV1,
  },
  service: 'swarm'
});

(async () => {
  const sleepTime = Math.random() * 3;
  log(`Sleeping for ${sleepTime.toFixed(3)} seconds`);
  await sleep(sleepTime * 1000);

  log(`Starting swarm container: ${conf.container.id}`);
  swarm.monitorAgents();
})();
