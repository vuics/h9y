import { Router } from 'express'
import axios from 'axios'
import { checkAuth, checkAPIAuth } from '../middleware/check-auth.js'
import Dialog from '../models/dialog.js'
import { Verbose } from '../services.js'
import conf from '../conf.js'

const verbose = Verbose('sd:routes/ask'); verbose('')
const app = Router()

const ask = async (req, res, next) => {
  // verbose('ask req.headers:', req.headers)
  // verbose('ask req.user:', req.user)
  try {
    const { prompt } = req.body
    // verbose('prompt:', prompt)
    const response = await axios.get(`${conf.snake.url}/ask`, {
      params: { prompt }
    })
    const reply = response.data
    const dialog = new Dialog({ userId: req.user._id, prompt, reply })
    res.json({ result: 'ok', reply })
    await dialog.save()
  } catch (err) {
    res.json({ result: 'error', message: err.toString()})
  }
}

app.post('/', checkAuth, ask)
app.post('/api', checkAPIAuth, ask)

export default app
