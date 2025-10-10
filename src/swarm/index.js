import dotenv from 'dotenv';
import Redis from 'ioredis';
// import vault from 'node-vault';
import { randomUUID } from 'crypto';
// import { setTimeout as sleep } from 'timers/promises';
import process from 'process';
// import { Box } from 'box-node';


import { inspect } from 'util'
// import axios from 'axios'
// import { v4 as uuidv4 } from 'uuid'
// import { transporter } from '../mailer.js'
// import lodash from 'lodash'
// const { isEmpty, has } = lodash

import { log, warn, error, Verbose } from '../services.js'
import conf, { revealConf } from '../conf.js'
import MaptrixV1 from './maptrix_v1.js'
import { sleep } from '../utils/helper.js'

// Connect to MongoDB through Mongoose driver
import '../mongo.js'  // FIXME: use it?
import '../redis.js'  // FIXME: Remove file or move there all the redis code?
import User from '../models/user.js'
import Agent from '../models/agent.js'

const verbose = Verbose('sd:swarm/index'); verbose('')

log('public conf:', inspect(revealConf(), { colors: true, depth: null }))

// FIXME: Replace dotenv with conf completelly
dotenv.config();

// // ----------------- Configuration -----------------
// const DB_URL = process.env.DB_URL || 'mongodb://mongo.dev.local:27017/selfdev';
// const XMPP_HOST = process.env.XMPP_HOST || 'selfdev-prosody.dev.local';
// const XMPP_PASSWORD = process.env.XMPP_PASSWORD || '123';
// const XMPP_MUC_HOST = process.env.XMPP_MUC_HOST || `conference.${XMPP_HOST}`;
const MONITOR_SECONDS = parseInt(process.env.MONITOR_SECONDS || '60', 10);

const REDIS_URL = process.env.REDIS_URL || 'redis://redis.dev.local:6379/0';
const REDIS_SOCKET_TIMEOUT = parseInt(process.env.REDIS_SOCKET_TIMEOUT || '10', 10) * 1000;
const REDIS_CONNECT_TIMEOUT = parseInt(process.env.REDIS_CONNECT_TIMEOUT || '15', 10) * 1000;
const LOCK_TIMEOUT = parseInt(process.env.LOCK_TIMEOUT || '120', 10);
const LOCK_REFRESH = parseInt(process.env.LOCK_REFRESH || '30', 10);

const CONTAINER_ID = process.env.CONTAINER_ID || process.env.HOSTNAME || randomUUID();
const FILTER_ARCHETYPES = JSON.parse(process.env.FILTER_ARCHETYPES || '[ "maptrix-v1.0" ]');

// const VAULT_ENABLE = (process.env.VAULT_ENABLE || 'false') === 'true';
// const VAULT_ADDR = process.env.VAULT_ADDR || 'http://127.0.0.1:8200';
// const VAULT_TOKEN = process.env.VAULT_TOKEN || '(not-set)';
// const VAULT_UNSEAL = (process.env.VAULT_UNSEAL || 'false') === 'true';
// const VAULT_UNSEAL_KEYS = (process.env.VAULT_UNSEAL_KEYS || '(not-set),(not-set),(not-set),(not-set),(not-set)').split(',');

// // ----------------- Globals -----------------
let redisClient = null;
// let vaultClient = null;
const runningXmppAgents = {};

// // ----------------- Agent Config -----------------
// class AgentConfig {
//   constructor(doc, user) {
//     this.doc = doc;
//     this.user = user;
//     this.id = String(doc._id);
//     this.userId = String(doc.userId);
//     this.deployed = doc.deployed || false;
//     this.archetype = doc.archetype || null;

//     // FIXME: does this replacement work?
//     // this.options = new Box(doc.options || {});
//     this.options = doc.options

//     // this.updatedAt = doc.updatedAt || null;
//     this.name = this.options.name;
//     this.joinRooms = this.options.joinRooms;

//     // FIXME: uncomment
//     // this.replaceVaultValues(this.options);
//   }

//   isValid() {
//     return Boolean(
//       this.deployed &&
//       this.name &&
//       (FILTER_ARCHETYPES.length === 0 || FILTER_ARCHETYPES.includes(this.archetype))
//     );
//   }

//   // getVaultValue(vaultKey) {
//   //   if (!vaultClient) return '';
//   //   try {
//   //     const secret = vaultClient.read(`secret/data/user_${this.userId}`);
//   //     return secret?.data?.data?.[vaultKey] || '';
//   //   } catch (e) {
//   //     error(`Error reading secret ${vaultKey} from Vault for user_${this.userId}: ${e}`);
//   //     return null;
//   //   }
//   // }

//   // replaceVaultValues(obj) {
//   //   if (!vaultClient) return;

