import { Router } from 'express';
// import axios from 'axios';
// import { inspect } from 'util';
// import _ from 'lodash'

import { checkAuth } from '../middleware/check-auth.js';
import { Verbose, log, warn, error } from '../services.js';
import Map from '../models/map.js'
import Agent from '../models/agent.js'
import Bridge from '../models/bridge.js'
import App from '../models/app.js'
import conf from '../conf.js'

const verbose = Verbose('sd:routes/dashboard'); verbose('');
const router = Router();

router.get('/', checkAuth, async (req, res, next) => {
  try {
    verbose('dashboard body:', req.body);

    const out = { };
    out.agents = await Agent.countDocuments({ userId: req.user._id });
    out.deployedAgents = await Agent.countDocuments({ userId: req.user._id, deployed: true });
    out.maps = await Map.countDocuments({ userId: req.user._id });
    out.apps = await App.countDocuments({ userId: req.user._id });
    out.bridges = await Bridge.countDocuments({ userId: req.user._id });

    res.json(out);
  } catch (err) {
    error('Get dashboard error:', err)
    res.status(500).json({ result: 'error', message: err.toString() });
  }
})

export default router;
