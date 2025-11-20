import crypto from 'crypto'
import { join } from 'path'
import resourceJS from 'resourcejs'
import lodash from 'lodash'
const { isArray, has, each, assign } = lodash

import User from './models/user.js'
import Key from './models/key.js'
import Dialog from './models/dialog.js'
import Landing from './models/landing.js'
import Interest from './models/interest.js'
import Agent from './models/agent.js'
import Map from './models/map.js'
import App from './models/app.js'
import Bridge from './models/bridge.js'
import File from './models/file.js'
import Storage from './models/storage.js'

import { checkLoginOrBearer } from './middleware/check-auth.js'
import { deleteFile } from './routes/files.js'
import { Verbose } from './services.js'
import conf from './conf.js'

const verbose = Verbose('sd:api/index'); verbose('')

const getResources = (app) => {
  const resources = {}

  // NOTE: Normally it should be disabled in conf for security reasons
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
            delete user.xmpp
            delete user.stripe
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

              if (has(req.user, 'limits.deployedAgents') &&
                  req.user?.limits?.deployedAgents != null &&
                  deployedCount >= req.user.limits.deployedAgents) {
                return res.status(403).json({
                  result: 'error',
                  message: 'Deployed agents limit reached'
                });
              }

              if (has(req.user, 'limits.archetypes') &&
                  req.user?.limits?.archetypes != null &&
                  !req.user?.limits?.archetypes.includes(req.body.archetype)) {
                return res.status(403).json({
                  result: 'error',
                  message: `You are not allowed to deploy agents of the archetype: ${req.body.archetype}`,
                });
              }

              verbose('req.user.limits:', req.user.limits)
              verbose('req.body.options:', req.body.options)
              if (has(req.user, 'limits.chatProviders') &&
                  req.user?.limits?.chatProviders != null &&
                  req.body.options?.chat?.model?.provider != null &&
                  !req.user?.limits?.chatProviders.includes(req.body.options.chat.model.provider)) {
                return res.status(403).json({
                  result: 'error',
                  message: `You are not allowed to deploy chat agents with model provider: ${req.body.options.chat.model.provider}`,
                });
              }
              if (has(req.user, 'limits.ragProviders') &&
                  req.user?.limits?.ragProviders != null &&
                  req.body.options?.rag?.model?.provider != null &&
                  !req.user?.limits?.ragProviders.includes(req.body.options.rag.model.provider)) {
                return res.status(403).json({
                  result: 'error',
                  message: `You are not allowed to deploy rag agents with model provider: ${req.body.options.rag.model.provider}`,
                });
              }
              if (has(req.user, 'limits.ragEmbeddingsProviders') &&
                  req.user?.limits?.ragEmbeddingsProviders != null &&
                  req.body.options?.rag?.embeddings?.provider != null &&
                  !req.user?.limits?.ragEmbeddingsProviders.includes(req.body.options.rag.embeddings.provider)) {
                return res.status(403).json({
                  result: 'error',
                  message: `You are not allowed to deploy rag agents with embeddings provider: ${req.body.options.rag.embeddings.provider}`,
                });
              }
              if (has(req.user, 'limits.sttProviders') &&
                  req.user?.limits?.sttProviders != null &&
                  req.body.options?.stt?.model?.provider != null &&
                  !req.user?.limits?.sttProviders.includes(req.body.options.stt.model.provider)) {
                return res.status(403).json({
                  result: 'error',
                  message: `You are not allowed to deploy stt agents with model provider: ${req.body.options.stt.model.provider}`,
                });
              }
              if (has(req.user, 'limits.ttsProviders') &&
                  req.user?.limits?.ttsProviders != null &&
                  req.body.options?.tts?.model?.provider != null &&
                  !req.user?.limits?.ttsProviders.includes(req.body.options.tts.model.provider)) {
                return res.status(403).json({
                  result: 'error',
                  message: `You are not allowed to deploy tts agents with model provider: ${req.body.options.tts.model.provider}`,
                });
              }
              if (has(req.user, 'limits.imagegenProviders') &&
                  req.user?.limits?.imagegenProviders != null &&
                  req.body.options?.imagegen?.model?.provider != null &&
                  !req.user?.limits?.imagegenProviders.includes(req.body.options.imagegen.model.provider)) {
                return res.status(403).json({
                  result: 'error',
                  message: `You are not allowed to deploy imagegen agents with model provider: ${req.body.options.imagegen.model.provider}`,
                });
              }
              if (has(req.user, 'limits.avatarProviders') &&
                  req.user?.limits?.avatarProviders != null &&
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
              if (has(req.user, 'limits.maps') &&
                  req.user?.limits?.maps != null) {
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

  if (conf.resource.app) {
    // NOTE: caution, the app has double meaning:
    //       app - express app, the first argument to resourceJS below
    //       app - instance of the App model
    resources.app = resourceJS(app, '/v1', 'app', App).rest({
      before: (req, res, next) => {
        checkLoginOrBearer(req, res, async (err) => {
          if (err) return next(err);

          req.body.userId = req.user._id;
          req.modelQuery = App.where('userId', req.user._id);
          next()
        });
      }
    });
  }

  if (conf.resource.bridge) {
    resources.bridge = resourceJS(app, '/v1', 'bridge', Bridge).rest({
      before: (req, res, next) => {
        checkLoginOrBearer(req, res, async (err) => {
          if (err) return next(err);

          req.body.userId = req.user._id;
          req.modelQuery = Bridge.where('userId', req.user._id);
          next()
        });
      }
    });
  }

  if (conf.resource.file) {
    resources.file = resourceJS(app, '/v1', 'file', File).rest({
      before: (req, res, next) => {
        checkLoginOrBearer(req, res, async (err) => {
          if (err) return next(err);

          req.body.userId = req.user._id;
          req.modelQuery = File.where('userId', req.user._id);

          if (req.method === 'DELETE') {
            try {
              await deleteFile({ fileId: req.params.fileId })
            } catch (err) {
            }
          }

          next()
        });
      }
    });
  }

  if (conf.resource.storage) {
    resources.storage = resourceJS(app, '/v1', 'storage', Storage).rest({
      before: (req, res, next) => {
        checkLoginOrBearer(req, res, async (err) => {
          if (err) return next(err);

          req.body.userId = req.user._id;
          req.modelQuery = Storage.where('userId', req.user._id);
          next()
        });
      }
    });
  }

  return resources
}

export let resources = {}

function useSpec({ app, resources }) {
  // Get the Swagger paths and definitions for each resource.
  let paths = {};
  let definitions = {};
  each(resources, function (resource) {
    const swagger = resource.swagger();

    const shouldExclude = conf.resource.spec.excludes.some(key =>
      has(swagger.definitions, key)
    );
    if (shouldExclude) {
      return;
    }

    paths = assign(paths, swagger.paths);
    definitions = assign(definitions, swagger.definitions);
  });

  // Define the specification.
  const specification = {
    swagger: '2.0',
    ...conf.resource.spec.json,

    definitions: definitions,
    paths: paths,

    // ✅ Add securityDefinitions for the Authorization header
    securityDefinitions: {
      Bearer: {
        // type: 'apiKey',
        // name: 'Authorization',
        // in: 'header',
        // description: 'Enter your bearer token in the format: Bearer <ACCESS_TOKEN>'

        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Authorization: Bearer <ACCESS_TOKEN>',
      }
    },

    // ✅ Apply the Bearer auth globally to all endpoints
    security: [
      {
        Bearer: []
      }
    ]
  };

  // Show the specification at the URL.
  app.get('/v1/spec.json', function(req, res, next) {
    res.json(specification);
  });
}

export default (app) => {
  resources = getResources(app)

  if (conf.resource.spec.enable) {
    useSpec({ app, resources })
  }

  // verbose('resources:', resources)
}
