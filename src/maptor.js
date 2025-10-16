///////////////////////////////////////////////////////////////////////////////
//
// NOTE: AVOID IMPORTING ANY LOCAL SOURCES IN THIS FILE.
//       IMPORT ONLY NPM PACKAGES.
//
// This is because this file works in both:
//  * selfdev-web (React.js frontend)
//  * selfdev-api (Node.js backend)
//
//  To overcome, an separate package can be created.
//  For now, it is the easiest way to copy this file between the repos.
//
///////////////////////////////////////////////////////////////////////////////
import { client, xml } from '@xmpp/client'
import safeRegex from 'safe-regex'
import { v4 as uuidv4 } from 'uuid'
import axios from 'axios'
import EventEmitter from 'eventemitter3';

export function sleep (ms) { return new Promise(resolve => setTimeout(resolve, ms)) }

export const variableRegex = /(\[\[[A-Za-z0-9_-]+\]\])/g;
export const unameRegex = /\[\[([A-Za-z0-9_-]+)\]\]/;
export const commentRegex = /(\[\/\*\[[A-Za-z0-9_-]+\]\*\/\])/g;
export const ucommentRegex = /\[\/\*\[([A-Za-z0-9_-]+)\]\*\/\]/;
export const variableOrCommentRegex = /(\[\[[A-Za-z0-9_-]+\]\])|(\[\/\*\[[A-Za-z0-9_-]+\]\*\/\])/g;

export function parseRegexString(input) {
  const match = input.match(/^\/(.*)\/([a-z]*)$/i);
  if (!match) throw new Error("Invalid regex format");
  const [, pattern, flags] = match;
  return { pattern, flags };
}

export function buildSmartText({ text, getNodes }) {
  const allNodes = getNodes()
  let parts = ''
  let smartText = ''
  const startTime = Date.now()
  do {
    if (Date.now() - startTime > 5000) {
      console.warn('buildSmartText> Loop timed out after 5 seconds.');
      break;
    }
    parts = text.split(variableOrCommentRegex)
    // console.log('parts:', parts)
    smartText = parts.map((part) => {
      if (variableRegex.test(part)) {
        let uname = part
        const match = part.match(unameRegex);
        // console.log('match:', match)
        if (match) {
          uname = match[1]
        }
        let foundNodes = allNodes.filter((n) => n.data.uname === uname);
        let nodeText
        if (foundNodes.length === 1) {
          nodeText = foundNodes[0].data.text
        } else {
          console.warn('buildSmartText> foundNodes for part:', part, 'do not consist of exactly one node, foundNodes:', foundNodes)
          nodeText = ''
        }
        // console.log('nodeText:', nodeText)
        return nodeText
      } if (commentRegex.test(part)) {
        return ''
      } else {
        // console.log('part:', part)
        return part
      }
    } ).join('');
    // console.log('smartText:', smartText)
    text = smartText
  } while (parts.length > 1)
  return smartText
}

export function checkCondition({ condition, text }) {
  let satisfied = true
  let safe = true
  if (condition) {
    const { pattern, flags } = parseRegexString(condition);
    console.log('pattern:', pattern, ', flags:', flags)
    safe = safeRegex(pattern)
    if (safe) {
      const safeRegex = new RegExp(pattern, flags);
      satisfied = safeRegex.test(text)
    }
  }
  // console.log('condition:', condition, ', satisfied:', satisfied, ', safe:', safe)
  return [ satisfied, safe ]
}

