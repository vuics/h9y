import { Router } from 'express'
import axios from 'axios'
import { checkAuth, checkAPIAuth } from '../middleware/check-auth.js'
import Outcome from '../models/outcome.js'
import { Verbose } from '../services.js'
import conf from '../conf.js'

const verbose = Verbose('sd:routes/run'); verbose('')
const app = Router()

const run = async (req, res, next) => {
  // verbose('run req.headers:', req.headers)
  // verbose('run req.user:', req.user)
  try {
    const { code, device } = req.body
    verbose('code:', code)
    verbose('device:', device)
    const response = await axios.get(`${conf.snake.url}/run`, {
      params: { code, device }
    })
    const { result, output, drawing, error } = response.data
    verbose('output:', output)
    const outcome = new Outcome({
      userId: req.user._id, code, device, result, output, drawing, error
    })
    await outcome.save()
    res.json({ result, output, drawing, error })
  } catch (err) {
    res.status(503).json({ result: 'error', message: err.toString()})
  }
}

app.post('/', checkAuth, run)
app.post('/api', checkAPIAuth, run)

export default app
