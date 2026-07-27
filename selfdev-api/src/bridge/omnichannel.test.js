import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  DurableOutbox,
  XmppAttachmentCollector,
  forwardEnvelopeToXmpp,
  isXmppFileUrl,
  makeInboundEnvelope,
  parseXmppPayload,
} from './omnichannel.js'

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
  let uploadNumber = 0
  const xmppAgent = {
    xmppClient: {
      async uploadFile() {
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
  const payload = JSON.parse(sent[2])
  assert.equal(payload.from, '15550001111')
  assert.deepEqual(
    payload.attachments.map(item => item.url),
    sent.slice(0, 2)
  )
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