export async function playEdge ({
  sourceNodeData, edgeData, edgeId, targetId,
  getNodes, setNodes, getEdges, setEdges,
  xmppClient,
}) {
  const { text, attachments } = sourceNodeData
  const { recipient, condition } = edgeData
  const smartText = buildSmartText({ text, getNodes })
  // console.log('smartText:', smartText)
  const [ satisfied, safe ] = checkCondition({ condition, text: smartText })
  // console.log('condition:', condition, ', satisfied:', satisfied, ', safe:', safe)

  // console.log('playEdge smartText:', smartText, ', satisfied:', satisfied, ', safe:', safe)
  // console.log('assign waitRecipient:', (smartText && satisfied) ? recipient : undefined)
  setNodes((nodes) =>
    nodes.map((node) =>
      node.id === targetId ? {
        ...node,
        data: {
          ...node.data,
          waitRecipient: (smartText && satisfied) ? recipient : undefined,
          text: recipient ? '' : node.data.text,
        }
      } : node
    )
  )
  setEdges((edges) =>
    edges.map((edge) =>
      edge.id === edgeId ? { ...edge, data: { ...edge.data, satisfied, safe, cursor: true } } : edge
    )
  )

  if (recipient) {
    if (attachments && attachments.length > 0) {
      await xmppClient.sendAttachments({ recipient, attachments })
    }
    await xmppClient.sendPersonalMessage({ recipient, prompt: smartText });
  } else {
    const edges = getEdges()
    const edge = edges.find(edge => edge.id === edgeId)
    const nodes = getNodes()
    const sourceNode = nodes.find(node => node.id === edge.source)
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id === edge.target) {
          // console.log('+ smartText:', smartText, ', satisfied:', satisfied)
          if ((smartText || sourceNode.data.attachments?.length > 0) && satisfied) {
            const attachments = [...new Set([...(node.data.attachments || []), ...(sourceNode.data.attachments || []) ])]
            // console.log('edge attachments:', attachments)
            if (!node.data.text.includes(`[[${sourceNode.data.uname}]]`) &&
                !node.data.text.includes(`[/*[${sourceNode.data.uname}]*/]`)) {
              return { ...node, data: { ...node.data, text: node.data.text + `[[${sourceNode.data.uname}]]`, attachments } }
            } else if (node.data.text.includes(`[/*[${sourceNode.data.uname}]*/]`)) {
              return { ...node, data: { ...node.data, text: node.data.text.replace(`[/*[${sourceNode.data.uname}]*/]`, `[[${sourceNode.data.uname}]]`), attachments } }
            }
            return { ...node, data: { ...node.data, attachments } }
          } else {
            // unlinkEdge({ edge, getNodes, setNodes })
            return { ...node, data: { ...node.data, text: node.data.text.replace(`[[${sourceNode.data.uname}]]`, `[/*[${sourceNode.data.uname}]*/]`), attachments: node.data.attachments?.filter(item => !sourceNode.data.attachments.includes(item)) } }
          }
        }
        return node
      })
    );
  }
}

export function unlinkEdge({ edge, getNodes, setNodes }) {
  const nodes = getNodes()
  const sourceNode = nodes.find(node => node.id === edge.source)
  setNodes((nodes) =>
    nodes.map((node) =>
      node.id === edge.target ? { ...node, data: { ...node.data,
        text: node.data.text.replace(`[[${sourceNode.data.uname}]]`, '').replace(`[/*[${sourceNode.data.uname}]*/]`, '') }
      } : node
    )
  )
}

export function createOnChatMessage({ getNodes, setNodes, shareUrlPrefix }) {
  return function onChatMessage({ from, body }) {
    console.log('onChatMessage from:', from, ', body:', body)
    const [updateNode] = getNodes().filter(nd =>
      nd.type === 'NoteNode' && nd.data.waitRecipient === from.split('/')[0]
    );
    if (updateNode) {
      const shareUrlRegex = new RegExp(
        "^" + shareUrlPrefix.replace(/[-\\^$*+?.()|[\]{}]/g, "\\$&")
      );
      if (shareUrlRegex.test(body)) {
        setNodes(nodes =>
          nodes.map(node =>
            node.id === updateNode.id
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    attachments: [...(node.data.attachments || []), body],
                  },
                }
              : node
          )
        );
      } else {
        setNodes(nodes =>
          nodes.map(node =>
            node.id === updateNode.id
              ? {
                  ...node,
                  data: { ...node.data, text: body, waitRecipient: undefined },
                  width: 600,
                  height: undefined,
                }
              : node
          )
        );
      }
    }
  }
}

