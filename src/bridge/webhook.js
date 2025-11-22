import path from 'path'
import { randomUUID } from 'crypto'

import { log, warn, error, Verbose } from '../services.js'
import Connector from './connector.js'
import XmppAgent from '../swarm/xmpp-agent.js'
import conf from '../conf.js'
import webServer from './web-server.js'

const verbose = Verbose('sd:bridge/webhook'); verbose('')

// Example webhook call with curl:
//   curl -X POST http://localhost:6370/wh/679b3c9a6e26f022ca69515b/webhook/post \
//     -H "Content-Type: application/json" \
//     -d '{"key":"value", "key2": "value222" }'

export default class Webhook extends Connector {
  constructor(args) {
    super(args);
    verbose('Webhook constructed');

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
    verbose('Webhook started');

    try {
      await webServer.start();

      this.path = path.join(
        '/wh/' + this.bridge.userId._id.toString(),
        this.bridge.options.webhook.endpoint
      );
      verbose('path:', this.path);
      this.slog('info', `Adding route: ${this.bridge.options.webhook.method} ${this.path}`, {
        path: this.path,
        method: this.bridge.options.webhook.method,
      })

      /* -------------------- Webhook → XMPP (Outgoing) -------------------- */
      webServer.addRoute({
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
            this.slog('debug', 'Handling webhook', {
              path: this.path,
              method: this.bridge.options.webhook.method,
              query: req.query,
              body: req.body
            })

            const requestId = randomUUID();

            let text = null
            let payload = null
            const contentType = req.headers['content-type'];
            verbose('contentType:', contentType)
            verbose('req.body:', req.body)

            if (contentType?.includes('text/plain')) {
              text = req.body
            } else {
              if (!contentType?.includes('application/json')) {
                warn('Unknown contentType:', contentType)
              }
              payload = {
                ...(this.bridge.options.webhook.method === 'get' ? req.query : req.body),
              };
              if (this.bridge.options.webhook.setRequestId) {
                payload[this.bridge.options.webhook.requestIdKey] = requestId
              }
            }

            verbose('text:', text)
            verbose('payload:', payload)
            verbose('to xmpp, requestId:', requestId)
            verbose('setRequestId:', this.bridge.options.webhook.setRequestId)
            verbose('requestIdKey:', this.bridge.options.webhook.requestIdKey)

            // Send to XMPP
            if (this.bridge.options.enablePersonal) {
              await this.xmppAgent.xmppClient.sendPersonalMessage({
                recipient: this.bridge.options.recipient,
                prompt: text || JSON.stringify(payload),
              });
            }
            if (this.bridge.options.enableRoom && this.bridge.options.joinRooms?.length > 0) {
              await this.xmppAgent.xmppClient.sendRoomMessage({
                room: this.bridge.options.joinRooms[0],
                recipient: this.bridge.options.recipientNickname,
                prompt: text || JSON.stringify(payload),
                mucHost: conf.xmpp.mucHost,
              });
            }

            // Wait for correlated XMPP response
            const response = await this.waitForXmppResponse({
              requestId,
              timeoutSec: this.bridge.options.webhook?.timeoutSec,
            });
            res.json(response);
          } catch (err) {
            error('Error handling webhook:', this.bridge.options.name, ', error:', err);
            res.status(500).send({ result: 'error', error: err.toString() });
            this.slog('error', 'Error handling webhook', {
              error: err.toString()
            })
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

          this.resolveXmppResponse({ requestId: msg.requestId, response: prompt });
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
      error('Error starting Webhook:', err);
      this.slog('error', 'Error starting Webhook', {
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
      method: this.bridge.options.webhook.method,
    });

    // NOTE: Keep the server running since it might be used by other bridges
    // webServer.stop();

    this.xmppAgent.stop();
    verbose('Webhook stopped');
    this.slog('debug', 'Bridge stopped')
  }
}
