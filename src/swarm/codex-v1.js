import { Codex } from "@openai/codex-sdk";

import { log, warn, error, Verbose } from '../services.js'
import XmppAgent from '../swarm/xmpp-agent.js'
import conf from '../conf.js'
import { sleep, run, spawnLogged } from '../utils/helper.js'

const verbose = Verbose('sd:swarm/codex-v1'); verbose('')


export default class CodexV1 extends XmppAgent {
  constructor(args) {
    super(args);
    // const { agent } = args
    verbose('CodexV1 constructed');

    this.codexClient = null
    this.codexThread = null
  }

  async start() {
    super.start();
    const { codex } = this.agent.options;

    if (codex.model.provider == 'ollama') {
      this.codexClient = new Codex({
        baseUrl: `${conf.ollama.baseUrl}/v1`,
        apiKey: codex.model.apiKey,
        config: {
          model: codex.model.name,
        },
      });
    } else if (codex.model.provider == 'openai') {
      this.codexClient = new Codex({
        apiKey: codex.model.apiKey,
        config: {
          model: codex.model.name,
        },
      });
    } else {
      throw new Error(`Unknown model provider: ${codex.model.provider}`)
    }

    this.codexThread = this.codexClient.startThread();

    verbose('CodexV1 started');
    this.slog('debug', 'Agent started')
  }

  async stop() {
    super.stop();

    // this.gateway.kill('SIGTERM');
    verbose('CodexV1 stopped');
    this.slog('debug', 'Agent stopped')
  }

  async chat({ prompt, replyFunc=()=>{}, from } = {}) {
    try {
      verbose(`prompt: ${prompt}`);
      const { codex } = this.agent.options;
      verbose('codex:', codex)

      const turn = await this.codexThread.run(prompt);
      console.log("finalResponse:", turn.finalResponse);
      console.log("items:", turn.items);

      return turn.finalResponse
    } catch (err) {
      error('Error chatting Codex:', err)
      return err.toString()
    }
  }
}
