import { Router } from 'express';
import axios from 'axios';
import * as tar from 'tar';
import { inspect } from 'util';

import { checkAuth } from '../middleware/check-auth.js';
import { Verbose, log, warn, error } from '../services.js';
import Map from '../models/map.js'
import Agent from '../models/agent.js'
import App from '../models/app.js'
import conf from '../conf.js'

const verbose = Verbose('sd:routes/apps'); verbose('');
const router = Router();

async function uninstallApp ({ app }) {
  if (app) {
    verbose('Deleting installed app: mapIds:', app.mapIds,
      ', agentIds:', app.agentIds, 'app._id:', app._id);

    // Delete maps
    if (app.mapIds && app.mapIds.length) {
      await Map.deleteMany({ _id: { $in: app.mapIds } });
      log(`Deleted ${app.mapIds.length} maps`);
    }

    // Delete agents
    if (app.agentIds && app.agentIds.length) {
      await Agent.deleteMany({ _id: { $in: app.agentIds } });
      log(`Deleted ${app.agentIds.length} agents`);
    }

    // Delete the app itself
    if (app._id) {
      await App.deleteOne({ _id: app._id });
      log(`Deleted app ${app._id}`);
    }
  }
}

router.post('/install', checkAuth, async (req, res, next) => {
  let app = null
  try {
    verbose('app install body:', req.body);
    const { appName } = req.body;

    // Split appName into package and version
    let [pkg, version] = appName.split('@');
    version = version || 'latest'; // default to 'latest' if no version provided

    // If version is "latest", fetch metadata to get the actual version number
    if (version === 'latest') {
      try {
        const metadataUrl = `${conf.apps.registryUrl}/${pkg}`;
        const metadataRes = await axios.get(metadataUrl);
        const metadata = metadataRes.data;
        if (!metadata['dist-tags'] || !metadata['dist-tags'].latest) {
          throw new Error(`Cannot determine latest version for package ${pkg}`);
        }
        version = metadata['dist-tags'].latest;
        verbose(`Resolved latest version of ${pkg} to ${version}`);
      } catch (err) {
        throw new Error(`Failed to fetch package metadata: ${err.message}`);
      }
    }

    const url = `${conf.apps.registryUrl}/${pkg}/-/${pkg}-${version}.tgz`;
    verbose(`Downloading package from: ${url}`);
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data);

    // Temporary object to collect extracted files
    const files = [];

    // Extract the .tgz archive in memory
    await tar.list({
      file: null,       // no file, we'll pass buffer via "sync" approach
      onentry: entry => {
        let content = '';
        entry.on('data', chunk => content += chunk.toString());
        entry.on('end', () => {
          files.push({
            path: entry.path,
            content
          });
        });
      },
      sync: false
    }).end(buffer);

    // Log all files
    verbose('Extracted files:', files.map(f => f.path));

    app = new App({
      userId: req.user._id
    });

    // Loop through extracted files and verbose content
    for (const file of files) {
      if (file.path.endsWith('.json')) {
        let data = null
        try {
          data = JSON.parse(file.content)
        } catch (err) {
          throw new Error(`Cannot parse json at ${file.path}: ${err.toString()}`)
        }

        if (file.path === 'package/package.json') {
          verbose(`package.json file: ${file.path}\nContent:\n${file.content}\n---`);
          app.package = data
        } else if (file.path.startsWith('package/maps/')) {
          verbose(`Map file: ${file.path}\nContent:\n${file.content}\n---`);
          const map = new Map({
            ...data,
            userId: req.user._id,
            appId: app._id,
          })
          await map.save()
          app.mapIds.push(map._id)
        } else if (file.path.startsWith('package/agents/')) {
          verbose(`Agent file: ${file.path}\nContent:\n${file.content}\n---`);
          const agent = new Agent({
            ...data,
            userId: req.user._id,
            appId: app._id,
          })
          await agent.save()
          app.agentIds.push(agent._id)
        } else {
          verbose(`Unknown JSON file: ${file.path}\nContent:\n${file.content}\n---`);
        }
      } else {
        verbose(`File: ${file.path}`);
      }
    }
    await app.save();

    const out = {
      result: 'ok',
      installed: files.map(f => f.path)
    };

    res.json(out);
  } catch (err) {
    error('App install error:', err, 'Incorrectly installed app will be uninstalled')
    uninstallApp({ app })
    res.status(500).json({ result: 'error', message: err.toString() });
  }
});

router.post('/uninstall', checkAuth, async (req, res, next) => {
  let app = null
  try {
    verbose('app uninstall body:', req.body);
    const { appId } = req.body;
    const app = await App.findOne({ _id: appId, userId: req.user._id })
    if (!app) {
      throw new Error('App is not found')
    }
    await uninstallApp({ app })
    const out = {
      result: 'ok',
      uninstalled: {
        app,
      }
    };
    res.json(out);
  } catch (err) {
    error('App install error:', err)
    warn('Incorrectly installed app will be uninstalled')
    res.status(500).json({ result: 'error', message: err.toString() });
  }
})

export default router;
