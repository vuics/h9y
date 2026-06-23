import passport from 'passport'
import lodash from 'lodash'
const { isArray, has } = lodash

import { Verbose } from '../services.js'

const verbose = Verbose('sd:middleware/check-auth'); verbose('')

export const checkAuth = (req, res, next) => {
  // verbose('checkAuth: req: ', req)
  // verbose('checkAuth: req.user: ', req.user)
  // verbose('req.isAuthenticated():', req.isAuthenticated)
  if (req.isAuthenticated()) {
    next()
  } else {
    res.status(401).json({
      result: 'error',
      message: 'Requires user authentication'
    })
  }
}

export const checkAPIAuth = (req, res, next) => {
  passport.authenticate('bearer', { session: false }, (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      return res.status(401).json({
        result: 'error',
        message: 'Unauthorized',
      });
    }
    req.user = user; // Important: attach the authenticated user to the request

    // Optional: Verbose logging for debugging
    verbose('req.user?.limits:', req.user?.limits);
    verbose('req.user?.limits?.apiAccess:', req.user?.limits?.apiAccess);

    if (has(req.user, 'limits.apiAccess') &&
        req.user?.limits?.apiAccess != null &&
        !req.user?.limits?.apiAccess) {
      return res.status(403).json({
        result: 'error',
        message: 'You do not have access to the API',
      });
    }

    next();
  })(req, res, next);
};


export const checkLoginOrBearer = (req, res, next) => {
  // verbose('checkAuth: req: ', req)
  // verbose('checkAuth: req.user: ', req.user)
  // verbose('req.isAuthenticated():', req.isAuthenticated)
  if (req.isAuthenticated()) {
    next()
  } else {
    checkAPIAuth(req, res, (error) => {
      if (error) { return next(error) }
      next()
    })
  }
}

export const checkAdmin = (req, res, next) => {
  if (req.user.roles.includes('admin')) {
    next()
  } else {
    res.status(401).json({
      result: 'error',
      message: 'Requires admin privileges'
    })
  }
}
