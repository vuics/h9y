import { Router } from 'express';
import { createProxyMiddleware } from "http-proxy-middleware";

// import { checkAuth } from '../middleware/check-auth.js';
import { Verbose, log, warn, error } from '../services.js';
import conf from '../conf.js'

const verbose = Verbose('sd:routes/prometheus'); verbose('');
const router = Router();

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
//
// NOTE:  The /v1/prometheus is excluded from global express middleware in ../index.js
router.use('/', createProxyMiddleware(proxyOptions))

export default router;
