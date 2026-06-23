import process from 'process';
import { inspect } from 'util'

import { log, warn, error, Verbose } from '../services.js'
import conf, { revealConf } from '../conf.js'
import { sleep } from '../utils/helper.js'

import '../mongo.js'
import User from '../models/user.js'
import Agent from '../models/agent.js'
import { redisClient, connectToRedis } from '../redis.js'
import { replaceVaultValues } from '../vault.js'
import prometheus from '../prometheus.js'
import { offsetTime } from '../utils/datetime.js'


const verbose = Verbose('sd:swarm/core');
verbose('');

log('public conf:', inspect(revealConf(), { colors: true, depth: null }));

export function createSwarm({ archetypeClasses, service = 'swarm' }) {
  const runningXmppAgents = {};

  // Create a counter metric
  const g_agents_processed = new prometheus.Gauge({
    name: 'g_agents_processed',
    help: 'How many agents were processed',
    labelNames: ['service']
  });

  const g_running_agents = new prometheus.Gauge({
    name: 'g_running_agents',
    help: 'How many agents are running',
    labelNames: ['service']
  });


  function isValid({ agent }) {
    return Boolean(
      agent.deployed &&
      agent.archetype in archetypeClasses &&
      (conf.swarm.filterArchetypes.length === 0 || conf.swarm.filterArchetypes.includes(agent.archetype))
    );
  }

  async function undeployExpired({ agent }) {
    const now = new Date();
    if (agent.deployed && agent.options.expire) {
      const undeployAt = offsetTime(agent.updatedAt, agent.options.expire);
      if (undeployAt && now >= undeployAt) {
        log(`Undeploying expired agent ${agent._id}:${agent.options.name} after ${agent.options.expire} of deployment`);
        agent.deployed = false;
        await Agent.findByIdAndUpdate(agent._id, { deployed: agent.deployed });
        return true;
      }
    }
    return false;
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
    verbose('stale lockCleared:', lockCleared)
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
      let capacityReached = false

      g_agents_processed.set({ service }, agents?.length || 0);
      // verbose('agents.length:', agents?.length || 0)
      // verbose('send metrics to prometheus:', g_agents_processed)

      for (const agent of agents) {
        // verbose('agent:', agent, ', isValid:', isValid({ agent }))
        if (isValid({ agent })) {
          const expired = await undeployExpired({ agent })
          if (!expired) {
            shouldRun[agent._id] = agent;
          }

          if (!(agent._id in runningXmppAgents)) {

            log(
              `Agents capacity: (${Object.keys(runningXmppAgents).length}/${conf.swarm.maxAgentsRun}), ` +
              `current agent ${agent._id}:${agent.options.name}`
            );

            if (!capacityReached) {
              capacityReached = (conf.swarm.maxAgentsRun > 0 && Object.keys(runningXmppAgents).length >= conf.swarm.maxAgentsRun);
              log('capacityReached:', capacityReached);
              if (capacityReached) {
                log(
                  `Agent limit reached (${Object.keys(runningXmppAgents).length}/${conf.swarm.maxAgentsRun}), ` +
                  `skipping agent ${agent._id}:${agent.options.name}`
                );
              } else {
                verbose('start agent')
                await startAgent({ agent });
              }
            }
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

      g_running_agents.set({ service }, Object.keys(runningXmppAgents)?.length || 0);
      // verbose('runningXmppAgents.length:', Object.keys(runningXmppAgents)?.length || 0)
      // verbose('send metrics to prometheus:', g_running_agents)

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




  return {
    monitorAgents,
    shutdown
  };
}
