import { Router } from 'express';
import axios from 'axios';
import * as tar from 'tar';
import { inspect } from 'util';
import crypto from 'crypto';
import zlib from 'zlib';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml'
import nunjucks from 'nunjucks'
import _ from 'lodash'

import { checkAuth } from '../middleware/check-auth.js';
import { Verbose, log, warn, error } from '../services.js';
import User from '../models/user.js'
import Map from '../models/map.js'
import Agent from '../models/agent.js'
import App from '../models/app.js'
import { vaultClient } from '../vault.js'
import firefly, { getPoolByIdOrSymbol, decimalToToken, tokenToDecimal } from '../firefly.js'
import conf from '../conf.js'

const verbose = Verbose('sd:routes/apps'); verbose('');
const router = Router();

// async function installApp ({ userId, files, values = '' } = {}) {
//   const app = new App({
//     userId,
//   });

//   // Loop through extracted files and verbose content
//   for (const file of files) {
//     if (file.path.endsWith('.json')) {
//       if (file.path.startsWith('package/hyag/maps/._') ||
//           file.path.startsWith('package/hyag/agents/._')) {
//         verbose(`Skip hidden json file: ${file.path}`);
//         continue
//       }
//       let data = null
//       try {
//         data = JSON.parse(file.content)
//       } catch (err) {
//         throw new Error(`Cannot parse json at ${file.path}: ${err.toString()}`)
//       }

//       if (file.path === 'package/package.json') {
//         verbose(`package.json file: ${file.path}\nContent:\n${file.content}\n---`);
//         app.package = data
//       } else if (file.path.startsWith('package/hyag/maps/')) {
//         verbose(`Map file: ${file.path}\nContent:\n${file.content}\n---`);
//         const map = new Map({
//           ...data,
//           userId,
//           appId: app._id,
//         })
//         await map.save()
//         app.mapIds.push(map._id)
//       } else if (file.path.startsWith('package/hyag/agents/')) {
//         verbose(`Agent file: ${file.path}\nContent:\n${file.content}\n---`);
//         const agent = new Agent({
//           ...data,
//           userId,
//           appId: app._id,
//         })
//         await agent.save()
//         app.agentIds.push(agent._id)
//       } else {
//         verbose(`Unknown JSON file: ${file.path}\n---`);
//       }
//     } else if (file.path.endsWith('.yaml')) {
//       data = yaml.load(file.content)
//       // TODO: load yamls in a similar way as I loaded jsons above
//       //       Do not repeat yourself.
//       // load package/hyag/maps/*.yaml
//       // load package/hyag/agents/*.yaml
//     } else if (file.path.endsWith('.yaml.template')) {
//       // TODO: apply nunjucks to the template, then load as yamls
//       //       use lodash deep merge() to load values file from /package/values.yaml, /package/values.json and values that come as an argument to the function (can be in yaml or json format - you should detect), the argument values has the biggest weight
//       // load package/hyag/maps/*.yaml.template
//       // load package/hyag/agents/*.yaml.template
//     } else if (file.path.endsWith('.json.template')) {
//       // TODO: apply nunjucks to the template, then load as jsons
//       //       use lodash deep merge() to load values file from /package/values.yaml, /package/values.json and values that come as an argument to the function (can be in yaml or json format - you should detect)
//       // load package/hyag/maps/*.json.template
//       // load package/hyag/agents/*.json.template
//     } else {
//       verbose(`File: ${file.path}`);
//     }
//   }
//   await app.save();
//   return app
// }


nunjucks.configure({ autoescape: false })

