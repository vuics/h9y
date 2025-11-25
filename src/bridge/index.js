import process from 'process';
import { inspect } from 'util'

import { log, warn, error, Verbose } from '../services.js'
import conf, { revealConf } from '../conf.js'
import { sleep } from '../utils/helper.js'
import '../mongo.js'
import User from '../models/user.js'
import Bridge from '../models/bridge.js'
import { redisClient, connectToRedis } from '../redis.js'
import { replaceVaultValues } from '../vault.js'

import Messengers from './messengers.js'
import Phone from './phone.js'
import Scheduler from './scheduler.js'
import Webhook from './webhook.js'
import Email from './email.js'
import Mcp from './mcp.js'
import Webapp from './webapp.js'
import A2a from './a2a.js'

const verbose = Verbose('sd:bridge/index'); verbose('')

log('public conf:', inspect(revealConf(), { colors: true, depth: null }))


const connectorClasses = {
  "messengers": Messengers,
  "phone": Phone,
  "scheduler": Scheduler,
  "webhook": Webhook,
  "email": Email,
  "mcp": Mcp,
  "webapp": Webapp,
  "a2a": A2a,
}

const runningConnectorBridges = {};

function isValid({ bridge }) {
  return Boolean(
    bridge.deployed &&
    bridge.connector in connectorClasses &&
    (conf.bridge.filterConnectors.length === 0 || conf.bridge.filterConnectors.includes(bridge.connector))
  );
}

// ----------------- Distributed Lock -----------------
async function checkAndClearStaleLock(bridgeId) {
  verbose('checkAndClearStaleLock bridgeId:', bridgeId)
  if (!redisClient) return false;
  const lockKey = `bridge_lock:${bridgeId}`;
  const heartbeatKey = `bridge_heartbeat:${bridgeId}`;

  const lockOwner = await redisClient.get(lockKey);
  verbose('lockOwner:', lockOwner)
  if (!lockOwner) return true;

  const lastHeartbeat = await redisClient.get(heartbeatKey);
  verbose('lastHeartbeat:', lastHeartbeat)
  if (!lastHeartbeat || (Date.now() / 1000 - parseFloat(lastHeartbeat) > conf.bridge.lockTimeoutSeconds)) {
    warn(`Clearing stale lock for bridge ${bridgeId}`);
    await redisClient.del(lockKey);
    await redisClient.del(heartbeatKey);
    return true;
  }
  return false;
}

async function acquireLock(bridgeId) {
  verbose('acquireLock bridgeId:', bridgeId)
  verbose('redisClient:', !!redisClient)
  if (!redisClient) {
    warn('Redis is disabled or not connected')
    return false;
  }
  const lockKey = `bridge_lock:${bridgeId}`;
  const heartbeatKey = `bridge_heartbeat:${bridgeId}`;

  const lockOwner = await redisClient.get(lockKey);
  verbose('lockOwner:', lockOwner)
  verbose('conf.contaier.id', conf.container.id)
  if (lockOwner === conf.container.id) {
    verbose('lockOwner === conf.container.id')
    await redisClient.set(heartbeatKey, String(Date.now() / 1000), 'EX', conf.bridge.lockTimeoutSeconds * 2);
    return true;
  }

  const lockCleared = await checkAndClearStaleLock(bridgeId);
  verbose('stale lockCleared')
  if (!lockCleared) return false;

  verbose('attempt to acquire lock')
  const acquired = await redisClient.set(lockKey, conf.container.id, 'NX', 'EX', conf.bridge.lockTimeoutSeconds);
  verbose('acquired:', acquired)
  if (acquired) {
    await redisClient.set(heartbeatKey, String(Date.now() / 1000), 'EX', conf.bridge.lockTimeoutSeconds * 2);
    refreshLock(bridgeId);
    log(`Acquired lock for bridge ${bridgeId}`);
    return true;
  }
  return false;
}

function refreshLock(bridgeId) {
  const interval = setInterval(async () => {
    if (!(bridgeId in runningConnectorBridges)) {
      clearInterval(interval);
      return;
    }
    const lockKey = `bridge_lock:${bridgeId}`;
    const heartbeatKey = `bridge_heartbeat:${bridgeId}`;
    const lockOwner = await redisClient.get(lockKey);
    if (lockOwner === conf.container.id) {
      await redisClient.expire(lockKey, conf.bridge.lockTimeoutSeconds);
      await redisClient.set(heartbeatKey, String(Date.now() / 1000), 'EX', conf.bridge.lockTimeoutSeconds * 2);
    } else {
      warn(`Lost lock for bridge ${bridgeId}`);
      await stopBridge(bridgeId);
      clearInterval(interval);
    }
  }, conf.bridge.lockRefreshSeconds * 1000);
}

