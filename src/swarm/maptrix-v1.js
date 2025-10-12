import { log, warn, error, Verbose } from '../services.js'
import Map from '../models/map.js'
import User from '../models/user.js'
import Agent from '../models/agent.js'
import XmppAgent from './xmpp-agent.js'
import { XmppClient } from '../maptor.js'
import '../mongo.js'
import { deriveMap, executeMap } from '../routes/executor.js'
import conf from '../conf.js'

const verbose = Verbose('sd:swarm/index'); verbose('')

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

  async chat({ prompt, replyFunc=()=>{}} = {}) {
    // // return super.chat({ prompt, replyFunc })
    // // replyFunc({ content: '12a' })
    // verbose('chat prompt:', prompt)
    // const content = prompt + '_' + prompt
    // verbose('chat content:', content)
    // return content


    const { mapId } = this.agent.options.maptrix
    const basicMap = await Map.findById(mapId);
    if (!basicMap) {
      return 'Error: map not found'
    }
    if (!basicMap.userId.equals(this.agent.userId._id)) {
      return 'Access to the map is forbidden'
    }

    const resultMap = await deriveMap({ basicMap })
    replyFunc({ content: `Initialized result map ${resultMap.title}` })

    const xmppClient = new XmppClient()
    await xmppClient.connect({
      credentials: {
        user: this.agent.userId.xmpp.user,
        password: this.agent.userId.xmpp.password,
        jid: `${this.agent.userId.xmpp.user}@${conf.xmpp.host}`,
      },
      service: conf.xmpp.websocketUrl,
      domain: conf.xmpp.host,
    })
    console.log('XMPP initialized');

    // await executeMap({ map: resultMap, xmppClient: this.xmppClient })
    await executeMap({ map: resultMap, xmppClient })
    return `Done execution of result map ${resultMap.title}`
  }
}

// FIXME: this is only test function
(async function main () {
  try {
    process.on('uncaughtException', (err) => {
      error('uncaughtException:', err)
    })
    log('start main')
    // FIXME: replace agent id
    const agent = await Agent.findById('68e8efec324c85c56c00f4d1').populate('userId').lean()
    verbose('agent:', agent)
    if (!agent) {
      error('Agent is not found')
    }
    const xmppAgent = new MaptrixV1({ agent })
    await xmppAgent.start()
    log('xmppAgent started')
    log('done main')
  } catch (err) {
    error('Error on main:', err)
  }
})()
