import axios from 'axios'
// import path from 'path'
// import { randomUUID } from 'crypto'

import { log, warn, error, Verbose } from '../services.js'
import Connector from './connector.js'
import XmppAgent from '../swarm/xmpp-agent.js'
import conf from '../conf.js'

const verbose = Verbose('sd:bridge/curl'); verbose('')


export default class Curl extends Connector {
  constructor(args) {
    super(args);
    verbose('Curl constructed');

    this.client = axios.create({
      timeout: this.bridge.options.curl.timeoutSec * 1000,
      headers: { 'User-Agent': 'HyperAgency/1.0', ...this.bridge.options.curl.headers }
    })

    this.xmppAgent = new XmppAgent({
      agent: {
        options: {
          name: this.bridge.options.name,
          joinRooms: [this.bridge.options.curl.joinRoom],
        },
        userId: this.bridge.userId,
      },
      handleChat: this.bridge.options.curl.enablePersonal,
      handleRooms: this.bridge.options.curl.enableRoom,
    });
  }

  async request({ method, url, data = null, headers = {} } = {}) {
    const config = {
      method,
      url,
      headers: { ...this.client.defaults.headers, ...headers }
    }
    if (data && ['GET', 'HEAD', 'OPTIONS'].includes(method) === false) {
      config.data = data
    }

    try {
      const response = await this.client.request(config)
      return {
        ok: true,
        status: response.status,
        headers: response.headers,
        data: response.data
      }
    } catch (error) {
      return {
        ok: false,
        status: error.response?.status || 0,
        error: error.message,
        data: error.response?.data || null
      }
    }
  }

  async start() {
    super.start();
    verbose('Curl started');
    try {
      await this.xmppAgent.start();
      this.xmppAgent.chat = async ({ prompt } = {}) => {
        try {
          verbose('XMPP chat received:', prompt);
          let msg
          try {
            msg = JSON.parse(prompt);
          } catch (err) {
            msg = null
          }

          const requestData = {
            method: msg?.method || this.bridge.options.curl.method,
            url: msg?.url || this.bridge.options.curl.url,
            headers: msg?.headers || JSON.parse(this.bridge.options.curl.headers),
            data: msg?.data || prompt,
          }
          verbose('requestData:', requestData)
          const response = await this.request(requestData)

          // if (this.bridge.options.curl.enablePersonal) {
          //   await this.xmppAgent.xmppClient.sendPersonalMessage({
          //     recipient: this.bridge.options.curl.recipient,
          //     prompt: JSON.stringify(response),
          //   });
          // }
          // if (this.bridge.options.curl.enableRoom) {
          //   await this.xmppAgent.xmppClient.sendRoomMessage({
          //     room: this.bridge.options.curl.joinRoom,
          //     recipient: this.bridge.options.curl.recipientNickname,
          //     prompt: JSON.stringify(response),
          //     mucHost: conf.xmpp.mucHost,
          //   });
          // }

          return JSON.stringify(response)
        } catch (err) {
          error('Failed to handle XMPP message:', prompt, err);
        }
      };
    } catch (err) {
      error('Error starting Curl:', err);
    }
  }

  async stop() {
    super.stop();
    this.xmppAgent.stop();
    verbose('Curl stopped');
  }
}