export async function playMapCore ({
  step = false, xmppClient,
  setPlaying, setPausing, setStepping, setReordering,
  playingRef, pausingRef, steppingRef,
  getNodes, getEdges, setNodes, setEdges,
} = {}) {
  // console.log('playMapCore')
  setPlaying(true)
  if (!step) {
    setPausing(false)
  }
  setReordering(false)

  const groupNodes = getNodes().filter(nd => nd.type === 'group')
  const groupElements = []
  // console.log('groupNodes:', groupNodes)
  for (let groupNode of groupNodes) {
    const parentId = groupNode.id
    const childNodeIds = getNodes().filter(nd => nd.parentId === groupNode.id).map(nd => nd.id)
    groupElements.push({
      parentId,
      childNodeIds,
      and: groupNode.data.and,
      // init loop variables but do not participate in a loop
      initEdgeIds: getEdges().filter(ed => !childNodeIds.includes(ed.source) && childNodeIds.includes(ed.target)).map(ed => ed.id),
      // repeats continuously unil one of the exit edges conditinos get satisfied starting with the first edge in array
      innerEdgeIds: getEdges().filter(ed => childNodeIds.includes(ed.source) && childNodeIds.includes(ed.target)).map(ed => ed.id),
      // allow exit loop if one of the edge's conditions get satisfied
      exitEdgeIds: getEdges().filter(ed => childNodeIds.includes(ed.source) && !childNodeIds.includes(ed.target)).map(ed => ed.id),
      // loop through all inner and exit edges
      loopEdgeIds: getEdges().filter(ed => childNodeIds.includes(ed.source)).map(ed => ed.id),
    })
  }
  // console.log('groupElements:', groupElements)

  let sequence = 1
  setEdges((edges) =>
    edges.map((edge) => {
      return { ...edge, data: { ...edge.data, sequence: sequence++, expecting: true, cursor: undefined } }
    })
  );
  const edges = getEdges()
  // console.log('edges:', edges)

  const inactiveLoop = {
    active: false,
    fromEdgeId: '',
    fromEdgeIndex: null,
    groupElement: null,
    remainingEdgeIds: [],
  }
  let loop = Object.assign({}, inactiveLoop)
  let edgeIndex = 0;
  while(edgeIndex < edges.length) {
    // console.log('process edgeIndex:', edgeIndex)
    const edge = edges[edgeIndex]
    await sleep(100)  // NOTE: this sleep is needed in case the variable just got updated the note which is source of this calcualted

    // console.log('edge:', edge)
    // console.log('edge.source:', edge.source, ', edge.target:', edge.target)
    const nodes = getNodes()
    // console.log('nodes:', nodes)
    const sourceNode = nodes.find(node => node.id === edge.source)
    // const targetNode = nodes.find(node => node.id === edge.target)
    // console.log('sourceNode:', sourceNode)
    // console.log('targetNode:', targetNode)

    console.log('Start playEdge sourceNodeData:', sourceNode.data, ', edgeData:', edge.data)
    await playEdge({
      sourceNodeData: sourceNode.data, edgeData: edge.data,
      getNodes, setNodes, getEdges, setEdges,
      xmppClient,
      edgeId: edge.id, targetId: edge.target,
    })
    // console.log('Done playEdge sourceNodeData')

    // console.log('while playingRef')
    while (playingRef.current) {
      await sleep(1000)
      const nodes1 = getNodes()
      // console.log('nodes1:', nodes1)
      // console.log('edge.target:', edge.target)
      const targetNode1 = nodes1.find(node1 => node1.id === edge.target)
      // console.log('targetNode1:', targetNode1)
      if (!targetNode1) {
        break
      }
      console.log('targetNode1.data.waitRecipient:', targetNode1.data.waitRecipient)
      if (targetNode1.data.waitRecipient === undefined) {
        setEdges((edges1) =>
          edges1.map((edge1) =>
            edge1.id === edge.id ? { ...edge1, data: { ...edge1.data, expecting: undefined, cursor: undefined } } : edge1
          )
        );
        break
      }
    }
    // console.log('After response getNodes():', getNodes())

    // console.log('if not loop.active')
    if (!loop.active) {
      for (const groupElement of groupElements) {
        if (groupElement.innerEdgeIds.includes(edge.id)) {
          loop.active = true
          loop.fromEdgeId = edge.id
          loop.fromEdgeIndex = edgeIndex
          loop.groupElement = groupElement
          loop.remainingEdgeIds = loop.groupElement.loopEdgeIds
          console.log('loop:', loop)
        }
      }
    }

    // console.log('if loop.active')
    let edgeIndexUpdated = false
    if (loop.active) {
      loop.remainingEdgeIds = loop.remainingEdgeIds.filter(eid => eid !== edge.id)
      // console.log('loop.remainingEdgeIds:', loop.remainingEdgeIds)
      if (loop.remainingEdgeIds.length === 0) {
        const exitEdgesSatisfied = getEdges().filter(eg => loop.groupElement.exitEdgeIds.includes(eg.id)).map(eg => eg.data.satisfied)
        // console.log('exitEdgesSatisfied:', exitEdgesSatisfied)
        let exitLoop = false
        if (loop.groupElement.and) {
          if (!exitEdgesSatisfied.includes(false)) {
            // AND loop exit
            exitLoop = true
          }
        } else {
          if (exitEdgesSatisfied.includes(true)) {
            // OR loop exit
            exitLoop = true
          }
        }

        if (exitLoop) {
          // console.log('exit loop')
          loop = Object.assign({}, inactiveLoop)
        } else{
          // console.log('restart loop')
          edgeIndex = loop.fromEdgeIndex
          edgeIndexUpdated = true
          loop.remainingEdgeIds = loop.groupElement.loopEdgeIds

          setEdges((edges) =>
            edges.map((edge) => {
              return {
                ...edge,
                data: loop.remainingEdgeIds.includes(edge.id) ? { ...edge.data, expecting: true, cursor: undefined } : edge.data
              }
            })
          );
        }
      }
    }

    if (!edgeIndexUpdated) {
      edgeIndex++
    }
    if (steppingRef.current) {
      setStepping(false)
      steppingRef.current = false
      setPausing(true)
      pausingRef.current = true
    }

    // console.log("playingRef.current:", playingRef.current)
    if (!playingRef.current) {
      // console.log("Break cause !playingRef.current")
      break
    }
    while (pausingRef.current) {
      // console.log('sleep 1000')
      await sleep(1000)
    }
  }

  setPlaying(false)
  setStepping(false)
  setPausing(false)
  // console.log('done playMapCore')
}


