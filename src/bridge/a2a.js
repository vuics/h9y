import path from 'path'
import { randomUUID } from 'crypto'
import { inspect } from 'util'
import express, { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { DefaultRequestHandler, InMemoryTaskStore, } from '@a2a-js/sdk/server';
import { A2AExpressApp } from '@a2a-js/sdk/server/express';

import { log, warn, error, Verbose } from '../services.js'
import Connector from './connector.js'
import XmppAgent from '../swarm/xmpp-agent.js'
import conf from '../conf.js'
import webServer from './web-server.js'

const verbose = Verbose('sd:bridge/a2a'); verbose('')


// Example a2a url:
// http://localhost:6370/a2a/679b3c9a6e26f022ca69515b/server

class AgentExecutor {
  constructor(a2a) {
    this.a2a = a2a;  // store reference to A2a instance
  }

  async execute(requestContext, eventBus) {
    verbose('requestContext:', inspect(requestContext, { depth: null, colors: true }))

    try {
      this.a2a.slog('debug', 'Handling a2a request', {
        path: this.a2a.path,
        requestContext,
      })

      const text = null
      const requestId = requestContext?.userMessage?.messageId || randomUUID();
      const payload = {
        ...requestContext?.userMessage,
      };
      if (this.a2a.bridge.options.a2a.setRequestId) {
        payload[this.a2a.bridge.options.a2a.requestIdKey] = requestId
      } else {
        text = requestContext?.userMessage?.parts[0]?.text || ''
      }
      verbose('text:', text)
      verbose('requestId:', requestId)
      verbose('payload:', payload)

      // Send to XMPP
      if (this.a2a.bridge.options.enablePersonal) {
        await this.a2a.xmppAgent.xmppClient.sendPersonalMessage({
          recipient: this.a2a.bridge.options.recipient,
          prompt: text || JSON.stringify(payload),
        });
      }
      if (this.a2a.bridge.options.enableRoom && this.a2a.bridge.options.joinRooms?.length > 0) {
        await this.a2a.xmppAgent.xmppClient.sendRoomMessage({
          room: this.a2a.bridge.options.joinRooms[0],
          recipient: this.a2a.bridge.options.recipientNickname,
          prompt: text || JSON.stringify(payload),
          mucHost: conf.xmpp.mucHost,
        });
      }

      // Wait for correlated XMPP response
      const response = await this.a2a.waitForXmppResponse({
        requestId,
        timeoutSec: this.a2a.bridge.options.a2a?.timeoutSec,
      });

      const message = {
        kind: 'message',
        messageId: uuidv4(),
        role: 'agent',
        parts: [{ kind: 'text', text: response }],
        contextId: requestContext.contextId,
      };

      eventBus.publish(message);
      eventBus.finished();
    } catch (err) {
      error('Error handling a2a:', this.a2a.bridge.options.name, ', error:', err);
      this.a2a.slog('error', 'Error handling a2a', {
        error: err.toString()
      })
    }
  }

  cancelTask = async () => {};
}

export default class A2a extends Connector {
  constructor(args) {
    super(args);
    verbose('A2a constructed');

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

    this.path = path.join(
      '/a2a/' + this.bridge.userId._id.toString(),
      this.bridge.options.a2a.endpoint
    );
    verbose('path:', this.path);

    this.agentCard = {
      name: this.bridge.options.name,
      description: this.bridge.options.description,
      protocolVersion: '0.3.0',
      version: '0.1.0',
      url: `${conf.webServer.origin}${this.path}`,
      skills: [
        { id: 'chat', name: 'Chat', description: 'Say hello', tags: ['chat'] }
      ],
      capabilities: {
        pushNotifications: false,
        tasks: false,
        rpc: false
      }
    };

    this.executor = new AgentExecutor(this);
    this.requestHandler = new DefaultRequestHandler(
      this.agentCard,
      new InMemoryTaskStore(),
      this.executor
    );
    this.appBuilder = new A2AExpressApp(this.requestHandler);
  }

  async start() {
    super.start();
    verbose('A2a started');

    try {
      await webServer.start();

      this.slog('info', `Adding route: ${this.bridge.options.a2a.method} ${this.path}`, {
        path: this.path,
        method: this.bridge.options.a2a.method,
      })

      /* -------------------- A2a → XMPP (Outgoing) -------------------- */
      this.router = Router()
      this.routes = this.appBuilder.setupRoutes(this.router);
      webServer.app.use(this.path, this.routes)

      await this.xmppAgent.start();

      /* -------------------- XMPP → A2a (Incoming) -------------------- */
      this.xmppAgent.chat = async ({ prompt } = {}) => {
        verbose('XMPP chat received:', prompt);

        try {
          let msg
          try {
            msg = JSON.parse(prompt);
          } catch (err) {
            msg = null
          }

          let requestId = null
          if (msg && this.bridge.options.a2a.setRequestId) {
            requestId = msg[this.bridge.options.a2a.requestIdKey]
          }
          verbose('msg:', msg)
          verbose('from xmpp, requestId:', requestId)
          verbose('setRequestId:', this.bridge.options.a2a.setRequestId)
          verbose('requestIdKey:', this.bridge.options.a2a.requestIdKey)

          this.resolveXmppResponse({ requestId: msg?.requestId, response: prompt });
        } catch (err) {
          error('Failed to handle XMPP message:', prompt, err);
          this.slog('error', 'Failed to handle XMPP message', {
            prompt,
            error: err.toString()
          })
        }
        return '';
      };
    } catch (err) {
      error('Error starting A2a:', err);
      this.slog('error', 'Error starting A2a', {
        error: err.toString()
      })
      return
    }
    this.slog('debug', 'Bridge started')
  }

  async stop() {
    super.stop();
    webServer.removeRoute({
      path: this.path,
      method: null,
    });

    // NOTE: Keep the server running since it might be used by other bridges
    // webServer.stop();

    this.xmppAgent.stop();
    verbose('A2a stopped');
    this.slog('debug', 'Bridge stopped')
  }
}
