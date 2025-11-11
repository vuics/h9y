import path from 'path'
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';

import { log, warn, error, Verbose } from '../services.js';
import Connector from './connector.js';
import XmppAgent from '../swarm/xmpp-agent.js';
import conf from '../conf.js';
import webServer from './web-server.js'

const verbose = Verbose('sd:bridge/mcp'); verbose('');

// Example mcp tool call:
//   npm run mcp:inspector
// or:
//   DANGEROUSLY_OMIT_AUTH=true  npx @modelcontextprotocol/inspector --server-url http://localhost:6370/mcp/679b3c9a6e26f022ca69515b/mcp-server


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

    this.path = null

    // Unique tool name registered on the MCP server for this bridge
    this.mcpServer = null
    this.toolName = `send`;
    this.registeredTool = false;
  }

  async start() {
    super.start();
    verbose('Mcp start');

    try {
      await webServer.start();

      this.mcpServer = new McpServer({
        name: this.bridge.options.name,
        version: '1.0.0',
      });

      this.path = path.join(
        '/mcp/' + this.bridge.userId._id.toString(),
        this.bridge.options.mcp.endpoint
      );
      verbose('path:', this.path);

      /* -------------------- MCP Server → XMPP (Outgoing) -------------------- */
      webServer.addRoute({
        path: this.path,
        method: 'post',
        handler: async (req, res) => {
          try {
            verbose(
              'handler path:', this.path,
              ', method: post',
              ', query:', req.query,
              ', body:', req.body
            );

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
              await this.mcpServer.connect(transport);
              await transport.handleRequest(req, res, req.body);
            } catch (err) {
              error('MCP transport handling error:', err);
              try {
                res.status(500).json({ result: 'error', error: err.toString() });
              } catch (e) {}
            }
          } catch (err) {
            error('Error handling mcp:', this.bridge.options.name, ', error:', err);
            res.status(500).send({ result: 'error', error: err.toString() });
          }
        },
      });

      // start xmpp agent
      await this.xmppAgent.start();

      /* -------------------- XMPP → Webhook (Incoming) -------------------- */
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
          this.resolveXmppResponse({ requestId, response: prompt });
        } catch (err) {
          error('Error handling XMPP message in MCP bridge:', err);
        }
        return '';
      };

      // Register a tool on the MCP server which clients can call to send messages
      // Tool name is unique per bridge instance
      const inputSchema = {
        payload: z.any(),
        requestId: z.string().optional(),
      };
      const outputSchema = { result: z.any().optional() };

      // Register the tool; handler will forward the message to XMPP and await reply
      // Avoid double-registering
      if (!this.registeredTool) {
        this.mcpServer.registerTool(
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
              const requestId = input.requestId || randomUUID();

              // attach requestId so reply can be correlated
              if (typeof input.payload === 'object' && input.payload !== null) {
                input.payload.requestId = requestId;
              }

              const prompt = (typeof input.payload === 'string')
                ? input.payload
                : JSON.stringify(input.payload);

              verbose('Sending to XMPP; requestId:', requestId, ', prompt:', prompt);

              if (this.bridge.options.mcp.enablePersonal) {
                await this.xmppAgent.xmppClient.sendPersonalMessage({
                  recipient: this.bridge.options.mcp.recipient,
                  prompt,
                });
              }
              if (this.bridge.options.mcp.enableRoom) {
                await this.xmppAgent.xmppClient.sendRoomMessage({
                  room: this.bridge.options.mcp.joinRoom,
                  recipient: this.bridge.options.mcp?.recipientNickname,
                  prompt,
                  mucHost: conf.xmpp.mucHost,
                });
              }

              // Wait for response from XMPP correlated by requestId
              const xmppResponse = await this.waitForXmppResponse({
                requestId,
                timeoutSec: this.bridge.options.mcp?.timeoutSec,
              });

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
    webServer.removeRoute({
      path: this.path,
      method: 'post',
    });
    webServer.stop();

    // Attempt to stop XMPP agent
    try {
      await this.xmppAgent.stop();
    } catch (err) {
      warn('Failed to stop xmppAgent gracefully:', err);
    }

    this.registeredTool = false;
    verbose('Mcp stopped');
  }
}