export class XmppClient {
  constructor () {
    this.client = null
    this.emitter = new EventEmitter();
    this.credentials = null
    this.roster = []
    this.presence = {}
  }

  async connect({ credentials, service, domain, mucHost, joinRooms  }) {
    if (!credentials || !credentials.user || !credentials.password || !credentials.jid) {
      console.error("No credentials error");
      return null;
    }
    this.credentials = credentials

    // Allow self-signed certs in Node
    const isNode = typeof process !== 'undefined' &&
                   process.release &&
                   process.release.name === 'node';
    if (isNode) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    }

    // Initialize XMPP client
    this.xmpp = client({
      service,
      domain,
      username: this.credentials.user,
      password: this.credentials.password,
      tls: { rejectUnauthorized: false },
    });
    // console.log('initXmppClient assign this.xmpp=', this.xmpp)

    // ✅ Wrap connection in a Promise to await readiness
    const ready = new Promise((resolve, reject) => {
      this.xmpp.on('online', async (jid) => {
        console.log(`Connected as ${jid.toString()}`);

        try {
          // Request roster
          await this.xmpp.send(xml('iq', { type: 'get', id: 'roster_1' },
            xml('query', { xmlns: 'jabber:iq:roster' })
          ));
          console.log('Requested roster');

          // Send presence
          await sleep(200)
          const presence = xml('presence',
            {},
            xml('show', {}, 'chat'),
            xml('status', {}, 'available')
          );
          await this.xmpp.send(presence);
          console.log('Sent initial presence');

          // Join MUC rooms ---
          if (mucHost && joinRooms) {
            for (const joinRoom of joinRooms) {
              const roomJid = `${joinRoom}@${mucHost}`
              await this.joinRoom({ roomJid })
            }
          }

          this.emitter.emit('online', { jid })
          resolve(this); // ✅ resolve once connected and ready
        } catch (err) {
          reject(err);
        }
      });

      this.xmpp.on('error', (err) => {
        console.error('XMPP error:', err);
        reject(err);
        this.emitter.emit('error', err)
      });

      this.xmpp.on('close', () => {
        console.log('Connection closed');
        this.emitter.emit('close')
      });

      // Handle incoming stanzas
      this.xmpp.on('stanza', (stanza) => {
        // console.log('Got stanza:', stanza.toString());

        if (stanza.is('iq') && stanza.attrs.type === 'result') {
          // Handle roster
          const query = stanza.getChild('query', 'jabber:iq:roster');
          if (query) {
            // console.log('recieved roster query:', query)
            const items = query.getChildren('item');
            if (items && items.length) {
              this.roster = items.map(({ attrs }) => ({
                jid: attrs.jid.split('/')[0],
                name: attrs.name,
              }));
              this.emitter.emit('roster', this.roster)
            }
          }
        } else if (stanza.is('presence')) {
           // Handle presence
          const from = stanza.attrs.from;
          const type = stanza.attrs.type;
          const jid = from.split('/')[0];
          this.presence = {
            ...this.presence,
            [jid]: type !== 'unavailable'
          }
          if (stanza.attrs.type === 'subscribe') {
            this.xmpp.send(xml('presence', { to: stanza.attrs.from, type: 'subscribed' }));
          }
          this.emitter.emit('presence', this.presence)
        }

        // Skip non-message stanzas
        if (!stanza.is('message')) return;

        const body = stanza.getChildText('body');
        if (!body) return;

        const from = stanza.attrs.from;
        const type = stanza.attrs.type;

        if (type === 'chat' || type === 'normal' || !type) {
          console.log(`Personal message response from ${from}: ${body}`);
          this.emitter.emit('chatMessage', { from, type, body })
        } else if (type === 'groupchat') {
          // Skip our own messages
          if (from.includes(`/${this.credentials.user}`)) return; // Skip self
          // Skip historical messages
          const delay = stanza.getChild('delay');
          if (delay) { return; }

          let mentioned = false
          // Detect <reference type="mention" xmlns="urn:xmpp:reference:0"/>
          const refs = stanza.getChildren('reference', 'urn:xmpp:reference:0')
          for (const ref of refs) {
            const type = ref.attrs.type
            const uri = ref.attrs.uri
            if (type === 'mention' && uri && uri.endsWith(`/${this.credentials.user}`)) {
              console.log(`🔔 Mention detected via reference: ${uri}`)
              mentioned = true
            }
          }
          if (!mentioned || !body.includes(`${this.credentials.user}`)) {
            console.log(`Mention is not detected via nickname ${this.credentials.user}`)
            mentioned = false
          }

          console.log(`Group chat message from ${from}: ${body}`);
          this.emitter.emit('groupMessage', { from, type, body, mentioned })
        }
      });
    });

