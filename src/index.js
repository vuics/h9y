import https from 'https'
import http from 'http'
import { resolve } from 'path'
import { inspect } from 'util'
import { EventEmitter } from 'events'
import { readFileSync } from 'fs'

import express from 'express'
import passport from 'passport'
import morgan from 'morgan'
import responseTime from 'response-time'
import cookieParser from 'cookie-parser'
import compression from 'compression'
import flash from 'connect-flash'
import cors from 'cors'
import hpp from 'hpp'
import helmet from 'helmet'
import helmetCsp from 'helmet-csp'

import { log, warn, error, Verbose } from './services.js'
import conf, { revealConf } from './conf.js'
import auth from './middleware/auth.js'
import restAPI from './rest-api.js'
import routes from './routes/index.js'
import session from './middleware/session.js'
import { sendError } from './middleware/errors.js'

// Connect to MongoDB through Mongoose driver
import './mongo.js'

// Connect to ArangoDB
import './arango.js'

const verbose = Verbose('sd:index'); verbose('')

process.env.NODE_TLS_REJECT_UNAUTHORIZED = conf.node.tlsRejectUnauthorized
warn('Set NODE_TLS_REJECT_UNAUTHORIZED:',
  process.env.NODE_TLS_REJECT_UNAUTHORIZED)

EventEmitter.defaultMaxListeners = conf.node.defaultMaxListeners
warn('Set EventEmitter.defaultMaxListeners:', EventEmitter.defaultMaxListeners)

log('public conf:', inspect(revealConf(), { colors: true, depth: null }))

// Create express application
export const app = express()

// Server
export let server

if (conf.ssl.enable) {
  server = https.createServer({
    key: readFileSync(conf.ssl.keyFile),
    cert: readFileSync(conf.ssl.certFile)
  }, app)
} else {
  server = http.createServer(app)
}

// Express middleware configuration
app.use(compression()) // gzip compression
app.use(cookieParser()) // for parsing cookie
app.use(express.json({ limit: '100mb' })) // for parsing application/json
app.use(express.urlencoded({ extended: true, limit: '100mb' })) // for parsing application/x-www-form-urlencoded
app.use(express.text({ limit: '100mb' }))
app.use(express.raw({ limit: '100mb' }))
process.env.NODE_ENV !== 'test' && app.use(morgan('tiny')) // for logging HTTP-requests
app.use(flash()) // to support passport.js errors through flash

// Security
if (conf.security.hpp) {
  app.use(hpp()) // Prevent HTTP Parameter Pollution
}
if (conf.security.helmet) {
  app.use(helmet()) // Use appropriate security headers
}
if (conf.security.csp) {
  app.use(helmetCsp({
    directives: {
      defaultSrc: ["'self'"], // default value for all directives that are absent
      scriptSrc: ["'self'"], // helps prevent XSS attacks
      objectSrc: ["'self'"],
      imgSrc: ["'self'"],
      styleSrc: ["'self'"],
      frameAncestors: ["'none'"], // helps prevent Clickjacking attacks
      upgradeInsecureRequests: [],
    },
    reportOnly: false,
  })) // Content Security Policy
}
if (conf.security.trustProxy) {
  // HTTP(s) headers
  app.set('trust proxy', 1) // trust 1st proxy
}
if (!conf.security.powered) {
  app.disable('x-powered-by') // that's more secure
}

if (conf.cors.enabled) {
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || conf.cors.whitelist.includes(origin)) {
        return callback(null, true)
      }
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
  }))
}

app.use(responseTime()) // X-Response-Time header

// Session
app.use(session)

// Authentication
auth(app)

// Routes
app.use('/', routes)

// API
restAPI(app)

// Errors
app.use(sendError)

process.stdin.resume()
process.on('warning', (warning) => {
  warn('warning:', warning)
})
process.on('unhandledRejection', (reason, promise) => {
  error('Unhandled Rejection at:', promise, 'reason:', reason)
})
process.on('uncaughtException', (err) => {
  error('uncaughtException:', err)
})
process.on('beforeExit', (code) => {
  log('Process beforeExit event with code: ', code)
})
process.on('exit', (code) => {
  log(`Exit with code: ${code}`)
})

const handleSignal = async (signal) => {
  log(`Received ${signal}`)
  process.exit()
}
process.on('SIGINT', handleSignal)
process.on('SIGTERM', handleSignal)

// Start!
server.listen(conf.port, () => {
  log('Selfdev-API server is listening on port', conf.port)
  verbose(' ')
  verbose(`  http${conf.ssl.enable ? 's' : ''}://localhost:${conf.port}`)
  verbose(' ')
})

export default app
