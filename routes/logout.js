import { Router } from 'express'
import { checkAuth } from '../middleware/check-auth.js'
import { Verbose } from '../services.js'

const verbose = Verbose('sd:routes/logout'); verbose('')

const router = Router()

router.get('/', checkAuth, (req, res) => {
  req.logout((err) => {
    if (err) {
      res.json({
        result: 'err',
        message: err.toString()
      })
      return next(err)
    }
    verbose(`User ${req.user.email} logged out`)
    res.json({
      result: 'ok',
      message: 'Logged out'
    })
  })
})

export default router