async function installApp({ userId, files, packageJson, values = '' } = {}) {
  const app = new App({ userId })
  app.package = packageJson

  // ---- Helpers ----
  const verboseLog = (label, file, content) => verbose(`${label}: ${file}\nContent:\n${content}\n---`)

  const parseYamlOrJson = (text) => {
    try {
      return yaml.load(text)
    } catch {
      try {
        return JSON.parse(text)
      } catch {
        throw new Error('Invalid YAML/JSON values format')
      }
    }
  }

  const mergeValues = (base, overrides = {}) => _.merge({}, base, overrides)

  // Extract values from package
  const valuesFiles = files.filter(f => f.path === 'package/values.yaml' || f.path === 'package/values.json')
  let baseValues = {}
  for (const vf of valuesFiles) {
    try {
      const parsed = parseYamlOrJson(vf.content)
      baseValues = mergeValues(baseValues, parsed)
    } catch (err) {
      throw new Error(`Failed to parse ${vf.path}: ${err.toString()}`)
    }
  }

  // Parse provided values argument (highest priority)
  let inputValues = {}
  if (values && typeof values === 'string') {
    inputValues = parseYamlOrJson(values)
  } else if (typeof values === 'object') {
    inputValues = values
  }

  const mergedValues = mergeValues(baseValues, inputValues)

  // ---- Reusable loader for YAML/JSON and templates ----
  const loadData = ({ file, isTemplate = false, isYaml = true }) => {
    try {
      const content = isTemplate
        ? nunjucks.renderString(String(file.content), mergedValues)
        : file.content
      return isYaml ? yaml.load(content) : JSON.parse(content)
    } catch (err) {
      throw new Error(`Error parsing ${file.path}: ${err.toString()}`)
    }
  }

  // ---- Save entity helper ----
  const saveEntity = async (Model, data, label) => {
    const entity = new Model({
      ...data,
      userId,
      appId: app._id
    })
    await entity.save()
    app[`${label}Ids`].push(entity._id)
  }

  // ---- Process files ----
  for (const file of files) {
    const { path } = file

    // Skip hidden macOS files
    if (path.startsWith('package/hyag/maps/._') || path.startsWith('package/hyag/agents/._')) {
      verbose(`Skip hidden file: ${path}`)
      continue
    }

    // --- JSON templates ---
    if (path.endsWith('.template.json')) {
      const data = loadData({ file, isTemplate: true, isYaml: false })
      if (path.startsWith('package/hyag/maps/')) {
        verboseLog('Map JSON template', path, file.content)
        await saveEntity(Map, data, 'map')
      } else if (path.startsWith('package/hyag/agents/')) {
        verboseLog('Agent JSON template', path, file.content)
        await saveEntity(Agent, data, 'agent')
      }

    // --- YAML templates ---
    } else if (path.endsWith('.template.yaml')) {
      const data = loadData({ file, isTemplate: true, isYaml: true })
      if (path.startsWith('package/hyag/maps/')) {
        verboseLog('Map YAML template', path, file.content)
        await saveEntity(Map, data, 'map')
      } else if (path.startsWith('package/hyag/agents/')) {
        verboseLog('Agent YAML template', path, file.content)
        await saveEntity(Agent, data, 'agent')
      }

    // --- Plain JSON files ---
    } else if (path.endsWith('.json')) {
      const data = loadData({ file, isTemplate: false, isYaml: false })
      if (path.startsWith('package/hyag/maps/')) {
        verboseLog('Map file', path, file.content)
        await saveEntity(Map, data, 'map')
      } else if (path.startsWith('package/hyag/agents/')) {
        verboseLog('Agent file', path, file.content)
        await saveEntity(Agent, data, 'agent')
      } else {
        verbose(`Unknown JSON file: ${path}`)
      }

    // --- Plain YAML files ---
    } else if (path.endsWith('.yaml')) {
      const data = loadData({ file, isTemplate: false, isYaml: true })
      if (path.startsWith('package/hyag/maps/')) {
        verboseLog('Map YAML file', path, file.content)
        await saveEntity(Map, data, 'map')
      } else if (path.startsWith('package/hyag/agents/')) {
        verboseLog('Agent YAML file', path, file.content)
        await saveEntity(Agent, data, 'agent')
      }

    // --- Other files ---
    } else {
      verbose(`File: ${path}`)
    }
  }

  await app.save()
  return app
}


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

async function retrievePackage({ appName }) {
  try {
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
        error(`Failed to fetch package metadata: ${err.message}`);
        throw new Error(`Package not found`);
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
      file: null,
      onentry: entry => {
        const chunks = [];
        entry.on('data', chunk => chunks.push(chunk));
        entry.on('end', () => {
          files.push({
            path: entry.path,
            content: Buffer.concat(chunks) // store as Buffer
          });
        });
      },
      sync: false
    }).end(buffer);

    // Log all files
    verbose('Extracted files:', files.map(f => f.path));
    return files

  } catch (err) {
    warn('Retrieving package error:', err)
    throw err
  }
}

