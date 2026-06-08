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
import { sleep, run, spawnLogged } from '../utils/helper.js'

const verbose = Verbose('sd:swarm/openclaw-v1'); verbose('')

const OPENCLAW_GATEWAY_TOKEN='SelfDev-GW-Token'


export default class OpenclawV1 extends XmppAgent {
  constructor(args) {
    super(args);
    // const { agent } = args
    verbose('OpenclawV1 constructed');

    this.gateway = null
    this.client = null
  }

  async start() {
    super.start();

    process.chdir('/app');

    await run('node', ['/app/openclaw.mjs', 'setup']);

    await run('node', [
      '/app/openclaw.mjs',
      'config',
      'set',
      'gateway.http.endpoints.chatCompletions.enabled',
      'true',
    ]);

    this.gateway = spawnLogged(
      'node',
      ['/app/openclaw.mjs', 'gateway', '--token', OPENCLAW_GATEWAY_TOKEN],
      { cwd: '/app' }
    );

    await sleep(3000)

    const { openclaw } = this.agent.options;

    if (openclaw.model.provider == 'ollama') {
      await run('node', [
        '/app/openclaw.mjs',
        'onboard',
        '--non-interactive',
        '--auth-choice', 'ollama',
        '--gateway-auth', 'token',
        '--gateway-token', OPENCLAW_GATEWAY_TOKEN,
        '--custom-base-url', conf.ollama.baseUrl,
        '--custom-model-id', openclaw.model.name,
        '--accept-risk',
      ]);
    } else if (openclaw.model.provider == 'openai') {
      await run('node', [
        '/app/openclaw.mjs',
        'onboard',
        '--non-interactive',
        '--auth-choice', 'openai-api-key',
        '--openai-api-key', openclaw.model.apiKey,
        '--gateway-auth', 'token',
        '--gateway-token', OPENCLAW_GATEWAY_TOKEN,
        '--custom-model-id', openclaw.model.name,
        '--accept-risk',
      ]);
    } else if (openclaw.model.provider == 'anthropic') {
      await run('node', [
        '/app/openclaw.mjs',
        'onboard',
        '--non-interactive',
        '--anthropic-api-key', openclaw.model.apiKey,
        '--gateway-auth', 'token',
        '--gateway-token', OPENCLAW_GATEWAY_TOKEN,
        '--custom-model-id', openclaw.model.name,
        '--accept-risk',
      ]);
    } else { // custom
      await run('node', [
        '/app/openclaw.mjs',
        'onboard',
        '--non-interactive',
        '--auth-choice', 'custom-api-key',
        '--custom-api-key', openclaw.model.apiKey,
        '--gateway-auth', 'token',
        '--gateway-token', OPENCLAW_GATEWAY_TOKEN,
        '--custom-base-url', `${conf.ollama.baseUrl}/v1`,
        '--custom-model-id', openclaw.model.name,
        '--secret-input-mode', 'plaintext',
        '--custom-compatibility', 'openai',
        '--custom-image-input',
        '--accept-risk',
      ]);
    }

    this.client = new OpenAI({
      apiKey: OPENCLAW_GATEWAY_TOKEN,
      baseURL: 'http://127.0.0.1:18789/v1',
    });

    verbose('OpenclawV1 started');
    this.slog('debug', 'Agent started')
  }

  async stop() {
    super.stop();

    this.gateway.kill('SIGTERM');
    verbose('OpenclawV1 stopped');
    this.slog('debug', 'Agent stopped')
  }

  async chat({ prompt, replyFunc=()=>{}, from } = {}) {
    try {
      verbose(`prompt: ${prompt}`);
      const { openclaw } = this.agent.options;
      verbose('openclaw:', openclaw)

      if (!this.client) {
        throw new Error('OpenClaw client is still initializing...')
      }
      verbose('XMPP chat received:', prompt);
      const completion = await this.client.chat.completions.create({
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
