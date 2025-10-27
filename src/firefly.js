import pkg from '@hyperledger/firefly-sdk';
const FireFly = pkg.default;

import { Verbose, log, warn, error } from './services.js'
import conf from './conf.js'

const verbose = Verbose('sd:firefly'); verbose('')

const firefly = new FireFly({
  host: conf.firefly.host,
  namespace: conf.firefly.namespace,
});
export default firefly
