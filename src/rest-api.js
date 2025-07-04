import crypto from 'crypto'
import { join } from 'path'
import resourceJS from 'resourcejs'
import lodash from 'lodash'
const { isArray } = lodash

import User from './models/user.js'
import Key from './models/key.js'
import Dialog from './models/dialog.js'
import Landing from './models/landing.js'
import Interest from './models/interest.js'
import Agent from './models/agent.js'
import Map from './models/map.js'

import { checkLoginOrBearer } from './middleware/check-auth.js'
import { Verbose } from './services.js'
import conf from './conf.js'

const verbose = Verbose('sd:api/index'); verbose('')

const getResources = (app) => {
  const resources = {}

  if (conf.resource.user) {
    resources.user = resourceJS(app, '/v1', 'user', User).rest({
      before: (req, res, next) => {
        checkLoginOrBearer(req, res, (err) => {
          if (err) {
            return next(err)
          }

          next()
        })
      },
      after: (req, res, next) => {
        if (req.method === 'GET') {
          const secureUser = (user) => {
            // delete passwords, tokens, etc. from users for security reasons
            // delete user.config
            delete user.password
            delete user.rememberMe
          }

          if (isArray(res.resource.item)) {
            // GET list of users
            res.resource.item.forEach(secureUser)
          } else {
            // GET one user
            secureUser(res.resource.item)
          }
        }
        next()
      }
    })
  }

  if (conf.resource.key) {
    resources.key = resourceJS(app, '/v1', 'key', Key).rest({
      before: (req, res, next) => {
        checkLoginOrBearer(req, res, (err) => {
          if (err) {
            return next(err)
          }

          req.body.userId = req.user._id
          req.modelQuery = Key.where('userId', req.user._id)
          if (req.method === 'POST' || req.method === 'PUT') {
            req.body.key = crypto.randomBytes(60).toString('base64')
            req.body.secret = crypto.randomBytes(60).toString('base64')
          }
          next()
        })
      }
    })
  }

  if (conf.resource.dialog) {
    resources.dialog = resourceJS(app, '/v1', 'dialog', Dialog).index({
      before: (req, res, next) => {
        checkLoginOrBearer(req, res, (err) => {
          if (err) {
            return next(err)
          }
          req.body.userId = req.user._id
          req.modelQuery = Dialog.where('userId', req.user._id).sort({ createdAt: 'desc'})
          next()
        })
      }
    })
  }

  if (conf.resource.landing) {
    resources.landing = resourceJS(app, '/v1', 'landing', Landing).get({ })
  }

  if (conf.resource.interest) {
    resources.interest = resourceJS(app, '/v1', 'interest', Interest).post({
      before: (req, res, next) => {
        verbose('interest req.body:', req.body)
        next()
      }
    })
  }

  if (conf.resource.agent) {
    resources.agent = resourceJS(app, '/v1', 'agent', Agent).rest({
      before: (req, res, next) => {
        checkLoginOrBearer(req, res, async (err) => {
          if (err) {
            return next(err)
          }
          req.body.userId = req.user._id
          req.modelQuery = Agent.where('userId', req.user._id)

          try {
            // Check if user is creating or updating with deployed:true
            const wantsToDeploy = req.body.deployed === true;
            if (wantsToDeploy) {
              // Count already deployed agents of this user
              const deployedCount = await Agent.countDocuments({ userId: req.user._id, deployed: true });
              // If this is an update, exclude this agent from the count
              if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
                const agentId = req.params.id;
                const currentAgent = await Agent.findById(agentId);
                if (currentAgent && currentAgent.deployed === true) {
                  // The agent is already deployed, so no need to increase count
                  // So deployedCount includes this one, no need to check limit
                  return next();
                }
              }

              if (req.user?.limits?.deployedAgents != null &&
                  deployedCount >= req.user.limits.deployedAgents) {
                return res.status(403).json({
                  result: 'error',
                  message: 'Deployed agents limit reached'
                });
              }

              if (req.user?.limits?.archetypes != null &&
                  !req.user?.limits?.archetypes.includes(req.body.archetype)) {
                return res.status(403).json({
                  result: 'error',
                  message: `You are not allowed to deploy agents of the archetype: ${req.body.archetype}`,
                });
              }

              verbose('req.user.limits:', req.user.limits)
              verbose('req.body.options:', req.body.options)
              if (req.user?.limits?.chatProviders != null &&
                req.body.options?.chat?.model?.provider != null &&
                !req.user?.limits?.chatProviders.includes(req.body.options.chat.model.provider)) {
                return res.status(403).json({
                  result: 'error',
                  message: `You are not allowed to deploy chat agents with model provider: ${req.body.options.chat.model.provider}`,
                });
              }
              if (req.user?.limits?.ragProviders != null &&
                  req.body.options?.rag?.model?.provider != null &&
                  !req.user?.limits?.ragProviders.includes(req.body.options.rag.model.provider)) {
                return res.status(403).json({
                  result: 'error',
                  message: `You are not allowed to deploy rag agents with model provider: ${req.body.options.rag.model.provider}`,
                });
              }
              if (req.user?.limits?.ragEmbeddingsProviders != null &&
                  req.body.options?.rag?.embeddings?.provider != null &&
                  !req.user?.limits?.ragEmbeddingsProviders.includes(req.body.options.rag.embeddings.provider)) {
                return res.status(403).json({
                  result: 'error',
                  message: `You are not allowed to deploy rag agents with embeddings provider: ${req.body.options.rag.embeddings.provider}`,
                });
              }
              if (req.user?.limits?.sttProviders != null &&
                  req.body.options?.stt?.model?.provider != null &&
                  !req.user?.limits?.sttProviders.includes(req.body.options.stt.model.provider)) {
                return res.status(403).json({
                  result: 'error',
                  message: `You are not allowed to deploy stt agents with model provider: ${req.body.options.stt.model.provider}`,
                });
              }
              if (req.user?.limits?.ttsProviders != null &&
                  req.body.options?.tts?.model?.provider != null &&
                  !req.user?.limits?.ttsProviders.includes(req.body.options.tts.model.provider)) {
                return res.status(403).json({
                  result: 'error',
                  message: `You are not allowed to deploy tts agents with model provider: ${req.body.options.tts.model.provider}`,
                });
              }
              if (req.user?.limits?.imagegenProviders != null &&
                  req.body.options?.imagegen?.model?.provider != null &&
                  !req.user?.limits?.imagegenProviders.includes(req.body.options.imagegen.model.provider)) {
                return res.status(403).json({
                  result: 'error',
                  message: `You are not allowed to deploy imagegen agents with model provider: ${req.body.options.imagegen.model.provider}`,
                });
              }
              if (req.user?.limits?.avatarProviders != null &&
                  req.body.options?.avatar?.model?.provider != null &&
                  !req.user?.limits?.avatarProviders.includes(req.body.options.avatar.model.provider)) {
                return res.status(403).json({
                  result: 'error',
                  message: `You are not allowed to deploy avatar agents with model provider: ${req.body.options.avatar.model.provider}`,
                });
              }
            }

          } catch (err) {
            next(err);
          }

          next()
        })
      }
    })
  }

  if (conf.resource.map) {
    resources.map = resourceJS(app, '/v1', 'map', Map).rest({
      before: (req, res, next) => {
        checkLoginOrBearer(req, res, async (err) => {
          if (err) return next(err);

          req.body.userId = req.user._id;
          req.modelQuery = Map.where('userId', req.user._id);

          verbose('req.user.limits:', req.user.limits)
          verbose('req.user.limits.maps:', req.user.limits.maps)
          try {
            if (req.method === 'POST') {
              if (req.user?.limits?.maps != null) {
                const currentCount = await Map.countDocuments({ userId: req.user._id });
                verbose(`Maps limit: ${currentCount} / ${req.user.limits.maps}`)
                if (currentCount >= req.user.limits.maps) {
                  return res.status(403).json({
                    result: 'error',
                    message: `You cannot create more maps. Map limit reached: ${currentCount} / ${req.user.limits.maps}`,
                  });
                }
              }
            }
            next();
          } catch (error) {
            next(error);
          }
        });
      }
    });
  }

  return resources
}

export let resources = {}

export default (app) => {
  resources = getResources(app)
  // console.log('resources:', resources)
}