async function releaseLock(bridgeId) {
  if (!redisClient) return;
  const lockKey = `bridge_lock:${bridgeId}`;
  const heartbeatKey = `bridge_heartbeat:${bridgeId}`;
  const lockOwner = await redisClient.get(lockKey);
  if (lockOwner === conf.container.id) {
    await redisClient.del(lockKey);
    await redisClient.del(heartbeatKey);
    log(`Released lock for bridge ${bridgeId}`);
  }
}

// ----------------- Bridge Management -----------------
async function startBridge({ bridge }) {
  if (!isValid({ bridge })) {
    warn(`Invalid bridge configuration: ${bridge._id}:${bridge.options.name}`);
    return null;
  }

  const lockAcquired = await acquireLock(bridge._id);
  if (!lockAcquired) {
    log(`Bridge ${bridge._id}:${bridge.options.name} is already running in another container`);
    return null;
  }

  const bridgeClass = connectorClasses[bridge.connector]
  // verbose('bridge.options (before vault):', inspect(bridge.options, { depth: null, colors: true }))
  await replaceVaultValues({ obj: bridge.options, userId: bridge.userId._id })
  // verbose('bridge.options (after vault):', inspect(bridge.options, { depth: null, colors: true }))

  const xmppBridge = new bridgeClass({
    bridge,
  });
  runningConnectorBridges[bridge._id] = xmppBridge;
  xmppBridge.start(); // Assuming MaptrixV1 has async start()

  log(`Started bridge: ${bridge._id}:${bridge.options.name}`);
  return xmppBridge;
}

async function stopBridge({ bridgeId }) {
  if (bridgeId in runningConnectorBridges) {
    try {
      const xmppBridge = runningConnectorBridges[bridgeId];
      await xmppBridge.stop();
      delete runningConnectorBridges[bridgeId];

      log(`Stopped bridge: ${bridgeId}`);
      await releaseLock(bridgeId);
    } catch (e) {
      error(`Error stopping bridge ${bridgeId}: ${e}`);
    }
  }
}

// ----------------- Sync and Monitor -----------------
async function syncBridges() {
  try {
    // verbose('connectorClasses:', connectorClasses)
    const bridges = await Bridge.find({
      connector: {
        $in: conf.bridge.filterConnectors.length > 0
          ? conf.bridge.filterConnectors
          : Object.keys(connectorClasses)
      }
    }).populate('userId').lean();
    log(`Retrieved ${bridges.length} bridge configurations`);

    const shouldRun = {};

    for (const bridge of bridges) {
      // verbose('bridge:', bridge, ', isValid:', isValid({ bridge }))
      if (isValid({ bridge })) {
        shouldRun[bridge._id] = bridge;

        if (!(bridge._id in runningConnectorBridges)) {
          verbose('start bridge')
          await startBridge({ bridge });
        } else {
          verbose('bridge.updatedAt:', bridge.updatedAt)
          // verbose('runningConnectorBridge:', runningConnectorBridges[bridge._id])
          verbose('runningConnectorBridge updatedAt:', runningConnectorBridges[bridge._id].bridge.updatedAt)
          if (new Date(bridge.updatedAt).getTime() !==
              new Date(runningConnectorBridges[bridge._id].bridge.updatedAt).getTime()) {
            verbose('restart bridge')
            await stopBridge({ bridgeId: bridge._id });
            await startBridge({ bridge });
          }
        }
      }
    }

    for (const bridgeId of Object.keys(runningConnectorBridges)) {
      if (!(bridgeId in shouldRun)) {
        verbose('stop bridge')
        await stopBridge({ bridgeId });
      }
    }
  } catch (err) {
    error('Error syncing bridges:', err)
  }
}

function monitorBridges() {
  async function cycleMonitorBridges() {
    try {
      log('cycleMonitorBridges');
      await syncBridges();
    } catch (e) {
      error(`Error in monitorBridges: ${e}`);
    }
  }

  cycleMonitorBridges()
  setInterval(cycleMonitorBridges, conf.bridge.monitorSeconds * 1000)
}

process.on('uncaughtException', (err) => {
  error('uncaughtException:', err)
})

// ----------------- Shutdown -----------------
async function shutdown() {
  log('Shutting down agency...');
  for (const bridgeId of Object.keys(runningConnectorBridges)) {
    await stopBridge({ bridgeId });
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

    // await connectToRedis();

    log(`Starting bridge with container ID: ${conf.container.id}`);
    monitorBridges();
  } catch (e) {
    error(`Fatal error: ${e}`);
    await shutdown();
  }
})();
