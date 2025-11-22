import cron from 'node-cron';

import { log, warn, error, Verbose } from '../services.js'
import Connector from './connector.js'
import XmppAgent from '../swarm/xmpp-agent.js'
import conf from '../conf.js'

const verbose = Verbose('sd:bridge/scheduler'); verbose('')

// Allow insecure certificates (without showing warning)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// nunjucks.configure({ autoescape: false })


export default class Scheduler extends Connector {
  constructor (args) {
    super(args)
    // const { bridge } = args
    verbose('Scheduler constructed')

    verbose('this.bridge:', this.bridge)

    this.xmppAgent = new XmppAgent({
      agent: {
        _id: `bridge:${this.bridge._id.toString()}`,
        archetype: `bridge:${this.bridge.connector}`,
        options: {
          name: this.bridge.options.name,
          joinRooms: this.bridge.options.joinRooms,
        },
        userId: this.bridge.userId,
      },
      handleChat: this.bridge.options.enablePersonal,
      handleRooms: this.bridge.options.enableRoom,
    })
    this.task = null
  }

  async start () {
    super.start()
    verbose('Scheduler started')
    try {
      await this.xmppAgent.start()
      // this.xmppAgent.chat = async ({ prompt, replyFunc=()=>{} } = {}) => {
      //   verbose('Scheduler received chat with prompt:', prompt)
      //   return ''
      // }

      this.task = cron.schedule(this.bridge.options.scheduler.cron, async () => {
        try {
          log(`[${new Date().toISOString()}] scheduler:`, this.bridge.options.name,
            ', cron:', this.bridge.options.scheduler.cron,
            ', sends message:', this.bridge.options.scheduler.message,
          );
          this.slog('debug', 'Scheduler started task')
          if (this.bridge.options.enablePersonal) {
            await this.xmppAgent.xmppClient.sendPersonalMessage({
              recipient: this.bridge.options.recipient,
              prompt: this.bridge.options.scheduler.message,
            })
          }
          if (this.bridge.options.enableRoom && this.bridge.options.joinRooms?.length > 0) {
            await this.xmppAgent.xmppClient.sendRoomMessage({
              room: this.bridge.options.joinRooms[0],
              recipient: this.bridge.options.recipientNickname,
              prompt: this.bridge.options.scheduler.message,
              mucHost: conf.xmpp.mucHost,
            })
          }
        } catch (err) {
          error('Error running scheduled task:', this.bridge.options.name,
            ', error:', err)
          this.slog('error', 'Error running scheduled task', {
            error: err.toString()
          })
        }
      }, {
        name: this.bridge.options.name,
        // maxExecutions: this.bridge.options.scheduler.maxExecutions,
        timezone: this.bridge.options.scheduler.timezone || undefined,
        maxRandomDelay: this.bridge.options.scheduler.maxRandomDelay,
      });
      await this.task.start()
    } catch (err) {
      error('Error starting Scheduler:', err)
      this.slog('error', 'Error starting Scheduler', {
        error: err.toString()
      })
      return
    }
    this.slog('debug', 'Bridge started')
  }

  async stop () {
    super.stop()
    this.xmppAgent.stop()
    this.task.destroy()
    verbose('Scheduler stopped')
    this.slog('debug', 'Bridge stopped')
  }
}
