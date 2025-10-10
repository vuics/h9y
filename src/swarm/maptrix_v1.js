import { log, warn, error, Verbose } from '../services.js'
import Map from '../models/map.js'

const verbose = Verbose('sd:swarm/index'); verbose('')

export class XmppAgent {
  constructor ({ agent }) {
    this.agent = agent
  }

  async start () {
  }

  async stop () {
  }
}

export default class MaptrixV1 extends XmppAgent {
  constructor (args) {
    super(args)
    // const { param } = args
    verbose('MaptrixV1 constructed')
  }

  async start () {
    super.start()

    verbose('MaptrixV1 started')
  }

  async stop () {
    super.stop()
    verbose('MaptrixV1 stopped')
  }
}

