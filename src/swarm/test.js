import { log, warn, error, Verbose } from '../services.js'
import Agent from '../models/agent.js'
import '../mongo.js'
import { MaptrixV1 } from './maptrix-v1.js'


const verbose = Verbose('sd:swarm/test'); verbose('')

(async function test () {
  try {
    process.on('uncaughtException', (err) => {
      error('uncaughtException:', err)
    })
    log('start main')
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
