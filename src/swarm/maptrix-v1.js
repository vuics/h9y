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

const verbose = Verbose('sd:swarm/index'); verbose('')

export default class MaptrixV1 extends XmppAgent {
  constructor (args) {
    super(args)
    // const { agent } = args
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
    try {
      // // return super.chat({ prompt, replyFunc })
      // // replyFunc({ content: '12a' })
      // verbose('chat prompt:', prompt)
      // const content = prompt + '_' + prompt
      // verbose('chat content:', content)
      // return content


      verbose(`prompt: ${prompt}`);
      // verbose(`this.agent.options: ${JSON.stringify(this.agent.options)}`);
      const { maptrix } = this.agent.options;
      // verbose('maptrix:', maptrix)
      let input = {};
      if (maptrix.input) {
        input = cloneDeep(maptrix.input);
      }
      // verbose('input:', input)
      if (maptrix.parseJson) {
        try {
          const parsedJson = extractAndParseJson(prompt);
          // verbose(`parsed_json: ${JSON.stringify(parsedJson)}`);
          Object.assign(input, parsedJson);
        } catch (e) {
          // ignore parsing errors
        }
      }
      // verbose('promptKey:', maptrix.promptKey)
      if (maptrix.promptKey) {
        input[maptrix.promptKey] = prompt;
      }
      verbose('input:', input);


      const { mapId } = this.agent.options.maptrix
      const basicMap = await Map.findById(mapId);
      if (!basicMap) {
        return 'Error: map not found'
      }
      if (!basicMap.userId.equals(this.agent.userId._id)) {
        return 'Access to the map is forbidden'
      }

      const resultMap = await deriveMap({ basicMap })
      if (maptrix.sendStatus) {
        replyFunc({ content: `Initialized result map ${resultMap.title}` })
      }

      const serviceAgent = this.agent
      serviceAgent.options.name = `__maptor_${this.agent.options.name}`
      const serviceXmppAgent = new XmppAgent({
        agent: serviceAgent,
        handleChat: false,
        handleRooms: false,
      })
      await serviceXmppAgent.start()

      const output_text = await executeMap({
        map: resultMap,
        xmppClient: serviceXmppAgent.xmppClient,
        input,
        output: maptrix.output,
      })
      if (maptrix.sendStatus) {
        replyFunc({ content: `Done execution of result map ${resultMap.title}` })
      }
      return output_text
    } catch (err) {
      error('Error chatting maptrix:', err)
    }
  }
}

// NOTE: this is a test function
// (async function main () {
//   try {
//     process.on('uncaughtException', (err) => {
//       error('uncaughtException:', err)
//     })
//     log('start main')
//     const agent = await Agent.findById('68e8efec324c85c56c00f4d1').populate('userId').lean()
//     verbose('agent:', agent)
//     if (!agent) {
//       error('Agent is not found')
//     }
//     const xmppAgent = new MaptrixV1({ agent })
//     await xmppAgent.start()
//     log('xmppAgent started')
//     log('done main')
//   } catch (err) {
//     error('Error on main:', err)
//   }
// })()
