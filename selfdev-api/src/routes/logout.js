import { Router } from 'express'

import { checkAuth } from '../middleware/check-auth.js'
import { Verbose, error } from '../services.js'
import { updateUserLimits } from './subscriptions.js'

const verbose = Verbose('sd:routes/logout'); verbose('')

const router = Router()

router.get('/', checkAuth, async (req, res, next) => {
  try {
    await updateUserLimits({ user: req.user })
  } catch (err) {
    error('Error updating user limits on logout:', err)
  }
  const userEmail = req.user.email
  req.logout((err) => {
    verbose('logout err:', err)
    if (err) {
      res.json({
        result: 'error',
        message: err.toString()
      })
      return next(err)
    }
    verbose(`User ${userEmail} logged out`)
    res.json({
      result: 'ok',
      message: 'Logged out'
    })
  })
})

export default router
