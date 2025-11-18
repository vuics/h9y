import prometheus from 'prom-client'

import conf from './conf.js'
import { log, warn, error, Verbose } from './services.js'

const verbose = Verbose('sd:prometheus'); verbose('')

const pushgateway = new prometheus.Pushgateway(conf.prometheus.pushgatewayUrl);

setInterval(async () => {
  try {
    await pushgateway.pushAdd({ jobName: conf.container.id, containerId: conf.container.id })
    // verbose('Metrics pushed');
  } catch (err) {
    error('Error pushing metrics:', err.toString());
  }
}, conf.prometheus.pushIntervalSec * 1000)

export default prometheus
