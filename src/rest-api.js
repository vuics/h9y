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
    // resources.agent = resourceJS(app, '/v1', 'agent', Agent).rest({
    //   before: (req, res, next) => {
    //     checkLoginOrBearer(req, res, (err) => {
    //       if (err) {
    //         return next(err)
    //       }

    //       req.body.userId = req.user._id
    //       req.modelQuery = Agent.where('userId', req.user._id)
    //       next()
    //     })
    //   }
    // })

    resources.agent = resourceJS(app, '/v1', 'agent', Agent).rest({
      before: (req, res, next) => {
        checkLoginOrBearer(req, res, async (err) => {
          if (err) {
            return next(err)
          }
          req.body.userId = req.user._id
          req.modelQuery = Agent.where('userId', req.user._id)

          try {
            if (req.user?.limits?.deployedAgents != null) {
              // Check if user is creating or updating with deployed:true
              const wantsToDeploy = req.body.deployed === true;
              if (wantsToDeploy) {
                // Count already deployed agents of this user
                const deployedCount = await Agent.countDocuments({ userId: req.user._id, deployed: true });
                // If this is an update, exclude this agent from the count
                if (req.method === 'PUT' || req.method === 'PATCH') {
                  const agentId = req.params.id;
                  const currentAgent = await Agent.findById(agentId);
                  if (currentAgent && currentAgent.deployed === true) {
                    // The agent is already deployed, so no need to increase count
                    // So deployedCount includes this one, no need to check limit
                    return next();
                  }
                }

                if (deployedCount >= req.user.limits.deployedAgents) {
                  return res.status(403).json({ result: 'error', message: 'Deployed agents limit reached' });
                }
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
        checkLoginOrBearer(req, res, (err) => {
          if (err) {
            return next(err)
          }

          req.body.userId = req.user._id
          req.modelQuery = Map.where('userId', req.user._id)
          next()
        })
      }
    })
  }

  return resources
}

export let resources = {}

export default (app) => {
  resources = getResources(app)
  // console.log('resources:', resources)
}
