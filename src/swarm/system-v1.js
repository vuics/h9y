import lodash from 'lodash'
const { cloneDeep } = lodash

import { log, warn, error, Verbose } from '../services.js'
import Map from '../models/map.js'
import User from '../models/user.js'
import Agent from '../models/agent.js'
import XmppAgent from './xmpp-agent.js'
import { XmppClient } from '../maptor.js'
import '../mongo.js'
import { deriveMap, executeMap } from '../routes/executor.js'
import conf from '../conf.js'
import { extractAndParseJson } from '../utils/helper.js'

const verbose = Verbose('sd:swarm/system-v1'); verbose('')

export default class SystemV1 extends XmppAgent {
  constructor (args) {
    super(args)
    // const { agent } = args
    verbose('SystemV1 constructed')
  }

  async start () {
    super.start()
    verbose('SystemV1 started')
  }

  async stop () {
    super.stop()
    verbose('SystemV1 stopped')
  }

  async chat({ prompt, replyFunc=()=>{}} = {}) {
    try {
      verbose(`prompt: ${prompt}`);
      // verbose(`this.agent.options: ${JSON.stringify(this.agent.options)}`);
      const { system } = this.agent.options;
      verbose('system:', system)

      return 'system: ' + prompt
    } catch (err) {
      error('Error chatting SystemV1:', err)
    }
  }
}

