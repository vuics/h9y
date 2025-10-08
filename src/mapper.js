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
        return nodeText
      } if (commentRegex.test(part)) {
        return ''
      } else {
        return part
      }
    } ).join('\n');
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
  console.log('condition:', condition, ', satisfied:', satisfied, ', safe:', safe)
  return [ satisfied, safe ]
}

export async function playEdge ({
  sourceNodeData, edgeData,
  getNodes, setNodes, getEdges, setEdges,
  credentials, sendPersonalMessage, sendAttachments,
  edgeId, targetId,
}) {
  const { text, attachments } = sourceNodeData
  const { recipient, condition } = edgeData
  const smartText = buildSmartText({ text, getNodes })
  // console.log('smartText:', smartText)
  const [ satisfied, safe ] = checkCondition({ condition, text: smartText })
  // console.log('condition:', condition, ', satisfied:', satisfied, ', safe:', safe)

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
      await sendAttachments({ credentials, recipient, attachments })
    }
    await sendPersonalMessage({ credentials, recipient, prompt: smartText });
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

// ui
export function startEditing({ id, data, setNodes }) {
  console.log('startEditing')
  if (!data.editing) {
    console.log('startEditing: update nodes')
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, editing: !data.editing } } : node
    ))
  }
}

// ui
export function switchEditing({ id, data, setNodes }) {
  console.log('switchEditing')
  setNodes((nodes) =>
    nodes.map((node) =>
      node.id === id ? { ...node, data: { ...node.data, editing: !data.editing } } : node
    )
  );
}

const xmppRef = {
  current: null
}

export function initXmppClient({
  credentials, service, domain, shareUrlPrefix,
  setLoading, setResponseError, setRoster, setPresence,
  getNodes, setNodes,
}) {
    if (xmppRef.current) {
      console.warn('xmpp was already set')
      return xmppRef.current
    }
    if (!credentials || !credentials.user || !credentials.password || !credentials.jid) {
      return console.error("No credentials error")
    }

    // FIXME: fix the certificate
    const isNode = typeof process !== 'undefined' &&
                   process.release &&
                   process.release.name === 'node';
    if (isNode) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    }

    // Initialize XMPP client
    const xmpp = client({
      service,
      domain,
      username: credentials.user,
      password: credentials.password,
      tls: {
        rejectUnauthorized: false
      }
    });
    xmppRef.current = xmpp;
    // console.log('initXmppClient assign xmppRef.current=', xmppRef.current)

    // Handle online event
    xmpp.on('online', async (jid) => {
      console.log(`Connected as ${jid.toString()}`);

      // Get roster (contact list)
      await xmpp.send(xml('iq', { type: 'get', id: 'roster_1' },
        xml('query', { xmlns: 'jabber:iq:roster' })
      ));
      console.log('Requested roster');

      // Send initial presence to let the server know we're online
      xmpp.send(xml('presence'));
      console.log('Sent initial presence');

      setLoading(false)
    });

    // Handle errors
    xmpp.on('error', (err) => {
      setLoading(false)
      console.error('XMPP error:', err);
      setResponseError(`XMPP error: ${err}`)
    });

    // Handle disconnection
    xmpp.on('close', () => {
      setLoading(false)
      console.log('Connection closed');
    });

    // Handle incoming stanzas
    xmpp.on('stanza', (stanza) => {
      // console.log('Got stanza:', stanza.toString());

      if (stanza.is('iq') && stanza.attrs.type === 'result') {
        const query = stanza.getChild('query', 'jabber:iq:roster');
        if (query) {
          const items = query.getChildren('item');
          if (items && items.length) {
            const updatedRoster = items.map(({ attrs }) => {
              return {
                jid: attrs.jid.split('/')[0],
                name: attrs.name,
              };
            });
            setRoster(updatedRoster);
          }
        }
      } else if (stanza.is('presence')) {
        const from = stanza.attrs.from;
        const type = stanza.attrs.type;
        const jid = from.split('/')[0];

        setPresence(prev => {
          return { ...prev, [jid]: type !== 'unavailable' };
        });
      }

      // Skip non-message stanzas
      if (!stanza.is('message')) return;

      const body = stanza.getChildText('body');
      if (!body) return;

      const from = stanza.attrs.from;
      const type = stanza.attrs.type;

      if (type === 'chat' || type === 'normal' || !type) {
        console.log(`Personal message response from ${from}: ${body}`);
        const [updateNode] = getNodes().filter(nd => nd.type === 'NoteNode' && nd.data.waitRecipient === from.split('/')[0])
        if (updateNode) {
          const shareUrlRegex = new RegExp(
            "^" + shareUrlPrefix.replace(/[-\\^$*+?.()|[\]{}]/g, "\\$&")
          );
          if (shareUrlRegex.test(body)) {
            setNodes((nodes) =>
              nodes.map((node) =>
                node.id === updateNode.id ? {
                  ...node,
                  data: {
                    ...node.data,
                    attachments: [...(node.data.attachments || []), body]
                  },
                } : node
              )
            );
          } else {
            setNodes((nodes) =>
              nodes.map((node) =>
                node.id === updateNode.id ? {
                  ...node,
                  data: { ...node.data, text: body, waitRecipient: undefined, },
                  // Make the proper sizing. Allow dynamic change of heigth.
                  width: 600,
                  height: undefined,
                } : node
              )
            );
          }
        }
      } else if (type === 'groupchat') {
        // Skip our own messages
        if (from.includes(`/${credentials.user}`)) return;

        // Skip historical messages
        const delay = stanza.getChild('delay');
        if (delay) return;

        console.log(`Group chat message from ${from}: ${body}`);
      }
    });

  xmpp.start().catch(console.error);
  return xmppRef.current
}