//   //   if (obj instanceof Box || typeof obj === 'object') {
//   //     for (const [key, value] of Object.entries(obj)) {
//   //       if (value && typeof value === 'object' && 'valueFromVault' in value) {
//   //         obj[key] = this.getVaultValue(value.valueFromVault);
//   //       } else {
//   //         this.replaceVaultValues(value);
//   //       }
//   //     }
//   //   } else if (Array.isArray(obj)) {
//   //     for (const item of obj) {
//   //       this.replaceVaultValues(item);
//   //     }
//   //   }
//   // }
// }

function isValid({ agent }) {
  return Boolean(
    agent.deployed &&
    (FILTER_ARCHETYPES.length === 0 || FILTER_ARCHETYPES.includes(agent.archetype))
  );
}

// ----------------- Redis -----------------
async function connectToRedis() {
  redisClient = new Redis(REDIS_URL, {
    connectTimeout: REDIS_CONNECT_TIMEOUT
  });
  await redisClient.ping();
  log(`Connected to Redis at ${REDIS_URL}`);
}

// // ----------------- Vault -----------------
// async function connectToVault(retries = 20, baseDelay = 1000, maxDelay = 60000) {
//   if (!VAULT_ENABLE) {
//     warn('Vault is disabled.');
//     return;
//   }

//   vaultClient = vault({ endpoint: VAULT_ADDR, token: VAULT_TOKEN });

//   for (let attempt = 1; attempt <= retries; attempt++) {
//     try {
//       if (VAULT_UNSEAL) {
//         const isSealed = await vaultClient.sys.isSealed();
//         if (isSealed) {
//           for (const key of VAULT_UNSEAL_KEYS) {
//             if (!key || key.trim() === '(not-set)') continue;
//             await vaultClient.sys.submitUnsealKey(key.trim());
//           }
//         }
//       }
//       return vaultClient;
//     } catch (e) {
//       const delay = Math.min(baseDelay * 2 ** (attempt - 1), maxDelay);
//       const jitter = Math.random() + 0.5;
//       const adaptiveDelay = delay * jitter;
//       warn(`Attempt ${attempt}: Vault connection failed. Retrying in ${adaptiveDelay}ms`);
//       await sleep(adaptiveDelay);
//     }
//   }
//   throw new Error('Failed to authenticate with Vault after multiple attempts.');
// }

// ----------------- Distributed Lock -----------------
async function checkAndClearStaleLock(agentId) {
  if (!redisClient) return false;
  const lockKey = `agent_lock:${agentId}`;
  const heartbeatKey = `agent_heartbeat:${agentId}`;

  const lockOwner = await redisClient.get(lockKey);
  if (!lockOwner) return true;

  const lastHeartbeat = await redisClient.get(heartbeatKey);
  if (!lastHeartbeat || (Date.now() / 1000 - parseFloat(lastHeartbeat) > LOCK_TIMEOUT)) {
    warn(`Clearing stale lock for agent ${agentId}`);
    await redisClient.del(lockKey);
    await redisClient.del(heartbeatKey);
    return true;
  }
  return false;
}

async function acquireLock(agentId) {
  if (!redisClient) return false;
  const lockKey = `agent_lock:${agentId}`;
  const heartbeatKey = `agent_heartbeat:${agentId}`;

  const lockOwner = await redisClient.get(lockKey);
  if (lockOwner === CONTAINER_ID) {
    await redisClient.set(heartbeatKey, String(Date.now() / 1000), 'EX', LOCK_TIMEOUT * 2);
    return true;
  }

  const lockCleared = await checkAndClearStaleLock(agentId);
  if (!lockCleared) return false;

  const acquired = await redisClient.set(lockKey, CONTAINER_ID, 'NX', 'EX', LOCK_TIMEOUT);
  if (acquired) {
    await redisClient.set(heartbeatKey, String(Date.now() / 1000), 'EX', LOCK_TIMEOUT * 2);
    refreshLock(agentId);
    log(`Acquired lock for agent ${agentId}`);
    return true;
  }
  return false;
}

function refreshLock(agentId) {
  const interval = setInterval(async () => {
    if (!(agentId in runningXmppAgents)) {
      clearInterval(interval);
      return;
    }
    const lockKey = `agent_lock:${agentId}`;
    const heartbeatKey = `agent_heartbeat:${agentId}`;
    const lockOwner = await redisClient.get(lockKey);
    if (lockOwner === CONTAINER_ID) {
      await redisClient.expire(lockKey, LOCK_TIMEOUT);
      await redisClient.set(heartbeatKey, String(Date.now() / 1000), 'EX', LOCK_TIMEOUT * 2);
    } else {
      warn(`Lost lock for agent ${agentId}`);
      await stopAgent(agentId);
      clearInterval(interval);
    }
  }, LOCK_REFRESH * 1000);
}

