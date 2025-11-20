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
import { createProxyMiddleware } from "http-proxy-middleware";

import { log, warn, error, Verbose } from './services.js'
import conf, { revealConf } from './conf.js'
import auth from './middleware/auth.js'
import restAPI from './rest-api.js'
import { subscriptionsWebhook } from './routes/subscriptions.js'
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

// It should go before parsers such as express.json()
app.post('/v1/subscriptions/webhook',
  express.raw({ type: 'application/json' }),
  subscriptionsWebhook,
);


const simpleRequestLogger = (proxyServer, options) => {
  proxyServer.on('proxyReq', (proxyReq, req, res) => {
    console.log(`[HPM] [${req.method}] ${req.url}`); // outputs: [HPM] GET /users
  });
};
const proxyOptions = {
  target: conf.prometheus.url,
  changeOrigin: true,
  logLevel: "debug",
  logger: console,
  plugins: [simpleRequestLogger],
};
// verbose('proxyOptions:', proxyOptions)
// TODO: It does not have any auth. Make it more secure
//       If we move it below, then the Prometheus will not be able to read the
//       HTTP request since there are all the app.use() below.
//       I do not know which app.use() causes the problem with Prometheus
app.use('/v1/prometheus', createProxyMiddleware(proxyOptions))


// Express middleware configuration

const exclusions = ['/v1/files', '/v1/prometheus'];
function isExcluded(req) {
  return exclusions.some(path => req.path.startsWith(path));
}

// Middleware wrapper
function useUnlessExcluded(middleware) {
  return (req, res, next) => {
    if (isExcluded(req)) return next();
    return middleware(req, res, next);
  };
}

// Apply all middlewares using the wrapper
app.use(useUnlessExcluded(compression()));           // gzip compression
app.use(useUnlessExcluded(cookieParser()));         // cookie parsing
app.use(useUnlessExcluded(express.json({ limit: '100mb' })));
app.use(useUnlessExcluded(express.urlencoded({ extended: true, limit: '100mb' })));
app.use(useUnlessExcluded(express.text({ limit: '100mb' })));
app.use(useUnlessExcluded(express.raw({ limit: '100mb' })));
if (process.env.NODE_ENV !== 'test') app.use(useUnlessExcluded(morgan('tiny')));
app.use(useUnlessExcluded(flash()));

// Security middlewares
if (conf.security.hpp) app.use(useUnlessExcluded(hpp()));
if (conf.security.helmet) app.use(useUnlessExcluded(helmet()));
if (conf.security.csp) {
  app.use(useUnlessExcluded(
    helmetCsp({
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        objectSrc: ["'self'"],
        imgSrc: ["'self'"],
        styleSrc: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: [],
      },
      reportOnly: false,
    })
  ));
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
