import crypto from 'crypto'
import { join } from 'path'
import resourceJS from 'resourcejs'
import lodash from 'lodash'
const { isArray } = lodash

import { checkLoginOrBearer } from './middleware/check-auth.js'
import User from './models/user.js'
import Key from './models/key.js'
import Dialog from './models/dialog.js'
import Subscription from './models/subscription.js'
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

  return resources
}

export let resources = {}

export default (app) => {
  resources = getResources(app)
  // console.log('resources:', resources)
}