export async function sendPersonalMessage ({ credentials, recipient, prompt }) {
  if (!recipient || !prompt || !credentials) {
    return console.error('Error sending personal message to recipient:', recipient, ', prompt:', prompt)
  }
  const message = xml('message', {
      type: 'chat',
      to: recipient,
      from: credentials.jid,
      id: uuidv4()
    },
    xml('active', { xmlns: 'http://jabber.org/protocol/chatstates' }),
    xml('body', {}, prompt)
  );
  // console.log('sendPersonalMessage xmppRef.current:', xmppRef.current)
  await xmppRef.current.send(message);
  console.log('Personal message sent, prompt:', prompt, ', to:', recipient);
}

export async function sendAttachments ({ credentials, recipient, attachments }) {
  if (!credentials || !recipient || !attachments) {
    return console.error('Error sending attachments to recipient:', recipient, ', attachments:', attachments)
  }
  for (const url of attachments) {
    const message = xml('message', {
        type: 'chat',
        to: recipient,
        from: credentials.jid,
        id: uuidv4()
      },
      xml('body', {}, url),
      // Optionally, include XEP-0066 Out of Band Data
      xml('x', { xmlns: 'jabber:x:oob' },
        xml('url', {}, url),
        xml('desc', {}, 'Uploaded file')
      )
    )
    await xmppRef.current.send(message);
    console.log('Personal message with attachment sent, url:', url, ', to:', recipient);
  }
}

export async function uploadFile ({
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
    const response = await xmppRef.current.sendReceive(slotRequestIQ);
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

export async function joinRoom ({ roomJid, credentials }) {
  //
  // TODO: remember joined rooms and do not join if joined
  //
  console.log(`Joining group chat ${roomJid} as ${credentials.user}...`);
  const presence = xml(
    'presence',
    { to: `${roomJid}/${credentials.user}` },
    xml('x', { xmlns: 'http://jabber.org/protocol/muc' },
      xml('history', { maxstanzas: '0', maxchars: '0' })
    )
  );
  await xmppRef.current.send(presence);
  console.log('Joined group chat');
  // await new Promise(resolve => setTimeout(resolve, 2000));
}

export async function sendRoomMessage ({ room, recipient, prompt, mucHost }) {
  const roomJid = room.includes("@") ? room: `${room}@${mucHost}`
  await joinRoom({ roomJid })
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
  await xmppRef.current.send(message);
  console.log('Message with mention sent, body:', body, ', roomJid:', roomJid);
}


export async function playMapCore ({
  step = false, credentials,
  setPlaying, setPausing, setStepping, setReordering,
  playingRef, pausingRef, steppingRef,
  getNodes, getEdges, setNodes, setEdges,
} = {}) {
  console.log('playMap')
  setPlaying(true)
  if (!step) {
    setPausing(false)
  }
  setReordering(false)

  const groupNodes = getNodes().filter(nd => nd.type === 'group')
  const groupElements = []
  console.log('groupNodes:', groupNodes)
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
  console.log('groupElements:', groupElements)

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

    await playEdge({
      sourceNodeData: sourceNode.data, edgeData: edge.data,
      getNodes, setNodes, getEdges, setEdges,
      credentials, sendPersonalMessage, sendAttachments,
      edgeId: edge.id, targetId: edge.target,
    })

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
      // console.log('targetNode1.data.waitRecipient:', targetNode1.data.waitRecipient)
      if (targetNode1.data.waitRecipient === undefined) {
        setEdges((edges1) =>
          edges1.map((edge1) =>
            edge1.id === edge.id ? { ...edge1, data: { ...edge1.data, expecting: undefined, cursor: undefined } } : edge1
          )
        );
        break
      }
    }

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

    let edgeIndexUpdated = false
    if (loop.active) {
      loop.remainingEdgeIds = loop.remainingEdgeIds.filter(eid => eid !== edge.id)
      console.log('loop.remainingEdgeIds:', loop.remainingEdgeIds)
      if (loop.remainingEdgeIds.length === 0) {
        const exitEdgesSatisfied = getEdges().filter(eg => loop.groupElement.exitEdgeIds.includes(eg.id)).map(eg => eg.data.satisfied)
        console.log('exitEdgesSatisfied:', exitEdgesSatisfied)
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
          console.log('exit loop')
          loop = Object.assign({}, inactiveLoop)
        } else{
          console.log('restart loop')
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

    if (!playingRef.current) {
      break
    }
    while (pausingRef.current) {
      await sleep(1000)
    }
  }

  setPlaying(false)
  setStepping(false)
  setPausing(false)
}

