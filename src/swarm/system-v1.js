import stringify from 'json-stringify-pretty-compact';
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
import firefly, { decimalToToken, tokenToDecimal, getPoolByIdOrSymbol } from '../firefly.js'


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
      // verbose(`this.agent.options: ${stringify(this.agent.options)}`);
      const { system } = this.agent.options;
      verbose('system:', system)
      const userId = this.agent.userId

      // Parse prompt JSON
      let obj = {};
      try {
        obj = JSON.parse(prompt.trim());
      } catch (err) {
        throw new Error(`Cannot parse the JSON from the prompt: ${err}`)
      }

      verbose('obj:', obj)
      const { _id, data } = obj
      verbose('_id:', _id, ', data:', data)
      const operation = obj.operation || system.operation;
      const model = obj.model || system.model;
      verbose('operation:', operation, ', model:', model)

      let Model = null
      if (['create', 'get', 'update', 'delete', 'list'].includes(operation)) {
        switch (model) {
          case 'map': Model = Map; break
          case 'agent': Model = Agent; break
          default:
            throw new Error('Unknown model')
        }
      }

      let output = ''
      switch (operation) {
        case 'create':
          const doc = await createDocument({ Model, data, userId })
          output = stringify(doc)
          break
        case 'get':
          if (!_id) { throw new Error('The _id field is not present in the prompt') }
          const fetched = await getDocumentById({ Model, _id, userId });
          output = stringify(fetched)
          break
        case 'update':

          // TODO: permit operation only for the admin superuser with special previliges
          throw new Error('Operation is not permitted')

          if (!_id) { throw new Error('The _id field is not present in the prompt') }
          const updated = await updateDocumentById({ Model, _id, data, userId });
          output = stringify(updated)
          break
        case 'delete':

          // TODO: permit operation only for the admin superuser with special previliges
          throw new Error('Operation is not permitted')

          if (!_id) { throw new Error('The _id field is not present in the prompt') }
          await deleteDocumentById({ Model, _id, userId });
          output = stringify({})
          break

        case 'list':

          // TODO: permit operation only for the admin superuser with special previliges
          throw new Error('Operation is not permitted')

          const index = await listDocuments({
            Model,
            userId,
            filter: data.filter,
            options: data.options
          });
          output = stringify(index)
          break

        case 'account': {
          let out = {}
          try {
            verbose('account')
            const user = await User.findById(userId)
            // let balances = []
            const balances = await firefly.getTokenBalances({
              key: user.firefly.address,
            })
            console.log('balances:', balances)

            // let pools = []
            const pools = await firefly.getTokenPools()
            console.log('pools:', pools)

            out = {
              result: 'ok',
              address: user.firefly.address,
              identityId: user.firefly.identityId,
              balances: balances.map(({ pool, tokenIndex, uri, key, balance }) => {
                const foundPool = pools?.find(p => p.id === pool)
                const { type, decimals } = foundPool
                return ({
                  pool, tokenIndex, uri, key,
                  balance: type === 'fungible' ? tokenToDecimal(balance, decimals) : balance,
                })
              }),
              pools: pools.map(({ id, type, symbol, active, decimals }) => ({ id, type, symbol, active, decimals })),
            }
            verbose('out:', out)
          } catch (err) {
            out = { result: 'error', message: err.toString()}
          }
          output = stringify(out)
          break
        }

        case 'transfer': {
          let out = {}
          try {
            verbose('transfer')
            const user = await User.findById(userId)
            // verbose('user:', user)
            let { pool: poolId } = obj
            verbose('poolId:', poolId)
            const { symbol, to, tokenIndex, amount } = obj
            verbose('symbol:', symbol)
            const { id, decimals, type } = await getPoolByIdOrSymbol({ poolId, symbol })
            verbose('pool id:', id, ', to:', to, ', tokenIndex:', tokenIndex, ', amount:', amount, ', type:', type)
            verbose('tranfer amount:', type === 'fungible' ? decimalToToken(amount, decimals) : amount)
            const transferred = await firefly.transferTokens({
              pool: id,
              to,
              from: user.firefly.address,
              key: user.firefly.address, // from and key are the same, no need the approval
              tokenIndex,
              amount: type === 'fungible' ? decimalToToken(amount, decimals) : amount,
            });
            verbose('transferred:', transferred)
            out = {
              result: 'ok',
              localId: transferred.localId,
              pool: transferred.pool,
              from: transferred.from,
              to: transferred.to,
              key: transferred.key,
              tokenIndex: transferred.tokenIndex,
              amount: type === 'fungible' ? tokenToDecimal(transferred.amount, decimals) : transferred.amount,
            }
          } catch (err) {
            out = { result: 'error', message: err.toString()}
          }
          output = stringify(out)
          break
        }

        case 'collect': {
          let out = {}
          try {
            verbose('collect')
            const user = await User.findById(userId)
            // verbose('user:', user)
            let { pool: poolId } = obj
            const { symbol, from, tokenIndex, amount } = obj
            const { id, decimals, type } = await getPoolByIdOrSymbol({ poolId, symbol })
            verbose('pool id:', id, ', from:', from, ', tokenIndex:', tokenIndex, ', amount:', amount)
            const collected = await firefly.transferTokens({
              pool: id,
              to: user.firefly.address,
              from,
              key: user.firefly.address, // from and key are different, need an approval
              tokenIndex,
              amount: type === 'fungible' ? decimalToToken(amount, decimals) : amount,
            });
            verbose('collected:', collected)
            out = {
              result: 'ok',
              localId: collected.localId,
              pool: collected.pool,
              from: collected.from,
              to: collected.to,
              key: collected.key,
              tokenIndex: collected.tokenIndex,
              amount: type === 'fungible' ? tokenToDecimal(collected.amount, decimals) : collected.amount,
            }
          } catch (err) {
            out = { result: 'error', message: err.toString()}
          }
          output = stringify(out)
          break
        }

        default:
          throw new Error('Unknown operation')
      }
      return output
    } catch (err) {
      error('Error propmting SystemV1:', err)
      return err.toString()
    }
  }
}