    await this.xmpp.start().catch((err) => {
      console.error('Failed to start XMPP:', err);
      throw err;
    });

    return ready; // resolves when "online" event fires
  }

  async disconnect () {
    console.log('Disconnecting XmppClient...');
    const unavailable = xml('presence', { type: 'unavailable' },
      xml('status', {}, 'Disconnecting')
    );
    await this.xmpp.send(unavailable);
    await this.xmpp.stop();
  }

  async addToRoster ({ jid, name, groups = [] } = {}) {
    const iq = xml(
      'iq',
      { type: 'set', id: `roster_${uuidv4()}` },
      xml('query', { xmlns: 'jabber:iq:roster' }, [
        xml(
          'item',
          { jid, name },
          groups.map(group => xml('group', {}, group))
        ),
      ])
    )
    await this.xmpp.send(iq)
    console.log('addToRoster iq:', iq)

    // Send a subscription request
    const presence = xml('presence', { to: jid, type: 'subscribe' })
    await this.xmpp.send(presence)
    console.log('addToRoster subscribe presense:', presence)
  }

  async removeFromRoster ({ jid }) {
    const iq = xml(
      'iq',
      { type: 'set', id: `remove_${uuidv4()}` },
      xml('query', { xmlns: 'jabber:iq:roster' }, [
        xml('item', { jid, subscription: 'remove' }),
      ])
    )

    await this.xmpp.send(iq)
  }

  async sendPersonalMessage ({ recipient, prompt }) {
    console.log("sendPersonalMessage to:", recipient, ', prompt:', prompt)
    if (!recipient || !prompt || !this.credentials) {
      return console.error('Error sending personal message to recipient:', recipient, ', prompt:', prompt)
    }
    const message = xml('message', {
        type: 'chat',
        to: recipient,
        from: this.credentials.jid,
        id: uuidv4()
      },
      xml('active', { xmlns: 'http://jabber.org/protocol/chatstates' }),
      xml('body', {}, prompt)
    );
    // console.log('sendPersonalMessage this.xmpp:', this.xmpp)
    await this.xmpp.send(message);
    console.log('Personal message sent, prompt:', prompt, ', to:', recipient);
  }

  async sendAttachments ({ recipient, attachments }) {
    if (!this.credentials || !recipient || !attachments) {
      return console.error('Error sending attachments to recipient:', recipient, ', attachments:', attachments)
    }
    for (const url of attachments) {
      const message = xml('message', {
          type: 'chat',
          to: recipient,
          from: this.credentials.jid,
          id: uuidv4()
        },
        xml('body', {}, url),
        // Optionally, include XEP-0066 Out of Band Data
        xml('x', { xmlns: 'jabber:x:oob' },
          xml('url', {}, url),
          xml('desc', {}, 'Uploaded file')
        )
      )
      await this.xmpp.send(message);
      console.log('Personal message with attachment sent, url:', url, ', to:', recipient);
    }
  }

  async uploadFile ({
    buffer, filename, size, contentType = 'application/octet-stream', shareHost } = {}
  ) {
    try {
      // console.log('Content-Type:', contentType);
      const slotRequestIQ = xml(
        'iq',
        { type: 'get', to: shareHost, id: `upload_${uuidv4()}` },
        xml('request', {
          xmlns: 'urn:xmpp:http:upload:0',
          filename,
          size,
          'content-type': contentType,
        })
      );
      // console.log('📤 Sending slot request...');
      const response = await this.xmpp.sendReceive(slotRequestIQ);
      // console.log('response:', response)

      const slot = response.getChild('slot', 'urn:xmpp:http:upload:0');
      const putEl = slot.getChild('put');
      const putUrl = putEl?.attrs?.url || '';
      const getUrl = slot.getChild('get')?.attrs?.url || '';
      // console.log('✅ Upload slot received:', slot)
      // console.log('PUT URL:', putUrl);
      // console.log('GET URL:', getUrl);

      let headers = {};
      const headerEls = putEl?.getChildren('header') || [];
      console.log('headerEls:', headerEls)
      for (const headerEl of headerEls) {
        const name = headerEl.attrs.name;
        const value = headerEl.getText();
        headers[name] = value;
      }
      headers['Content-Type'] = contentType
      // console.log('headers:', headers)

      // const response1 =
      await axios.put(putUrl, buffer, { headers });
      // console.log('response1:', response1);
      console.log('✅ File uploaded, link:', getUrl);
      return getUrl
    } catch (err) {
      console.error('Error geting upload slot or uploading:', err);
      throw err
    }
  }

  async joinRoom ({ roomJid }) {
    if (!this.credentials || !roomJid) {
      return console.error('Error joining room:', roomJid)
    }
    console.log(`Joining group chat ${roomJid} as ${this.credentials.user}...`);
    const presence = xml(
      'presence',
      { to: `${roomJid}/${this.credentials.user}` },
      xml('x', { xmlns: 'http://jabber.org/protocol/muc' },
        xml('history', { maxstanzas: '0', maxchars: '0' })
      )
    );
    await this.xmpp.send(presence);
    console.log('Joined group chat');
    // await sleep(2000)
  }

  async sendRoomMessage ({ room, recipient, prompt, mucHost }) {
    const roomJid = room.includes("@") ? room : `${room}@${mucHost}`
    await this.joinRoom({ roomJid })
    const nickname = recipient.split('@')[0];
    const body = `@${nickname} ${prompt}`;
    const message = xml('message', {
        type: 'groupchat',
        to: roomJid,
        id: uuidv4(),
        'xml:lang': 'en',
      },
      xml('body', {}, body),
      xml('reference', {
        xmlns: 'urn:xmpp:reference:0',
        type: 'mention',
        begin: '0',
        end: nickname.length + 1,
        uri: `xmpp:${nickname}@${mucHost}/${nickname}`
      })
    );
    await this.xmpp.send(message);
    console.log('Message with mention sent, body:', body, ', roomJid:', roomJid);
  }
}

