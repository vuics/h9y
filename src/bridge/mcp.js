import path from 'path'
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
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

// Map to store transports by session ID
const transports = {};

export default class Mcp extends Connector {
  constructor(args) {
    super(args);
    verbose('Mcp constructed');

    // Initialize XMPP agent for this bridge instance
    this.xmppAgent = new XmppAgent({
      agent: {
        _id: `bridge:${this.bridge._id.toString()}`,
        archetype: `bridge:${this.bridge.connector}`,
        options: {
          name: this.bridge.options.name,
          joinRooms: this.bridge.options.joinRooms,
        },
        userId: this.bridge.userId,
      },
      handleChat: this.bridge.options.enablePersonal,
      handleRooms: this.bridge.options.enableRoom,
    });

    this.path = null
  }

  async start() {
    super.start();
    verbose('Mcp start');

    try {
      await webServer.start();

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
              ', body:', req.body,
              ', headers:', req.headers,
            );

            const sessionId = req.headers['mcp-session-id']
            verbose('post sessionId:', sessionId)

            let transport = null

            if (sessionId && transports[sessionId]) {
              // Reuse existing transport
              transport = transports[sessionId];
            } else if (!sessionId && isInitializeRequest(req.body)) {
              // New initialization request
              transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: () => randomUUID(),
                onsessioninitialized: sessionId => {
                  // Store the transport by session ID
                  transports[sessionId] = transport;
                },
                // DNS rebinding protection is disabled by default for backwards compatibility. If you are running this server
                // locally, make sure to set:
                // enableDnsRebindingProtection: true,
                // allowedHosts: ['127.0.0.1'],

                enableDnsRebindingProtection: true,
                // allowedHosts: ['127.0.0.1', 'dev.local', 'selfdev-swarm.dev.local', 'selfdev-bridge.dev.local', 'selfdev-bridge.dev.local:6370'],
                // allowedOrigins: ['http://localhost:6274', 'https://selfdev-swarm.dev.local', 'https://dev.local', 'https://hyag.ru', 'https://hyag.org'],
              });

              // Clean up transport when closed
              transport.onclose = () => {
                if (transport.sessionId) {
                  delete transports[transport.sessionId];
                }
              };
              const mcpServer = new McpServer({
                name: this.bridge.options.name,
                version: '1.0.0',
              });

              // ... set up server resources, tools, and prompts ...
              // Register a tool on the MCP server which clients can call to send messages
              // Tool name is unique per bridge instance
              const inputSchema = {
                payload: z.any(),
                requestId: z.string().optional(),
              };
              const outputSchema = { result: z.any().optional() };
              // Register the tool; handler will forward the message to XMPP and await reply
              mcpServer.registerTool(
                'send',
                {
                  title: `MCP Send Tool`,
                  description: 'Send a message to the XMPP agent and wait for a reply',
                  inputSchema,
                  outputSchema,
                },
                async (input) => {
                  // input contains fields from the client
                  try {
                    verbose('MCP tool invoked, input:', input);
                    this.slog('debug', 'MCP tool invoked, input:', { input });
                    const requestId = input.requestId || randomUUID();

                    // attach requestId so reply can be correlated
                    if (typeof input.payload === 'object' && input.payload !== null) {
                      input.payload.requestId = requestId;
                    }

                    const prompt = (typeof input.payload === 'string')
                      ? input.payload
                      : JSON.stringify(input.payload);

                    verbose('Sending to XMPP; requestId:', requestId, ', prompt:', prompt);

                    if (this.bridge.options.enablePersonal) {
                      await this.xmppAgent.xmppClient.sendPersonalMessage({
                        recipient: this.bridge.options.recipient,
                        prompt,
                      });
                    }
                    if (this.bridge.options.enableRoom && this.bridge.options.joinRooms?.length > 0) {
                      await this.xmppAgent.xmppClient.sendRoomMessage({
                        room: this.bridge.options.joinRooms[0],
                        recipient: this.bridge.options.recipientNickname,
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
              verbose('Registered MCP tool: send');
              this.slog('info', 'Registered MCP tool: send');

              verbose('Connecting to the MCP server')
              this.slog('info', 'Connecting to the MCP server...')
              await mcpServer.connect(transport);
              this.slog('info', 'Connected to the MCP server')
            } else {
              // Invalid request
              res.status(400).json({
                jsonrpc: '2.0',
                error: {
                  code: -32000,
                  message: 'Bad Request: No valid session ID provided'
                },
                id: null
              });
              this.slog('error', 'Bad Request: No valid session ID provided', {
                error: err.toString()
              })
              return;
            }

            // Handle the request
            await transport.handleRequest(req, res, req.body);
          } catch (err) {
            error('Error handling mcp:', this.bridge.options.name, ', error:', err);
            res.status(500).send({ result: 'error', error: err.toString() });
            this.slog('error', 'Failed handling MCP', {
              error: err.toString()
            })
          }
        }
      });


      // Reusable handler for GET and DELETE requests
      const handleSessionRequest = async (req, res) => {
        const sessionId = req.headers['mcp-session-id']
        verbose('get/delete sessionId:', sessionId)
        if (!sessionId || !transports[sessionId]) {
          res.status(400).send('Invalid or missing session ID');
          this.slog('error', 'Invalid or missing session ID')
          return;
        }

        const transport = transports[sessionId];
        await transport.handleRequest(req, res);
      };

      // Handle GET requests for server-to-client notifications via SSE
      webServer.addRoute({
        path: this.path,
        method: 'get',
        handler: handleSessionRequest,
      })

      // Handle DELETE requests for session termination
      webServer.addRoute({
        path: this.path,
        method: 'delete',
        handler: handleSessionRequest,
      })


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

    } catch (err) {
      error('Error starting Mcp bridge:', err);
      // ensure xmppAgent stop if started partially
      try {
        await this.xmppAgent.stop();
      } catch (e) {}
    }
    this.slog('debug', 'Bridge started')
  }

  async stop() {
    super.stop();
    verbose('Stopping Mcp bridge');
    webServer.removeRoute({
      path: this.path,
      method: 'post',
    });
    webServer.removeRoute({
      path: this.path,
      method: 'get',
    });
    webServer.removeRoute({
      path: this.path,
      method: 'delete',
    });

    // NOTE: Keep the server running since it might be used by other bridges
    // webServer.stop();

    // Attempt to stop XMPP agent
    try {
      await this.xmppAgent.stop();
    } catch (err) {
      warn('Failed to stop xmppAgent gracefully:', err);
    }

    verbose('Mcp stopped');
    this.slog('debug', 'Bridge stopped')
  }
}
