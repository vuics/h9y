import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import stringify from 'json-stringify-pretty-compact';

import { log, warn, error, Verbose } from '../services.js'
import XmppAgent from './xmpp-agent.js'
import conf from '../conf.js'
import { sleep } from '../utils/helper.js'

const verbose = Verbose('sd:swarm/proxy-v1'); verbose('')

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


          log('Connecting to MCP server...')
          await this.mcpClient.connect(this.transport);
          log('Connected')
          break
        } catch (err) {
          error('Error connecting to MCP server:', err)
          log('Attempt to reconnect in', this.sleepSec, 'seconds...')
          await sleep(this.sleepSec * 1000)
          this.sleepSec = Math.min(this.sleepSec * 2, 300)
          continue
        }
      }
    } catch (err) {
      error('Error starting MCP client:', err)
    }
  }

  async stop () {
    super.stop()
    verbose('McpV1 stopped')
  }

  async chat({ prompt, replyFunc=()=>{}, from } = {}) {
    try {
      verbose(`prompt: ${prompt}`);
      const { mcp } = this.agent.options;
      verbose('mcp:', mcp)

      if (prompt === 'LIST_PROMPTS') {
        // List prompts
        const prompts = await this.mcpClient.listPrompts();
        verbose('prompts:', prompts)
        return stringify(prompts)
      }


      // Get a prompt
      // const prompt = await this.mcpClient.getPrompt({
      //     name: 'example-prompt',
      //     arguments: {
      //         arg1: 'value'
      //     }
      // });

      if (prompt === 'LIST_RESOURCES') {
        // List resources
        const resources = await this.mcpClient.listResources();
        verbose('resources:', resources)
        return stringify(resources)
      }

      // Read a resource
      // const resource = await this.mcpClient.readResource({
      //     uri: 'file:///example.txt'
      // });

      if (prompt === 'LIST_TOOLS') {
        // List resources
        const tools = await this.mcpClient.listTools();
        verbose('tools:', tools)
        return stringify(tools)
      }

      if (prompt === 'CALL_TOOL') {
        // Call a tool
        const result = await this.mcpClient.callTool({
          name: 'send',
          arguments: {
            payload: { 'key': 'value' },
          }
        });
        return stringify(result)
      }

      return ' ';
    } catch (err) {
      error('Error chatting McpV1:', err)
      return err.toString()
    }
  }
}

