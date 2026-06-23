import { Router } from 'express'
import axios from 'axios'
import { Verbose } from '../services.js'
import conf from '../conf.js'

const verbose = Verbose('sd:routes/available'); verbose('')
const app = Router()

app.get('/', async (req, res, next) => {
  try {
    // const response = await axios.get(`${conf.snake.url}/available`)
    // // verbose('response.data:', response.data)
    // return res.json(response.data)
    return res.json({
      result: 'ok',
      name: "selfdev-api v1",
      status: "available",
    })
  } catch (err) {
    res.status(503).json({ result: 'error', message: err.toString()})
  }
})

export default app
