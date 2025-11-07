import express from 'express';
import morgan from 'morgan'
import compression from 'compression'
import http from 'http'
import path from 'path'
import { randomUUID } from 'crypto'

import { log, warn, error, Verbose } from '../services.js'
import Connector from './connector.js'
import XmppAgent from '../swarm/xmpp-agent.js'
import conf from '../conf.js'

const verbose = Verbose('sd:bridge/webhook'); verbose('')

// Express server setup
let app = null;
let server = null;

function runExpressApp() {
  if (!app) {
    app = express();
    app.use(compression());
    app.use(express.json({ limit: '1mb' }));
    app.use(express.urlencoded({ extended: true, limit: '100mb' }));
    app.use(morgan('tiny'));
    app.get('/', (req, res) => res.send('Selfdev Webhook Server'));

    server = http.createServer(app);
    server.listen(conf.webhook.port, () => {
      log('Bridge Webhook server is listening on port', conf.webhook.port);
      verbose(`  http://localhost:${conf.webhook.port}`);
    });
  }
  return app;
}

function addRoute({ path, method = 'post', handler }) {
  app[method](path, handler);
}

function removeRoute({ path, method = 'post' }) {
  app._router.stack = app._router.stack.filter(layer => {
    if (!layer.route) return true;
    if (layer.route.path !== path) return true;
    if (!layer.route.methods[method]) return true;
    return false;
  });
}


export default class Webhook extends Connector {
  constructor(args) {
    super(args);
    verbose('Webhook constructed');

    this.app = null;
    this.xmppAgent = new XmppAgent({
      agent: {
        options: {
          name: this.bridge.options.name,
          joinRooms: [this.bridge.options.webhook.joinRoom],
        },
        userId: this.bridge.userId,
      },
      handleChat: this.bridge.options.webhook.enablePersonal,
      handleRooms: this.bridge.options.webhook.enableRoom,
    });

    this.pendingResponses = null
  }

  waitForXmppResponse(requestId) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingResponses.delete(requestId);
        reject(new Error('Timeout waiting for XMPP response'));
      }, (this.bridge.options.webhook.responseTimeoutSec || 300) * 1000);

      this.pendingResponses.set(requestId, { resolve, reject, timeout });
    });
  }

  resolveXmppResponse(requestId, response) {
    const entry = this.pendingResponses.get(requestId);
    if (!entry) return;
    clearTimeout(entry.timeout);
    entry.resolve(response);
    this.pendingResponses.delete(requestId);
  }

  async start() {
    super.start();
    verbose('Webhook started');

    try {
      runExpressApp();
      this.pendingResponses = new Map();

      this.path = path.join(
        '/' + this.bridge.userId._id.toString(),
        this.bridge.options.webhook.endpoint
      );
      verbose('path:', this.path);

      /* -------------------- Webhook → XMPP (Outgoing) -------------------- */
      addRoute({
        path: this.path,
        method: this.bridge.options.webhook.method,
        handler: async (req, res) => {
          try {
            verbose(
              'handler path:', this.path,
              ', method:', this.bridge.options.webhook.method,
              ', query:', req.query,
              ', body:', req.body
            );

            const requestId = randomUUID();
            let payload = {
              ...(this.bridge.options.webhook.method === 'get' ? req.query : req.body),
            };
            if (this.bridge.options.webhook.setRequestId) {
              payload[this.bridge.options.webhook.requestIdKey] = requestId
            }
            verbose('payload:', payload)
            verbose('to xmpp, requestId:', requestId)
            verbose('setRequestId:', this.bridge.options.webhook.setRequestId)
            verbose('requestIdKey:', this.bridge.options.webhook.requestIdKey)

            // Send to XMPP
            if (this.bridge.options.webhook.enablePersonal) {
              await this.xmppAgent.xmppClient.sendPersonalMessage({
                recipient: this.bridge.options.webhook.recipient,
                prompt: JSON.stringify(payload),
              });
            }
            if (this.bridge.options.webhook.enableRoom) {
              await this.xmppAgent.xmppClient.sendRoomMessage({
                room: this.bridge.options.webhook.joinRoom,
                recipient: this.bridge.options.webhook.recipientNickname,
                prompt: JSON.stringify(payload),
                mucHost: conf.xmpp.mucHost,
              });
            }

            // Wait for correlated XMPP response
            const response = await this.waitForXmppResponse(requestId);
            res.json(response);
          } catch (err) {
            error('Error handling webhook:', this.bridge.options.name, ', error:', err);
            res.status(500).send({ result: 'error', error: err.toString() });
          }
        },
      });

      await this.xmppAgent.start();

      /* -------------------- XMPP → Webhook (Incoming) -------------------- */
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
          if (msg && this.bridge.options.webhook.setRequestId) {
            requestId = msg[this.bridge.options.webhook.requestIdKey]
          }
          verbose('msg:', msg)
          verbose('from xmpp, requestId:', requestId)
          verbose('setRequestId:', this.bridge.options.webhook.setRequestId)
          verbose('requestIdKey:', this.bridge.options.webhook.requestIdKey)

          if (msg && requestId && this.pendingResponses.has(requestId)) {
            this.resolveXmppResponse(msg.requestId, prompt);
          } else {
            // Fallback: if XMPP reply doesn’t contain requestId
            warn('Unmatched XMPP response:', msg, 'Attempting fallback by sender/room');
            // Example fallback: match last pending request by sender
            const lastEntry = Array.from(this.pendingResponses.entries()).pop();
            if (lastEntry) {
              const [lastRequestId] = lastEntry;
              this.resolveXmppResponse(lastRequestId, prompt);
            }
          }
        } catch (err) {
          error('Failed to parse XMPP message:', prompt, err);
        }
        return '';
      };
    } catch (err) {
      error('Error starting Webhook:', err);
    }
  }

  async stop() {
    super.stop();
    removeRoute({
      path: this.path,
      method: this.bridge.options.webhook.method,
    });
    this.xmppAgent.stop();
    this.pendingResponses = null
    verbose('Webhook stopped');
  }
}
