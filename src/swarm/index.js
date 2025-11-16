import process from 'process';
import { inspect } from 'util'
import prom from 'prom-client'

import { log, warn, error, Verbose } from '../services.js'
import conf, { revealConf } from '../conf.js'
import MaptrixV1 from './maptrix-v1.js'
import SystemV1 from './system-v1.js'
import TransformV1 from './transform-v1.js'
import ProxyV1 from './proxy-v1.js'
import McpV1 from './mcp-v1.js'
import CurlV1 from './curl-v1.js'
import { sleep } from '../utils/helper.js'

import '../mongo.js'
import User from '../models/user.js'
import Agent from '../models/agent.js'
import { redisClient, connectToRedis } from '../redis.js'
import { replaceVaultValues } from '../vault.js'

const verbose = Verbose('sd:swarm/index'); verbose('')

log('public conf:', inspect(revealConf(), { colors: true, depth: null }))


const archetypeClasses = {
  "maptrix-v1.0": MaptrixV1,
  "system-v1.0": SystemV1,
  "transform-v1.0": TransformV1,
  "proxy-v1.0": ProxyV1,
  "mcp-v1.0": McpV1,
  "curl-v1.0": CurlV1,
}

const runningXmppAgents = {};


// TODO: Move to prometheus.js
//
// Configure Pushgateway
const { Pushgateway, register } = prom;
const promgw = new Pushgateway('http://pushgateway:9091');

// Create a counter metric
const m_agents_processed = new prom.Counter({
  name: 'agents_processed',
  help: 'Counts something important',
  labelNames: ['service']
});

const m_running_agents = new prom.Counter({
  name: 'running_agents',
  help: 'Counts something important',
  labelNames: ['service']
});


function isValid({ agent }) {
  return Boolean(
    agent.deployed &&
    agent.archetype in archetypeClasses &&
    (conf.swarm.filterArchetypes.length === 0 || conf.swarm.filterArchetypes.includes(agent.archetype))
  );
}

// ----------------- Distributed Lock -----------------
async function checkAndClearStaleLock(agentId) {
  verbose('checkAndClearStaleLock agentId:', agentId)
  if (!redisClient) return false;
  const lockKey = `agent_lock:${agentId}`;
  const heartbeatKey = `agent_heartbeat:${agentId}`;

  const lockOwner = await redisClient.get(lockKey);
  verbose('lockOwner:', lockOwner)
  if (!lockOwner) return true;

  const lastHeartbeat = await redisClient.get(heartbeatKey);
  verbose('lastHeartbeat:', lastHeartbeat)
  if (!lastHeartbeat || (Date.now() / 1000 - parseFloat(lastHeartbeat) > conf.swarm.lockTimeoutSeconds)) {
    warn(`Clearing stale lock for agent ${agentId}`);
    await redisClient.del(lockKey);
    await redisClient.del(heartbeatKey);
    return true;
  }
  return false;
}

async function acquireLock(agentId) {
  verbose('acquireLock agentId:', agentId)
  verbose('redisClient:', !!redisClient)
  if (!redisClient) {
    warn('Redis is disabled or not connected')
    return false;
  }
  const lockKey = `agent_lock:${agentId}`;
  const heartbeatKey = `agent_heartbeat:${agentId}`;

  const lockOwner = await redisClient.get(lockKey);
  verbose('lockOwner:', lockOwner)
  verbose('conf.contaier.id', conf.container.id)
  if (lockOwner === conf.container.id) {
    verbose('lockOwner === conf.container.id')
    await redisClient.set(heartbeatKey, String(Date.now() / 1000), 'EX', conf.swarm.lockTimeoutSeconds * 2);
    return true;
  }

  const lockCleared = await checkAndClearStaleLock(agentId);
  verbose('stale lockCleared')
  if (!lockCleared) return false;

  verbose('attempt to acquire lock')
  const acquired = await redisClient.set(lockKey, conf.container.id, 'NX', 'EX', conf.swarm.lockTimeoutSeconds);
  verbose('acquired:', acquired)
  if (acquired) {
    await redisClient.set(heartbeatKey, String(Date.now() / 1000), 'EX', conf.swarm.lockTimeoutSeconds * 2);
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
    if (lockOwner === conf.container.id) {
      await redisClient.expire(lockKey, conf.swarm.lockTimeoutSeconds);
      await redisClient.set(heartbeatKey, String(Date.now() / 1000), 'EX', conf.swarm.lockTimeoutSeconds * 2);
    } else {
      warn(`Lost lock for agent ${agentId}`);
      await stopAgent(agentId);
      clearInterval(interval);
    }
  }, conf.swarm.lockRefreshSeconds * 1000);
}

async function releaseLock(agentId) {
  if (!redisClient) return;
  const lockKey = `agent_lock:${agentId}`;
  const heartbeatKey = `agent_heartbeat:${agentId}`;
  const lockOwner = await redisClient.get(lockKey);
  if (lockOwner === conf.container.id) {
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

  const agentClass = archetypeClasses[agent.archetype]
  // verbose('agent.options (before vault):', inspect(agent.options, { depth: null, colors: true }))
  await replaceVaultValues({ obj: agent.options, userId: agent.userId._id })
  // verbose('agent.options (after vault):', inspect(agent.options, { depth: null, colors: true }))

  const xmppAgent = new agentClass({
    agent,
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
      archetype: {
        $in: conf.swarm.filterArchetypes.length > 0
          ? conf.swarm.filterArchetypes
          : Object.keys(archetypeClasses)
      }
    }).populate('userId').lean();
    log(`Retrieved ${agents.length} agent configurations`);

    const shouldRun = {};






    // Increment the counter
    m_agents_processed.inc({ service: 'node-app' }, agents?.length || 0);
    verbose('agents.length:', agents?.length || 0)
    verbose('send metrics to prometheus:', m_agents_processed)

    m_running_agents.inc({ service: 'node-app' }, runningXmppAgents?.length || 0);
    verbose('runningXmppAgents.length:', runningXmppAgents?.length || 0)
    verbose('send metrics to prometheus:', m_running_agents)

    // Push metrics to Pushgateway
    promgw.pushAdd({ jobName: 'nodejs-app' }, (err, resp, body) => {
      if (err) console.error('Push failed:', err);
      else console.log('Metrics pushed successfully');
    });





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
  async function cycleMonitorAgents() {
    try {
      log('cycleMonitorAgents');
      await syncAgents();
    } catch (e) {
      error(`Error in monitorAgents: ${e}`);
    }
  }

  cycleMonitorAgents()
  setInterval(cycleMonitorAgents, conf.swarm.monitorSeconds * 1000)
}

process.on('uncaughtException', (err) => {
  error('uncaughtException:', err)
})

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

    // await connectToRedis();

    log(`Starting swarm with container ID: ${conf.container.id}`);
    monitorAgents();
  } catch (e) {
    error(`Fatal error: ${e}`);
    await shutdown();
  }
})();