function parsePackageJson ({ files }) {
  let packageJson = null
  // Loop through extracted files and verbose content
  for (const file of files) {
    if (file.path === 'package/package.json') {
      try {
        packageJson = JSON.parse(file.content)
      } catch (err) {
        throw new Error(`Cannot parse json at ${file.path}: ${err.toString()}`)
      }
      verbose(`package.json file: ${file.path}\nContent:\n${file.content}\n---`);
    }
  }
  return packageJson
}

router.post('/search', checkAuth, async (req, res, next) => {
  let app = null
  try {
    verbose('app search body:', req.body);
    const { appName } = req.body;
    if (!appName) {
      return res.json([]);
    }

    // TODO: make search by the partial name
    const files = await retrievePackage({ appName })

    const candidates = []
    const packageJson = parsePackageJson({ files })
    if (packageJson) {
      const { purchased } = await checkOwnership({ user: req.user, packageName: packageJson.name })

      const installed = await App.findOne({ 'package.name': packageJson.name })
      candidates.push({
        package: packageJson,
        purchased,
        installed,
      })
    }
    res.json(candidates);
  } catch (err) {
    error('App search error:', err)
    res.status(500).json({ result: 'error', message: err.toString() });
  }
});


// Helper function: decrypt AES-256-CBC with PBKDF2 (OpenSSL compatible)
async function decryptFile(buffer, vaultKeyValue) {
  // OpenSSL "Salted__" header format
  const saltHeader = buffer.slice(0, 8).toString();
  if (saltHeader !== 'Salted__') {
    throw new Error('Missing OpenSSL Salted__ header');
  }

  const salt = buffer.slice(8, 16);
  const ciphertext = buffer.slice(16);

  // Derive key and IV with PBKDF2 (100000 iterations)
  const keyiv = crypto.pbkdf2Sync(vaultKeyValue, salt, 100000, 48, 'sha256');
  const key = keyiv.slice(0, 32);
  const iv = keyiv.slice(32, 48);

  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted;
}

// Helper: extract .tar.gz from buffer
async function extractTarGz(buffer, pathPrefix = '') {
  return new Promise((resolve, reject) => {
    const files = [];
    const extract = tar.t();

    extract.on('entry', (entry) => {
      let content = '';
      entry.on('data', (chunk) => (content += chunk.toString()));
      entry.on('end', () => {
        files.push({ path: `${pathPrefix}${entry.path}`, content });
      });
    });

    extract.on('finish', () => resolve(files));
    extract.on('error', reject);

    const gunzip = zlib.createGunzip();
    gunzip.on('error', reject);
    gunzip.end(buffer);

    gunzip.pipe(extract);
  });
}

async function decryptAndExtract({ files, vaultKeyValue }) {
  for (const file of files) {
    if (file.path.endsWith('.enc')) {
      try {
        verbose(`Found encrypted file: ${file.path}, decrypting...`);
        const encBuffer = Buffer.isBuffer(file.content)
          ? file.content
          : Buffer.from(file.content, 'binary');

        const decrypted = await decryptFile(encBuffer, vaultKeyValue);

        if (file.path.endsWith('.tar.gz.enc')) {
          verbose(`Decrypting and extracting ${file.path}...`);
          const extracted = await extractTarGz(decrypted, 'package/');
          verbose(`Extracted ${extracted.length} files from decrypted archive`);
          files.push(...extracted);
        } else {
          verbose(`Decrypted non-archive file: ${file.path}`);
          files.push({
            path: file.path.replace('.enc', ''),
            content: decrypted.toString()
          });
        }
      } catch (err) {
        warn(`Failed to decrypt ${file.path}:`, err);
      }
    }
  }
  verbose('Decrypted files:', files.map(f => f.path));
}

async function getValueFromVault({ userId, vaultKey }) {
  if (!vaultClient) {
    throw new Error('Vault is disabled on backend')
  }
  const result = await vaultClient.read(`secret/data/user_${userId}`);
  const data = result.data.data; // KV v2 nests data under data.data
  if (!vaultKey in data) {
    return undefined
  }
  return data[vaultKey]
}

