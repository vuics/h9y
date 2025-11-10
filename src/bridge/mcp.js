// mcp.js
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';

import { log, warn, error, Verbose } from '../services.js';
import Connector from './connector.js';
import XmppAgent from '../swarm/xmpp-agent.js';
import conf from '../conf.js';

const verbose = Verbose('sd:bridge/mcp'); verbose('');

// -------------------------------
// Global MCP server + Express app
// -------------------------------
const server = new McpServer({
  name: 'selfdev-mcp-server',
  version: '1.0.0',
});

const app = express();
app.use(express.json({ limit: '2mb' }));

// Create the HTTP /mcp endpoint (single entrypoint for MCP inspector/tools)
app.post('/mcp', async (req, res) => {
  // Create a new transport for each incoming request (prevents collisions)
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  res.on('close', () => {
    try {
      transport.close();
    } catch (err) {
      // ignore
    }
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    error('MCP transport handling error:', err);
    try {
      res.status(500).json({ result: 'error', error: err.toString() });
    } catch (e) {}
  }
});

app.listen(conf.mcp.port, () => {
  log('MCP HTTP server listening on port', conf.mcp.port);
  verbose(`  http://localhost:${conf.mcp.port}/mcp`);
}).on('error', (err) => {
  error('MCP Server error:', err);
  // do not exit the process here
});

// -------------------------------
// Exported Mcp Connector class
// -------------------------------
export default class Mcp extends Connector {
  constructor(args) {
    super(args);
    verbose('Mcp constructed');

    // Initialize XMPP agent for this bridge instance
    this.xmppAgent = new XmppAgent({
      agent: {
        options: {
          name: this.bridge.options.name,
          joinRooms: this.bridge.options.mcp?.joinRooms || [],
        },
        userId: this.bridge.userId,
      },
      handleChat: this.bridge.options.mcp?.enablePersonal ?? true,
      handleRooms: this.bridge.options.mcp?.enableRoom ?? false,
    });

    // Map<requestId, { resolve, reject, timeout }>
    this.pendingResponses = null;

    // Unique tool name registered on the MCP server for this bridge
    this.toolName = `mcp_send_${this.bridge.userId._id.toString()}`;
    this.registeredTool = false;
  }

  waitForXmppResponse(requestId) {
    return new Promise((resolve, reject) => {
      const timeoutMs = (this.bridge.options.mcp?.timeoutSec || 300) * 1000;
      const timeout = setTimeout(() => {
        this.pendingResponses.delete(requestId);
        reject(new Error('Timeout waiting for XMPP response'));
      }, timeoutMs);

      this.pendingResponses.set(requestId, { resolve, reject, timeout });
    });
  }

  resolveXmppResponse(requestId, response) {
    const entry = this.pendingResponses.get(requestId);
    if (!entry) return false;
    clearTimeout(entry.timeout);
    entry.resolve(response);
    this.pendingResponses.delete(requestId);
    return true;
  }

  async start() {
    super.start();
    verbose('Mcp start');

    try {
      this.pendingResponses = new Map();

      // start xmpp agent
      await this.xmppAgent.start();

      // Set up incoming XMPP handler to resolve pending MCP requests
      this.xmppAgent.chat = async ({ prompt } = {}) => {
        verbose('XMPP -> MCP received prompt:', prompt);

        try {
          let msg = null;
          try {
            msg = JSON.parse(prompt);
          } catch (err) {
            msg = null;
          }

          // Determine requestId either from parsed JSON or null
          let requestId = null;
          if (msg && msg.requestId) {
            requestId = msg.requestId;
          }

          verbose('parsed msg:', msg, ', requestId:', requestId);

          if (requestId && this.pendingResponses.has(requestId)) {
            this.resolveXmppResponse(requestId, prompt);
          } else {
            // fallback: match last pending request
            warn('Unmatched XMPP response; attempting fallback match');
            const lastEntry = Array.from(this.pendingResponses.entries()).pop();
            if (lastEntry) {
              const [lastRequestId] = lastEntry;
              this.resolveXmppResponse(lastRequestId, prompt);
            } else {
              warn('No pending MCP requests to match XMPP response.');
            }
          }
        } catch (err) {
          error('Error handling XMPP message in MCP bridge:', err);
        }
        return '';
      };

      // Register a tool on the MCP server which clients can call to send messages
      // Tool name is unique per bridge instance
      const inputSchema = {
        text: z.string().optional(),
        payload: z.any().optional(),
        requestId: z.string().optional(),
        recipient: z.string().optional(),
        room: z.string().optional(),
      };
      const outputSchema = { result: z.any().optional() };

      // Register the tool; handler will forward the message to XMPP and await reply
      // Avoid double-registering
      if (!this.registeredTool) {
        server.registerTool(
          this.toolName,
          {
            title: `MCP Send Tool (${this.bridge.options.name || this.toolName})`,
            description: 'Send a message to the XMPP agent and wait for a reply',
            inputSchema,
            outputSchema,
          },
          async (input) => {
            // input contains fields from the client
            try {
              verbose('MCP tool invoked, input:', input);
              const providedRequestId = input.requestId;
              const requestId = providedRequestId || randomUUID();

              // Build a message to send; include requestId for correlation
              const messagePayload = (typeof input.payload !== 'undefined')
                ? input.payload
                : (input.text !== undefined ? { text: input.text } : {});

              // attach requestId so reply can be correlated
              if (typeof messagePayload === 'object' && messagePayload !== null) {
                messagePayload.requestId = requestId;
              }

              const serialized = (typeof messagePayload === 'string')
                ? messagePayload
                : JSON.stringify(messagePayload);

              verbose('Sending to XMPP; requestId:', requestId, ', payload:', serialized);

              // Send via personal or room depending on bridge config or input
              const usePersonal = this.bridge.options.mcp?.enablePersonal ?? true;
              const useRoom = this.bridge.options.mcp?.enableRoom ?? false;

              if (input.recipient && usePersonal) {
                await this.xmppAgent.xmppClient.sendPersonalMessage({
                  recipient: input.recipient,
                  prompt: serialized,
                });
              } else if (input.room && useRoom) {
                await this.xmppAgent.xmppClient.sendRoomMessage({
                  room: input.room,
                  recipient: this.bridge.options.mcp?.recipientNickname,
                  prompt: serialized,
                  mucHost: conf.xmpp.mucHost,
                });
              } else {
                // fallback to default configured behavior
                if (usePersonal && this.bridge.options.mcp?.recipient) {
                  await this.xmppAgent.xmppClient.sendPersonalMessage({
                    recipient: this.bridge.options.mcp.recipient,
                    prompt: serialized,
                  });
                } else if (useRoom && (this.bridge.options.mcp?.joinRooms || []).length) {
                  const room = (this.bridge.options.mcp.joinRooms || [])[0];
                  await this.xmppAgent.xmppClient.sendRoomMessage({
                    room,
                    recipient: this.bridge.options.mcp?.recipientNickname,
                    prompt: serialized,
                    mucHost: conf.xmpp.mucHost,
                  });
                } else {
                  // If no destination configured, throw
                  throw new Error('No XMPP destination configured (recipient/room).');
                }
              }

              // Wait for response from XMPP correlated by requestId
              const xmppResponse = await this.waitForXmppResponse(requestId);

              // Return structured output expected by MCP clients
              return {
                content: [{ type: 'text', text: xmppResponse }],
                structuredContent: { result: xmppResponse },
              };
            } catch (err) {
              error('Error inside MCP tool handler:', err);
              // Return error in structured content
              return {
                content: [{ type: 'text', text: JSON.stringify({ error: err.toString() }) }],
                structuredContent: { error: err.toString() },
              };
            }
          }
        );
        this.registeredTool = true;
        verbose('Registered MCP tool:', this.toolName);
      }

    } catch (err) {
      error('Error starting Mcp bridge:', err);
      // ensure xmppAgent stop if started partially
      try {
        await this.xmppAgent.stop();
      } catch (e) {}
    }
  }

  async stop() {
    super.stop();
    verbose('Stopping Mcp bridge');

    // Attempt to stop XMPP agent
    try {
      await this.xmppAgent.stop();
    } catch (err) {
      warn('Failed to stop xmppAgent gracefully:', err);
    }

    // Clear pending responses
    if (this.pendingResponses) {
      for (const [, entry] of this.pendingResponses.entries()) {
        try {
          clearTimeout(entry.timeout);
          entry.reject && entry.reject(new Error('Bridge stopped'));
        } catch (e) {}
      }
      this.pendingResponses = null;
    }

    // Note: unregisterTool may or may not exist on McpServer; avoid calling unknown API.
    // If McpServer supports unregistering, you can add it here:
    // try { server.unregisterTool(this.toolName); } catch (e) { /* ignore */ }

    this.registeredTool = false;
    verbose('Mcp stopped');
  }
}
