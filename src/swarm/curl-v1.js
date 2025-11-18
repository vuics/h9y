import axios from 'axios'
import stringify from 'json-stringify-pretty-compact';

import { log, warn, error, Verbose } from '../services.js'
import XmppAgent from '../swarm/xmpp-agent.js'
import conf from '../conf.js'

const verbose = Verbose('sd:swarm/curl-v1'); verbose('')


export default class Curl extends XmppAgent {
  constructor(args) {
    super(args);
    // const { agent } = args
    verbose('CurlV1 constructed');

    this.client = axios.create({
      timeout: this.agent.options.curl.timeoutSec * 1000,
      headers: { 'User-Agent': 'HyperAgency/1.0', ...this.agent.options.curl.headers }
    })
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
    verbose('CurlV1 started');
    this.slog('debug', 'Agent started')
  }

  async stop() {
    super.stop();
    verbose('CurlV1 stopped');
    this.slog('debug', 'Agent stopped')
  }

  async chat({ prompt, replyFunc=()=>{}, from } = {}) {
    try {
      verbose(`prompt: ${prompt}`);
      const { curl } = this.agent.options;
      verbose('curl:', curl)

      verbose('XMPP chat received:', prompt);
      let msg
      try {
        msg = JSON.parse(prompt);
      } catch (err) {
        msg = null
      }
      verbose('msg:', msg)

      const requestData = {
        method: msg?.method || this.agent.options.curl.method,
        url: msg?.url || this.agent.options.curl.url,
        headers: msg?.headers || JSON.parse(this.agent.options.curl.headers),
        data: msg?.data || prompt,
      }
      verbose('requestData:', requestData)
      const response = await this.request(requestData)

      return stringify(response)

      return ' ';
    } catch (err) {
      error('Error chatting McpV1:', err)
      return err.toString()
    }
  }
}
