import { log, warn, error, Verbose } from '../services.js'
import Bridge from '../models/bridge.js'
import conf from '../conf.js'

const verbose = Verbose('sd:bridge/connector'); verbose('')

export default class Connector {
  constructor ({ bridge }) {
    this.bridge = bridge
    verbose('Connector constructed')

    this.logs = ''
    this.collectLogs = true

    // Map<requestId, { resolve, reject, timeout }>
    this.pendingResponses = null;
  }

  async start () {
    verbose('Connector started')
    this.pendingResponses = new Map();
  }

  async stop () {
    verbose('Connector stopped')

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
  }

  async saveLogs () {
    try {
      const bridgeDoc = await Bridge.findById(this.bridge._id)
      if (bridgeDoc) {
        bridgeDoc.logs = this.logs
        await bridgeDoc.save()
        log('Logs saved for bridge:', this.bridge._id, ":", this.bridge.options.name)
        // verbose('bridgeDoc:', bridgeDoc)
        // verbose('bridgeDoc.logs:', bridgeDoc.logs)
      }
    } catch (err) {
      error('Error saving logs:', err)
    }
  }

  waitForXmppResponse({ requestId, timeoutSec = 300 } = {}) {
    return new Promise((resolve, reject) => {
      const timeoutMs = timeoutSec * 1000;
      const timeout = setTimeout(() => {
        this.pendingResponses.delete(requestId);
        reject(new Error('Timeout waiting for XMPP response'));
      }, timeoutMs);

      this.pendingResponses.set(requestId, { resolve, reject, timeout });
    });
  }

  resolveXmppResponse({ requestId, response }) {
    if (!requestId || !this.pendingResponses.has(requestId)) {
      // fallback: match last pending request
      warn('Unmatched XMPP response; attempting fallback match');
      const lastEntry = Array.from(this.pendingResponses.entries()).pop();
      if (lastEntry) {
        const [lastRequestId] = lastEntry;
        requestId = lastRequestId
      } else {
        warn('No pending MCP requests to match XMPP response.');
      }
    }
    const entry = this.pendingResponses.get(requestId);
    if (!entry) return false;
    clearTimeout(entry.timeout);
    entry.resolve(response);
    this.pendingResponses.delete(requestId);
    return true;
  }
}

