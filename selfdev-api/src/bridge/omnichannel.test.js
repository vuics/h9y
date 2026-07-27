import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  DurableOutbox,
  XmppAttachmentCollector,
  createInboundXmppQueue,
  deserializeInboundAttachments,
  enqueueEnvelopeForXmpp,
  forwardEnvelopeToXmpp,
  isXmppFileUrl,
  makeInboundEnvelope,
  parseXmppPayload,
  serializeInboundAttachments,
} from './omnichannel.js'
import { replaceUrlPrefix } from '../maptor.js'

test('uses an internal URL for upload while preserving the public file path', () => {
  assert.equal(
    replaceUrlPrefix(
      'https://api.h9y.localhost/v1/files/slot-1/COA%20CBS-X.pdf',
      'https://api.h9y.localhost/v1/files/',
      'http://selfdev-api:6369/v1/files/'
    ),
    'http://selfdev-api:6369/v1/files/slot-1/COA%20CBS-X.pdf'
  )
  assert.equal(
    replaceUrlPrefix(
      'https://external.example/upload/slot-1',
      'https://api.h9y.localhost/v1/files/',
      'http://selfdev-api:6369/v1/files/'
    ),
    'https://external.example/upload/slot-1'
  )
})

test('recognizes only a standalone XMPP file sharing URL', () => {
  assert.equal(
    isXmppFileUrl('https://selfdev-prosody.dev.local:5281/file_share/a.pdf'),
    true
  )
  assert.equal(
    isXmppFileUrl('https://selfdev-prosody.dev.local:5281/file_share/a.pdf\nhello'),
    false
  )
  assert.equal(isXmppFileUrl('hello https://example.com/file.pdf'), false)
})

test('collects attachment URLs independently for each XMPP sender', () => {
  const collector = new XmppAttachmentCollector()
  collector.add('agent-a@example', 'https://example/file_share/a.pdf')
  collector.add('agent-b@example', 'https://example/file_share/b.pdf')
  collector.add('agent-a@example', 'https://example/file_share/c.pdf')

  assert.deepEqual(collector.take('agent-a@example'), [
    'https://example/file_share/a.pdf',
    'https://example/file_share/c.pdf',
  ])
  assert.deepEqual(collector.take('agent-b@example'), [
    'https://example/file_share/b.pdf',
  ])
  assert.deepEqual(collector.take('agent-a@example'), [])
})

test('parses legacy text and JSON XMPP payloads', () => {
  assert.deepEqual(parseXmppPayload('hello'), { text: 'hello' })
  assert.deepEqual(
    parseXmppPayload('{"to":"15550001111","text":"hello"}'),
    { to: '15550001111', text: 'hello' }
  )
})

test('sends each file URL alone before the final machine-readable payload', async () => {
  const sent = []
  const uploadRequests = []
  let uploadNumber = 0
  const xmppAgent = {
    xmppClient: {
      async uploadFile(request) {
        uploadRequests.push(request)
        uploadNumber += 1
        return `https://example/file_share/file-${uploadNumber}`
      },
      async sendPersonalMessage({ prompt }) {
        sent.push(prompt)
      },
    },
  }
  const bridge = {
    options: {
      enablePersonal: true,
      recipient: 'negotiator@example',
    },
  }
  const envelope = makeInboundEnvelope({
    channel: 'whatsapp',
    externalMessageId: 'wamid-1',
    from: '15550001111',
    text: 'Please see the files.',
  })

  await forwardEnvelopeToXmpp({
    bridge,
    xmppAgent,
    options: { messageFormat: 'json' },
    envelope,
    humanText: 'human message',
    attachments: [
      {
        buffer: Buffer.from('first'),
        filename: 'coa.pdf',
        contentType: 'application/pdf',
      },
      {
        buffer: Buffer.from('second'),
        filename: 'tds.pdf',
        contentType: 'application/pdf',
      },
    ],
  })

  assert.equal(sent.length, 3)
  assert.equal(sent[0], 'https://example/file_share/file-1')
  assert.equal(sent[1], 'https://example/file_share/file-2')
  assert.match(uploadRequests[0].shareUrlPrefix, /\/v1\/files\/$/)
  assert.match(uploadRequests[0].filesUrl, /\/v1\/files\/$/)
  const payload = JSON.parse(sent[2])
  assert.equal(payload.from, '15550001111')
  assert.deepEqual(
    payload.attachments.map(item => item.url),
    sent.slice(0, 2)
  )
})

test('serializes inbound attachment bytes for a durable queue', () => {
  const serialized = serializeInboundAttachments([
    {
      buffer: Buffer.from('certificate-data'),
      filename: 'coa.pdf',
      contentType: 'application/pdf',
    },
  ])
  const restored = deserializeInboundAttachments(
    JSON.parse(JSON.stringify(serialized))
  )

  assert.equal(restored[0].filename, 'coa.pdf')
  assert.equal(restored[0].contentType, 'application/pdf')
  assert.equal(restored[0].buffer.toString(), 'certificate-data')
})

test('retries a durable inbound XMPP job with its attachment intact', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'h9y-inbound-test-'))
  const sent = []
  let attempts = 0
  const xmppAgent = {
    xmppClient: {
      async uploadFile({ buffer }) {
        attempts += 1
        assert.equal(buffer.toString(), 'certificate-data')
        if (attempts === 1) throw new Error('temporary file API failure')
        return 'https://example/file_share/coa.pdf'
      },
      async sendPersonalMessage({ prompt }) {
        sent.push(prompt)
      },
    },
  }
  const bridge = {
    _id: { toString: () => 'bridge-1' },
    options: {
      enablePersonal: true,
      recipient: 'negotiator@example',
    },
  }
  const queue = createInboundXmppQueue({
    bridge,
    xmppAgent,
    options: { messageFormat: 'json' },
    config: {
      outboxDir: root,
      retryBaseSeconds: 1,
      retryMaxSeconds: 1,
      maxDeliveryAttempts: 3,
    },
  })
  await enqueueEnvelopeForXmpp(queue, {
    envelope: makeInboundEnvelope({
      channel: 'whatsapp',
      externalMessageId: 'wamid-retry',
      from: '15550001111',
      text: 'I attached the CoA.',
    }),
    humanText: 'I attached the CoA.',
    attachments: [{
      buffer: Buffer.from('certificate-data'),
      filename: 'coa.pdf',
      contentType: 'application/pdf',
    }],
  })
  queue.stop()
  await queue.flush()

  const retryJob = queue.list()[0]
  retryJob.nextAttemptAt = new Date(0).toISOString()
  queue.write(retryJob)
  await queue.flush()

  assert.equal(attempts, 2)
  assert.equal(queue.list().length, 0)
  assert.equal(sent[0], 'https://example/file_share/coa.pdf')
  assert.equal(JSON.parse(sent[1]).externalMessageId, 'wamid-retry')
  queue.stop()
  fs.rmSync(root, { recursive: true, force: true })
})

test('durable outbox deletes a job only after successful delivery', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'h9y-outbox-test-'))
  const delivered = []
  const outbox = new DurableOutbox({
    bridgeId: 'bridge-1',
    config: {
      outboxDir: root,
      retryBaseSeconds: 10,
      retryMaxSeconds: 900,
      maxDeliveryAttempts: 20,
    },
    deliver: async payload => delivered.push(payload),
  })
  await outbox.enqueue({ prompt: 'hello' })
  await outbox.flush()

  assert.deepEqual(delivered, [{ prompt: 'hello' }])
  assert.deepEqual(outbox.list(), [])
  outbox.stop()
  fs.rmSync(root, { recursive: true, force: true })
})
