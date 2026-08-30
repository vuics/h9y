import { Router } from 'express'
import passport from 'passport'
import lodash from 'lodash'
const { has, isEmpty } = lodash

import { Verbose, error } from '../services.js'
import conf from '../conf.js'
import { updateUserLimits } from './subscriptions.js'

const verbose = Verbose('sd:routes/login'); verbose('')
const router = Router()

// NOTE: This has to run after req.login, not before it as a middleware. Since
//       passport 0.6 req.login regenerates the session to prevent fixation,
//       and a cookie configured on the session that gets replaced is thrown
//       away with it. That is why the checkbox had no effect at all.
const applyRememberMe = (req) => {
  if (req.body.rememberme) {
    req.session.cookie.maxAge = conf.session.rememberMaxAge
  } else {
    // No expiry at all, so the browser drops the cookie when it closes. The
    // old code did this for the remembered case and the other way round.
    req.session.cookie.expires = false
  }
}

router.post('/', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      return next(err)
    }

    // verbose('user:', user)
    if (!user) {
      // verbose('Login: user not found (or wrong credentials)')
      return res.status(403).json({
        result: 'error',
        message: 'User not found or wrong credentials.'
      })
    }

    req.login(user, async (err) => {
      if (err) {
        return next(err)
      }
      try {
        applyRememberMe(req)
        await updateUserLimits({ user })

        res.json({
          result: 'ok',
          message: 'Logged in',
          user: {
            _id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            phone: user.phone,
            roles: user.roles,
            address: user.address,
            limits: user.limits,
            settings: user.settings,
          }
        })
        verbose(`User ${req.user.email} logged in at ${Date.now()}. UserId: ${req.user._id}`)
      } catch (err) {
        error('Error logging in:', err)
        return next(err)
      }
    })
  })(req, res, next)
})

router.get('/status', (req, res) => {
  res.json({
    result: 'ok',
    isAuthenticated: req.isAuthenticated(),
    user: !has(req, 'user') ? {} : {
      _id: req.user._id,
      email: req.user.email,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      phone: req.user.phone,
      roles: req.user.roles,
      address: req.user.address,
      limits: req.user.limits,
      settings: req.user.settings,
    }
  })
})

export default router
