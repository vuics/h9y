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
import {
  createDocument, getDocumentById, updateDocumentById, deleteDocumentById,
  listDocuments
} from '../crud.js'


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
      const userId = this.agent.userId

      // Parse prompt JSON
      let obj = {};
      try {
        obj = JSON.parse(prompt.trim());
      } catch (err) {
        obj = {};
        warn('Cannot parse the JSON from the prompt')
      }
      verbose('obj:', obj);

      verbose('obj:', obj)
      const { _id, data } = obj
      verbose('_id:', _id, ', data:', data)
      const operation = obj.operation || system.operation;
      const model = obj.model || system.model;
      verbose('operation:', operation, ', model:', model)

      let Model = null
      switch (model) {
        case 'map': Model = Map; break
        case 'agent': Model = Agent; break
        default:
          throw new Error('Unknown model')
      }

      let output = ''
      switch (operation) {
        case 'create':
          const doc = await createDocument({ Model, data, userId })
          output = JSON.stringify(doc)
          break
        case 'get':
          if (!_id) { throw new Error('The _id field is not present in the prompt') }
          const fetched = await getDocumentById({ Model, _id, userId });
          output = JSON.stringify(fetched)
          break
        case 'update':
          if (!_id) { throw new Error('The _id field is not present in the prompt') }
          const updated = await updateDocumentById({ Model, _id, data, userId });
          output = JSON.stringify(updated)
          break
        case 'delete':
          if (!_id) { throw new Error('The _id field is not present in the prompt') }
          await deleteDocumentById({ Model, _id, userId });
          output = JSON.stringify({})
          break
        case 'list':
          const index = await listDocuments({
            Model,
            userId,
            filter: data.filter,
            options: data.options
          });
          output = JSON.stringify(index)
          break
        default:
          throw new Error('Unknown operation')
      }
      return output
    } catch (err) {
      error('Error propmting SystemV1:', err)
      return `Error prompting SystemV1: ${err}`
    }
  }
}

