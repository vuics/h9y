import { log, warn, error, Verbose } from '../services.js'
import XmppAgent from './xmpp-agent.js'
import conf from '../conf.js'

const verbose = Verbose('sd:swarm/proxy-v1'); verbose('')

export default class ProxyV1 extends XmppAgent {
  constructor (args) {
    super(args)
    // const { agent } = args
    verbose('ProxyV1 constructed')
    this.replyBackFuncs = {}
  }

  async start () {
    super.start()
    verbose('ProxyV1 started')
    this.slog('debug', 'Agent started')
  }

  async stop () {
    super.stop()
    verbose('ProxyV1 stopped')
    this.slog('debug', 'Agent stopped')
  }

  async chat({ prompt, replyFunc=()=>{}, from } = {}) {
    try {

      verbose(`prompt: ${prompt}`);
      // verbose(`this.agent.options: ${JSON.stringify(this.agent.options)}`);
      const { proxy } = this.agent.options;
      verbose('proxy:', proxy)

      // Accepted commands:
      //
      // Forward the message to recipient:
      // ```json
      // {
      //   "action": "forward",
      //   "recipient": "recipient@x.h9y.ai",
      //   "message": "Hello, World!",
      //   "controlKey": "Please, do it! :-)"
      // }
      // ```
      //
      // Reset the proxy agent
      // ```json
      // {
      //   "action": "reset",
      //   "controlKey": "Please, do it! :-)"
      // }
      // ```

      let control
      try {
        control = JSON.parse(prompt.trim());
      } catch (err) {
        control = null
        // NOTE: It is ok if the JSON cannot be parsed.
        // The response from recipient can be a regular text.
      }
      verbose('control:', control)
      this.slog('debug', 'Parsed control object', {
        control,
      })

      if (control && control.action && control.recipient && control.message && control.controlKey) {
        if (control.controlKey !== proxy.controlKey) {
          throw new Error(`controlKey missmatch`)
        }
        if (control.action === 'reset') {
          this.replyBackFuncs[control.recipient] = []
        } else if (control.action === 'forward') {
          this.xmppClient.sendPersonalMessage ({
            recipient: control.recipient,
            prompt: control.message,
          })
          verbose('control.recipient:', control.recipient)
          this.replyBackFuncs[control.recipient] = replyFunc
          verbose('replyBackFuncs:', this.replyBackFuncs)
        }
      } else {
        verbose('prompt:', prompt)
        verbose('from:', from)
        verbose('replyBackFuncs:', this.replyBackFuncs)
        const replyTo = from.split('/')[0]
        verbose('replyTo:', replyTo)
        if (replyTo in this.replyBackFuncs) {
          const replyBackFunc = this.replyBackFuncs[replyTo]
          verbose('replyBackFunc:', this.replyBackFunc)
          replyBackFunc({ content: prompt })
        } else {
          throw new Error('Error: unrecognized control command or reply')
        }
      }

      return;
    } catch (err) {
      error('Error chatting ProxyV1:', err)
      this.slog('error', 'Error chatting', {
        error: err.toString()
      })
      return err.toString()
    }
  }
}

