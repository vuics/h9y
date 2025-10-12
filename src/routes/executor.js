import { Router } from 'express'

import { checkAuth, checkAPIAuth, checkAdmin } from '../middleware/check-auth.js'
import { Verbose, log, warn, error } from '../services.js'
import Map from '../models/map.js'
import { nanoid } from 'nanoid'
import { sleep } from '../utils/helper.js'
import conf from '../conf.js'

import {
  createOnChatMessage,
  playMapCore,
  XmppClient,
} from '../maptor.js'


const verbose = Verbose('sd:routes/executor'); verbose('')
const app = Router()


function useState(initialValue) {
  let state = initialValue;
  function setState(newValue) {
    state = newValue;
    return state;
  }
  return [state, setState];
}

function useRef(initialValue) {
  return { current: initialValue };
}

export async function executeMap({ map, xmppClient }) {
  try {
    log('Executing map:', map.title, ', mapId:', map._id)

    const getNodes = () => map.flow.nodes;
    const getEdges = () => map.flow.edges;
    const setNodes = (updater) => map.flow.nodes = updater(map.flow.nodes);
    const setEdges = (updater) => map.flow.edges = updater(map.flow.edges);

    const onChatMessage = createOnChatMessage({
      getNodes, setNodes, shareUrlPrefix: conf.xmpp.shareUrlPrefix,
    });
    xmppClient.emitter.on('chatMessage', onChatMessage);
    xmppClient.emitter.on('error', (err) => {
      error(`XMPP error: ${err}`);
    })


    const [ reordering, setReordering ] = useState(false)
    const [ playing, setPlaying ] = useState(true)  // NOTE: play it immediatelly
    const [ stepping, setStepping ] = useState(false)
    const [ pausing, setPausing ] = useState(false)
    const playingRef = useRef(playing)
    const steppingRef = useRef(stepping)
    const pausingRef = useRef(pausing)
    playingRef.current = playing
    steppingRef.current = stepping
    pausingRef.current = pausing

    log('Play map core')
    await playMapCore({
      step: false, xmppClient,
      setPlaying, setPausing, setStepping, setReordering,
      playingRef, pausingRef, steppingRef,
      getNodes, getEdges, setNodes, setEdges,
    })

    log('Done playing map core. Saving results.')
    map.executing = false
    map.completed = true
    map.markModified('flow')
    await map.save();
    log('Done executing map:', map.title, ', mapId:', map._id)

    xmppClient.emitter.removeListener('chatMessage', onChatMessage);
  } catch (err) {
    error('Error running mapper:', err)
    throw err
  }
}

export async function deriveMap({ basicMap }) {
  try {
    const mapData = basicMap.toObject();
    delete mapData._id;
    delete mapData.createdAt;
    delete mapData.updatedAt;

    const resultMap = new Map(mapData);
    resultMap.title= `${basicMap.title} (result_${nanoid(9)})`;
    resultMap.templateMapId = basicMap._id;
    resultMap.executing = true
    resultMap.completed = false
    await resultMap.save();

    return resultMap
  } catch (err) {
    error('Error deriving map:', err)
    throw err
  }
}

app.post('/map/:mapId', checkAuth, async (req, res) => {
  try {
    verbose('mapper/run')
    // const { param } = req.body
    const { mapId } = req.params

    const basicMap = await Map.findById(mapId);
    if (!basicMap) {
      return res.status(404).json({ error: 'Map not found' });
    }
    if (!basicMap.userId.equals(req.user._id)) {
      return res.status(403).json({ error: 'Access to the map is forbidden' });
    }

    const resultMap = await deriveMap({ basicMap })
    res.json(resultMap);

    const xmppClient = new XmppClient()
    await xmppClient.connect({
      credentials: {
        user: req.user.xmpp.user,
        password: req.user.xmpp.password,
        jid: `${req.user.xmpp.user}@${conf.xmpp.host}`,
      },
      service: conf.xmpp.websocketUrl,
      domain: conf.xmpp.host,
    })
    console.log('XMPP initialized');

    await executeMap({ map: resultMap, xmppClient })
  } catch (err) {
    error('Error deriving/executing map:', err)
    throw err
  }
});

export default app
