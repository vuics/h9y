import axios from 'axios'
// import stringify from 'json-stringify-pretty-compact';

import OpenAI from 'openai';

// TODO: Implement using OpenClaw App SDK:
//   https://docs.openclaw.ai/concepts/openclaw-sdk
// But there is an issue:
//   https://github.com/openclaw/openclaw/issues/90294
// So at the moment of writing the code,
// using the OpenClaw App SDK was impossible.
//
// import { OpenClaw } from '@openclaw/sdk'

import { log, warn, error, Verbose } from '../services.js'
import XmppAgent from '../swarm/xmpp-agent.js'
import conf from '../conf.js'

const verbose = Verbose('sd:swarm/openclaw-v1'); verbose('')


export default class Openclaw extends XmppAgent {
  constructor(args) {
    super(args);
    // const { agent } = args
    verbose('OpenclawV1 constructed');

    this.client = null
  }

  async start() {
    super.start();

    this.client = new OpenAI({
      // apiKey: process.env['OPENAI_API_KEY'], // This is the default and can be omitted
      apiKey: '123', // FIXME: use secure key
      // "http://127.0.0.1:18789/v1/chat/completions"
      baseURL: 'http://127.0.0.1:18789/v1',
    });

    verbose('OpenclawV1 started');
    this.slog('debug', 'Agent started')
  }

  async stop() {
    super.stop();
    verbose('OpenclawV1 stopped');
    this.slog('debug', 'Agent stopped')
  }

  async chat({ prompt, replyFunc=()=>{}, from } = {}) {
    try {
      verbose(`prompt: ${prompt}`);
      const { openclaw } = this.agent.options;
      verbose('openclaw:', openclaw)

      verbose('XMPP chat received:', prompt);
      const completion = await this.client.chat.completions.create({
        // model: 'gpt-5.5',  // FIXME
        // model: 'main', // Maps to your target OpenClaw agent ID
        messages: [
          { role: 'user', content: prompt },
        ],
      });

      const response = completion.choices[0].message.content
      log('completion content:', response);

      return response

    } catch (err) {
      error('Error chatting Openclaw:', err)
      return err.toString()
    }
  }
}
