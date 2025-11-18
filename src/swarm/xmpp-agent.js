import axios from 'axios';

import { log, warn, error, Verbose } from '../services.js'
import Map from '../models/map.js'
import { XmppClient } from '../maptor.js'
import conf from '../conf.js'
import { sleep } from '../utils/helper.js'
import opensearch, { sendLog } from '../opensearch.js'

const verbose = Verbose('sd:swarm/xmpp-agent'); verbose('')


export default class XmppAgent {
  constructor ({ agent, handleChat=true, handleRooms=true } = {}) {
    this.agent = agent
    this.xmppClient = null
    this.handleChat = handleChat
    this.handleRooms = handleRooms

    this.credentials = {
      user: agent.options.name,
      password: conf.xmpp.password,
      host: `${agent.userId.xmpp.user}.${conf.xmpp.host}`,
    }
    this.credentials.jid = `${this.credentials.user}@${this.credentials.host}`

    this.reconnectAttempts = 0;
    this.currentDelay = 1;
  }

  async slog(level, message, meta = {}) {
    sendLog(level, message, {
      ...meta,
      agentId: this.agent._id.toString(),
      userId: this.agent.userId._id.toString(),
      archetype: this.agent.archetype,
      name: this.agent.options.name,
    })
  }

  async start () {
    this.slog('info', 'Starting agent')

    this.xmppClient = new XmppClient()
    this.xmppClient.emitter.on('online', ({ jid }) => {
      this.connected({ jid })
    })
    this.xmppClient.emitter.on('error', async (err) => {
      if (err.condition.includes('not-authorized') ||
          err.condition.includes('host-unknown')) {
        verbose('Received not-authorized error. Registering an agent...')
        await this.registerAgent()
        await this.connect()
      } else {
        error(`XMPP error: ${err}`);
      }
    })
    if (this.handleChat) {
      this.xmppClient.emitter.on('chatMessage', async ({ from, body }) => {
        verbose('Received a chat message from:', from, ', body:', body)
        const replyFunc = async ({ content }) => {
          verbose('replyFunc content:', content)
          return this.xmppClient.sendPersonalMessage({ recipient: from, prompt: content })
        }
        const content = await this.chat({ prompt: body, replyFunc, from })
        verbose('chat returned content:', content)
        await replyFunc({ content })
      });
    }
    if (this.handleRooms) {
      this.xmppClient.emitter.on('groupMessage', async ({ from, body, mentioned }) => {
        verbose('Received a group message from:', from, ', body:', body)

        if (!mentioned) { return }

        const replyFunc = async ({ content }) => {
          if (!content) { return }
          verbose('room replyFunc content:', content)
          const [ roomJid ] = from.split('/')
          const [ , mucHost ] = roomJid.split('@')
          return this.xmppClient.sendRoomMessage({
            recipient: from,
            prompt: content,
            room: roomJid,
            mucHost,
          })
        }
        const content = await this.chat({ prompt: body, replyFunc, from })
        verbose('chat returned content for room:', content)
        await replyFunc({ content })
      });
    }
    await this.connect()
  }

  async connect () {
    try {
      if (this.reconnectAttempts === 0) {
        log('Connection attempt.');
      } else {
        log(`Reconnection attempt ${this.reconnectAttempts}. Waiting ${this.currentDelay} seconds before trying again.`);
        await sleep(this.currentDelay * 1000)
        verbose('sleep done')
        this.currentDelay = Math.min(this.currentDelay * 2, conf.xmpp.reconnectMaxDelay);
        verbose('assign currentDelay:', this.currentDelay)
      }
      this.reconnectAttempts += 1;

      // if (XMPP_CONNECT_HOST) {
      //   super.connect({ host: XMPP_CONNECT_HOST, port: XMPP_CONNECT_PORT });
      // } else {
      //   super.connect();
      // }

      await this.xmppClient.connect({
        credentials: this.credentials,
        service: conf.xmpp.websocketUrl,
        domain: this.credentials.host,
        mucHost: this.handleRooms ? conf.xmpp.mucHost : undefined,
        joinRooms: this.handleRooms ? this.agent.options.joinRooms : undefined,
      })
    } catch (err) {
      error('Error connecting:', err)
    }
  }

  connected ({ jid }) {
    log(`${jid} agent is connected.`);
    this.slog('info', `${jid} agent is connected.`)
    // Reset reconnection parameters on successful connection
    this.reconnectAttempts = 0;
    this.currentDelay = 1;
  }

  async stop () {
    this.slog('info', 'Stopping agent')
    this.xmppClient?.disconnect()
  }

  async registerAgent () {
    log('Register a new XMPP user with credentials:', this.credentials);
    this.slog('info', 'Register a new XMPP agentic user')
    try {
      const response = await axios.get(`${conf.xmpp.commanderUrl}/register-agent`, {
        params: this.credentials,
        headers: { 'Content-Type': 'application/json' },
      });

      verbose(`XMPP Registration Status Code: ${response.status}`);
      verbose(`XMPP Registration Data: ${response.data}`);

      if (response.status >= 400) {
        return false;
      }
      return true;
    } catch (err) {
      error('XMPP registration error:', err.message);
      return false;
    }
  }

  async chat({ prompt, replyFunc=()=>{} } = {}) {
    this.slog('info', 'Agent received prompt')
    // replyFunc({ content: prompt })
    return prompt
  }
}