async function getVaultKeyValue({ seller }) {
  const { vaultKey, address } = seller
  const sellerUser = await User.findOne({ 'firefly.address': seller.address })
  if (!sellerUser) {
    throw new Error(`Cannot find the seller with specified address`)
  }
  verbose('sellerUser:', sellerUser)
  const vaultKeyValue = await getValueFromVault({
    userId: sellerUser._id.toString(),
    vaultKey: seller.vaultKey,
  })
  // verbose('vaultKey:', vaultKey, '=', vaultKeyValue)
  if (!vaultKeyValue) {
    throw new Error(`Error getting the key ${seller.vaultKey} from the seller\'s vault. The key might be revoked or rotated. Please, contact the seller.`)
  }
  return vaultKeyValue
}

async function checkOwnership({ user, packageName }) {
  const purchasePool = await getPoolByIdOrSymbol({ symbol: conf.firefly.purchaseSymbol })
  if (!purchasePool) {
    throw new Error(`Cannot find the token pool by the purchaseSymbol: ${conf.firefly.purchaseSymbol}`)
  }
  const uri = `${conf.firefly.purchaseProto}://${packageName}`
  const balances = await firefly.getTokenBalances({
    key: user.firefly.address,
  })
  verbose('balances:', balances)
  // Check the token
  const purchased = balances.find(b => (
    b.uri === uri && b.pool === purchasePool.id && b.balance === '1'
  ))
  verbose('purchased:', purchased)
  return { purchased, purchasePool, balances, uri }
}

async function purchaseUnlessOwned({ user, packageJson, seller }) {
  let transferred = null
  let minted = null

  const { purchased, purchasePool, uri } = await checkOwnership({
    user,
    packageName: packageJson.name
  })

  if (purchased) {
    log('User has already purchased the app:', uri, 'Skipping transfer')
  } else {
    log('User is purchasing the app:', uri)
    const pricing = packageJson['x-hyag']?.pricing
    if (seller && seller.address &&
        pricing && pricing.symbol && pricing.price) {
      const foundPool = await getPoolByIdOrSymbol({ symbol: pricing.symbol })
      // verbose('foundPool:', foundPool)
      if (!foundPool) {
        throw new Error(`Cannot find the token pool by the symbol: ${pricing.symbol}`)
      }
      const { id: pool, type, decimals } = foundPool
      const transferData = {
        pool,
        to: seller.address,
        from: user.firefly.address,
        key: user.firefly.address, // from and key are the same, no need the approval
        tokenIndex: pricing.tokenIndex,
        amount: type === 'fungible' ? decimalToToken(pricing.price, decimals) : pricing.price,
      }
      log('Transferring payment for purchasing the app:',
        `${packageJson.name}@${packageJson.version}`,
        ', transferData:', transferData)
      transferred = await firefly.transferTokens(transferData);
    }

    const mintData = {
      pool: purchasePool.id,
      amount: '1',
      uri,
      to: user.firefly.address,
      key: conf.firefly.orgAddress,
    }
    minted = await firefly.mintTokens(mintData);
    log('Minted purchase license token:', mintData, ', minted:', minted)
  }

  return { transferred, minted }
}

router.post('/install', checkAuth, async (req, res, next) => {
  let app = null
  try {
    verbose('app install body:', req.body);
    const { appName } = req.body;

    const files = await retrievePackage({ appName })

    const packageJson = parsePackageJson({ files })
    if (!packageJson) {
      throw new Error('Error getting values from package.json')
    }

    const seller = packageJson['x-hyag']?.seller
    if (seller && seller.address && seller.vaultKey) {
      const vaultKeyValue = await getVaultKeyValue({ seller })
      await decryptAndExtract({ files, vaultKeyValue })
    }

    app = await installApp({ userId: req.user._id, files, packageJson })

    let transferred = null, minted = null
    if (seller) {
      ({ transferred, minted } = await purchaseUnlessOwned({
        user: req.user,
        packageJson,
        seller,
      }))
    }

    const out = {
      result: 'ok',
      installed: files.map(f => f.path),
      transferred,
      minted,
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
