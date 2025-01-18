import { Router } from 'express'
import axios from 'axios'
import { checkAuth, checkAPIAuth } from '../middleware/check-auth.js'
import Dialog from '../models/dialog.js'
import { Verbose } from '../services.js'
import conf from '../conf.js'
// import util from 'util'
// import { exec } from 'child_process'

const verbose = Verbose('sd:routes/ask'); verbose('')
const router = Router()

const ask = async (req, res, next) => {
  // verbose('ask req.headers:', req.headers)
  // verbose('ask req.user:', req.user)
  try {
    const { prompt } = req.body
    let reply = ''
    // verbose('prompt:', prompt)
    if (conf.agency.enable) {
      const response = await axios.post(`${conf.agency.url}/chat`, {
        prompt
      })
      reply = response.data.content
    } else if (conf.snake.enable) {
      const response = await axios.get(`${conf.snake.url}/ask`, {
        params: { prompt }
      })
      reply = response.data
    } else {
      throw new Error('No AI service available')
    }
    const dialog = new Dialog({ userId: req.user._id, prompt, reply })
    res.json({ result: 'ok', reply })
    await dialog.save()
  } catch (err) {
    res.json({ result: 'error', message: err.toString()})
  }
}

router.post('/', checkAuth, ask)
router.post('/api', checkAPIAuth, ask)

export default router
