import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import stringify from 'json-stringify-pretty-compact';

import { log, warn, error, Verbose } from '../services.js'
import XmppAgent from './xmpp-agent.js'
import conf from '../conf.js'
import { sleep } from '../utils/helper.js'

const verbose = Verbose('sd:swarm/mcp-v1'); verbose('')


export default class McpV1 extends XmppAgent {
  constructor (args) {
    super(args)
    // const { agent } = args
    verbose('McpV1 constructed')
    this.mcpClient = null;
    this.transport = null;
  }

  async start () {
    super.start()
    verbose('McpV1 started')

    try {
      this.sleepSec = 1
      while (true) {
        try {
          this.mcpClient = new Client({
            name: this.agent.options.name,
            version: '1.0.0'
          });

          if (this.agent.options.mcp.transport === 'streamable-http') {
            this.transport = new StreamableHTTPClientTransport(
              new URL(this.agent.options.mcp.url)
            );
            log('Connecting using Streamable HTTP transport:', this.transport);
          } else if (this.agent.options.mcp.transport === 'sse') {
            this.transport = new SSEClientTransport(
              new URL(this.agent.options.mcp.url)
            );
            log('Connecting using SSE transport');
          } else if (this.agent.options.mcp.transport === 'stdio') {
            this.transport = new StdioClientTransport({
                command: this.agent.options.mcp.command,
                args: this.agent.options.mcp.args,
            });
            log('Connecting using stdio transport');
          }

          // log('Connecting to MCP server...')
          this.slog('info', 'Connecting to MCP server...')
          await this.mcpClient.connect(this.transport);
          // log('Connected')
          this.slog('info', 'Connected to MCP server')
          break
        } catch (err) {
          error('Error connecting to MCP server:', err)
          this.slog('error', 'Error connecting to MCP server', {
            error: err.toString()
          })
          log('Attempt to reconnect in', this.sleepSec, 'seconds...')
          await sleep(this.sleepSec * 1000)
          this.sleepSec = Math.min(this.sleepSec * 2, 300)
          continue
        }
      }
      this.slog('debug', 'Agent started')
    } catch (err) {
      error('Error starting MCP client:', err)
      this.slog('error', 'Error starting MCP client', {
        error: err.toString()
      })
    }
  }

  async stop () {
    super.stop()
    verbose('McpV1 stopped')
    this.slog('debug', 'Agent stopped')
  }

  async chat({ prompt, replyFunc=()=>{}, from } = {}) {
    try {
      verbose(`prompt: ${prompt}`);
      const { mcp } = this.agent.options;
      verbose('mcp:', mcp)

      let cmd = {}
      try {
        cmd = JSON.parse(prompt.trim());
      } catch (err) {
        throw new Error(`Error parsing mcp command: ${err}`)
      }
      verbose('cmd:', cmd)

      if (cmd.action === 'listPrompts') {
        const prompts = await this.mcpClient.listPrompts();
        verbose('prompts:', prompts)
        return stringify(prompts)
      }

      if (cmd.action === 'getPrompt') {
        const prompt1 = await this.mcpClient.getPrompt(cmd.data);
        verbose('prompt1:', prompt1)
        return stringify(prompt1)
      }

      if (cmd.action === 'listResources') {
        const resources = await this.mcpClient.listResources();
        verbose('resources:', resources)
        return stringify(resources)
      }

      if (cmd.action === 'readResource') {
        const resource = await this.mcpClient.readResource(cmd.data);
        verbose('resource:', resource)
        return stringify(resource)
      }

      if (cmd.action === 'listTools') {
        const tools = await this.mcpClient.listTools();
        verbose('tools:', tools)
        return stringify(tools)
      }

      if (cmd.action === 'callTool') {
        verbose('callTool with data:', cmd.data)
        const result = await this.mcpClient.callTool(cmd.data);
        verbose('result:', result)
        return stringify(result)
      }

      return ' ';
    } catch (err) {
      error('Error chatting McpV1:', err)
      this.slog('error', 'Error chatting', {
        error: err.toString()
      })
      return err.toString()
    }
  }
}

