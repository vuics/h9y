import passport from 'passport'
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

export const checkAPIAuth = passport.authenticate('bearer', { session: false })

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
