import { query } from "@anthropic-ai/claude-agent-sdk";

import { log, warn, error, Verbose } from '../services.js'
import XmppAgent from '../swarm/xmpp-agent.js'
import conf from '../conf.js'
import { sleep, run, spawnLogged } from '../utils/helper.js'

const verbose = Verbose('sd:swarm/claudecode-v1'); verbose('')


export default class ClaudeCodeV1 extends XmppAgent {
  constructor(args) {
    super(args);
    // const { agent } = args
    verbose('ClaudeCodeV1 constructed');
    this.env = {
      ...process.env,
    }
  }

  async start() {
    super.start();
    const { claudecode } = this.agent.options;

    if (claudecode.model.provider == 'ollama') {
      this.env = {
        ...process.env,
        ANTHROPIC_API_KEY: claudecode.model.apiKey,
        ANTHROPIC_BASE_URL: conf.ollama.baseUrl,
        ANTHROPIC_MODEL: claudecode.model.name,
      }
    } else if (claudecode.model.provider == 'anthropic') {
      this.env = {
        ...process.env,
        ANTHROPIC_API_KEY: claudecode.model.apiKey,
        ANTHROPIC_MODEL: claudecode.model.name,
      }
    } else {
      throw new Error(`Unknown model provider: ${claudecode.model.provider}`)
    }

    verbose('ClaudeCodeV1 started');
    this.slog('debug', 'Agent started')
  }

  async stop() {
    super.stop();

    verbose('ClaudeCodeV1 stopped');
    this.slog('debug', 'Agent stopped')
  }

  async chat({ prompt, replyFunc=()=>{}, from } = {}) {
    try {
      verbose(`prompt: ${prompt}`);
      const { claudecode } = this.agent.options;
      verbose('claudecode:', claudecode)

      let response = ''

      // Agentic loop: streams messages as Claude works
      for await (const message of query({
        prompt,
        options: {
          env: this.env,
        //   allowedTools: ["Read", "Edit", "Glob"], // Auto-approve these tools
        //   permissionMode: "acceptEdits" // Auto-approve file edits
        }
      })) {
        verbose('claudecode message:', message)
        // Print human-readable output
        if (message.type === "assistant" && message.message?.content) {
          for (const block of message.message.content) {
            if ("text" in block) {
              log('Reasoning:', block.text); // Claude's reasoning
              await replyFunc({ content: block.text })
            } else if ("name" in block) {
              log(`Tool: ${block.name}`); // Tool being called
              await replyFunc({ content: `Tool: ${block.name}` })
            }
          }
        } else if (message.type === "result") {
          log(`Done: ${message.subtype}`); // Final result
          // if (message.subtype !== "success") {
          // }
          response = message.subtype
        }
      }

      return response
    } catch (err) {
      error('Error chatting ClaudeCode:', err)
      return err.toString()
    }
  }
}
