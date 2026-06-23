import { inspect } from 'util'
import { A2AClient } from '@a2a-js/sdk/client';
import { randomUUID } from 'crypto'
import stringify from 'json-stringify-pretty-compact';

import { log, warn, error, Verbose } from '../services.js'
import XmppAgent from './xmpp-agent.js'
import conf from '../conf.js'
import { sleep, joinUrl } from '../utils/helper.js'

const verbose = Verbose('sd:swarm/a2a-v1'); verbose('')


export default class A2aV1 extends XmppAgent {
  constructor (args) {
    super(args)
    // const { agent } = args
    verbose('A2aV1 constructed')
    this.agentCardUrl = null
    this.client = null
  }

  async start () {
    super.start()
    verbose('A2aV1 started')
    try {
      verbose('a2a.url:', this.agent.options.a2a.url)
      this.agentCardUrl = joinUrl(
        this.agent.options.a2a.url,
        '/.well-known/agent-card.json',
      )
      this.slog('debug', 'Agent started')
    } catch (err) {
      error('Error starting A2a client:', err)
      this.slog('error', 'Error starting A2a client', {
        error: err.toString()
      })
    }
  }

  async stop () {
    super.stop()
    verbose('A2aV1 stopped')
    this.slog('debug', 'Agent stopped')
  }

  async chat({ prompt, replyFunc=()=>{}, from } = {}) {
    try {
      verbose(`prompt: ${prompt}`);

      let sendParams = {}
      if (this.agent.options.a2a.textOnly) {
        sendParams = {
          message: {
            messageId: randomUUID(),
            role: 'user',
            parts: [{ kind: 'text', text: prompt }],
            kind: 'message',
          },
        };
      } else {
        try {
          sendParams = JSON.parse(prompt.trim());
        } catch (err) {
          throw new Error(`Error parsing a2a command: ${err}`)
        }
      }
      verbose('sendParams:', sendParams)

      verbose('agentCardUrl:', this.agentCardUrl)
      this.client = await A2AClient.fromCardUrl(this.agentCardUrl);

      const response = await this.client.sendMessage(sendParams);
      log('response:', inspect(response, { depth: null, colors: true }))

      if (response.error) {
        error('Error:', response.error.message);
        throw new Error(`Response error: ${response.error.message}`)
      }

      let content = ''
      if (this.agent.options.a2a.textOnly) {
        content = (response?.result?.parts || [])
          .filter(p => p.kind === 'text' && typeof p.text === 'string')
          .map(p => p.text)
          .join(' ');
        verbose('Agent text response:', content);
      } else {
        content = stringify(response)
      }
      return content;
    } catch (err) {
      error('Error chatting A2aV1:', err)
      this.slog('error', 'Error chatting', {
        error: err.toString()
      })
      return err.toString()
    }
  }
}