async function releaseLock(agentId) {
  if (!redisClient) return;
  const lockKey = `agent_lock:${agentId}`;
  const heartbeatKey = `agent_heartbeat:${agentId}`;
  const lockOwner = await redisClient.get(lockKey);
  if (lockOwner === CONTAINER_ID) {
    await redisClient.del(lockKey);
    await redisClient.del(heartbeatKey);
    log(`Released lock for agent ${agentId}`);
  }
}

// ----------------- Agent Management -----------------
async function startAgent({ agent }) {
  if (!isValid({ agent })) {
    warn(`Invalid agent configuration: ${agent._id}:${agent.options.name}`);
    return null;
  }

  const lockAcquired = await acquireLock(agent._id);
  if (!lockAcquired) {
    log(`Agent ${agent._id}:${agent.options.name} is already running in another container`);
    return null;
  }

  const xmppAgent = new MaptrixV1({
    agent,

    // FIXME: implement
    //   host: XMPP_HOST,
    //   user: config.name,
    //   password: XMPP_PASSWORD,
    //   mucHost: XMPP_MUC_HOST,
    //   joinRooms: config.joinRooms,
    //   nick: config.name,
    //   config: config,
    //   ownername: (config.user?.xmpp?.user || '').toLowerCase(),
    //   customerId: config.user?.stripe?.customerId
  });
  runningXmppAgents[agent._id] = xmppAgent;
  xmppAgent.start(); // Assuming MaptrixV1 has async start()

  log(`Started agent: ${agent._id}:${agent.options.name}`);
  return xmppAgent;
}

async function stopAgent({ agentId }) {
  if (agentId in runningXmppAgents) {
    try {
      const xmppAgent = runningXmppAgents[agentId];
      await xmppAgent.stop();
      delete runningXmppAgents[agentId];

      log(`Stopped agent: ${agentId}`);
      await releaseLock(agentId);
    } catch (e) {
      error(`Error stopping agent ${agentId}: ${e}`);
    }
  }
}

// ----------------- Sync and Monitor -----------------
async function syncAgents() {
  try {
    const agents = await Agent.find({
      archetype: { $in: FILTER_ARCHETYPES }
    }).populate('userId').lean();
    log(`Retrieved ${agents.length} agent configurations`);

    const shouldRun = {};

    for (const agent of agents) {
      // verbose('agent:', agent, ', isValid:', isValid({ agent }))
      if (isValid({ agent })) {
        shouldRun[agent._id] = agent;

        if (!(agent._id in runningXmppAgents)) {
          verbose('start agent')
          await startAgent({ agent });
        } else {
          verbose('agent.updatedAt:', agent.updatedAt)
          // verbose('runningXmppAgent:', runningXmppAgents[agent._id])
          verbose('runningXmppAgent updatedAt:', runningXmppAgents[agent._id].agent.updatedAt)
          if (new Date(agent.updatedAt).getTime() !==
              new Date(runningXmppAgents[agent._id].agent.updatedAt).getTime()) {
            verbose('restart agent')
            await stopAgent({ agentId: agent._id });
            await startAgent({ agent });
          }
        }
      }
    }

    for (const agentId of Object.keys(runningXmppAgents)) {
      if (!(agentId in shouldRun)) {
        verbose('stop agent')
        await stopAgent({ agentId });
      }
    }
  } catch (err) {
    error('Error syncing agents:', err)
  }
}

function monitorAgents() {
  setInterval(async () => {
    try {
      log('Iterate monitorAgents')
      await syncAgents();
    } catch (e) {
      error(`Error in monitorAgents: ${e}`);
    }
  }, MONITOR_SECONDS * 1000);
}

// ----------------- Shutdown -----------------
async function shutdown() {
  log('Shutting down agency...');
  for (const agentId of Object.keys(runningXmppAgents)) {
    await stopAgent({ agentId });
  }
  if (redisClient) await redisClient.quit();
  log('Shutdown complete');
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// ----------------- Main -----------------
(async () => {
  try {
    const sleepTime = Math.random() * 3; // up to 3 seconds random sleep
    log(`Sleeping for ${sleepTime.toFixed(3)} seconds`);
    await sleep(sleepTime * 1000);

    // await mongoose.connect(DB_URL);
    // log(`Connected to MongoDB at ${DB_URL}`);

    // FIXME: move to redis.js?
    await connectToRedis();
    // await connectToVault();

    log(`Starting swarm with container ID: ${CONTAINER_ID}`);
    monitorAgents();
  } catch (e) {
    error(`Fatal error: ${e}`);
    await shutdown();
  }
})();
