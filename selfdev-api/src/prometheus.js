import prometheus from 'prom-client'

import conf, { hasProfile } from './conf.js'
import { log, warn, error, Verbose } from './services.js'

const verbose = Verbose('sd:prometheus'); verbose('')

let pushgateway = null
if (hasProfile(['all', 'h9y', 'metrics'])) {
  try {
    pushgateway = new prometheus.Pushgateway(conf.prometheus.pushgatewayUrl);
  } catch (err) {
    error('Error connecting to Pushgateway:', err)
  }
}

setInterval(async () => {
  if (!hasProfile(['all', 'h9y', 'metrics'])) {
    return;
  }
  try {
    await pushgateway.pushAdd({ jobName: conf.container.id, containerId: conf.container.id })
    // verbose('Metrics pushed');
  } catch (err) {
    error('Error pushing metrics:', err.toString());
  }
}, conf.prometheus.pushIntervalSec * 1000)

export default prometheus
