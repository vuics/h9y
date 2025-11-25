import express from 'express';
import morgan from 'morgan'
import compression from 'compression'
import cookieParser from 'cookie-parser'
import http from 'http'
import cors from 'cors';
import { createProxyMiddleware } from "http-proxy-middleware";

import { log, warn, error, Verbose } from '../services.js'
import conf from '../conf.js'

const verbose = Verbose('sd:bridge/web-server'); verbose('')

class WebServer {
  constructor () {
    verbose('WebServer constructed');
    this.app = null;
    this.server = null;
    this.protocol = null;
    this.secure = null;
  }

  async start() {
    if (!this.app) {
      this.app = express();

      this.app.use(compression());
      this.app.use(cookieParser()) // for parsing cookie
      this.app.use(express.json({ limit: '1mb' })) // for parsing application/json
      this.app.use(express.urlencoded({ extended: true, limit: '1mb' })) // for parsing application/x-www-form-urlencoded
      this.app.use(express.text({ limit: '1mb' }))
      this.app.use(express.raw({ limit: '1mb' }))
      this.app.use(morgan('tiny'));

      this.app.use(
        cors({
          origin: '*', // Configure appropriately for production, for example:
          // origin: ['https://your-remote-domain.com', 'https://your-other-remote-domain.com'],
          // exposedHeaders: ['Mcp-Session-Id'],
          // allowedHeaders: ['Content-Type', 'mcp-session-id']
          // methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
          allowedHeaders: [
            'Content-Type',
            'Authorization',
            'mcp-protocol-version',
            'mcp-session',
            'mcp-session-id',
            'mcp-client',
            'mcp-server',
          ],
          exposedHeaders: [
            'Content-Type',
            'mcp-protocol-version',
            'mcp-session',
            'Mcp-Session-Id',
          ],
        })
      );

      this.app.enable('trust proxy')

      this.app.use((req, res, next) => {
        // Detect if it uses http or https
        if (!this.protocol && req.protocol) {
          this.protocol = req.protocol
          log('Uses protocol:', this.protocol)
        }
        if (!this.secure && req.secure) {
          this.secure = req.secure
          log('Uses secure:', this.secure)
        }
        next();
      });

      this.app.get('/about', (req, res) => res.send('Selfdev Webhook Server'));

      this.server = http.createServer(this.app);
      this.server.listen(conf.webServer.port, () => {
        log('Bridge WebServer is listening on port', conf.webServer.port);
        verbose(`  http://localhost:${conf.webServer.port}`);
        verbose(`  ${conf.webServer.origin}`);
      });
    }
    return this.app;
  }

  getProtocol() {
    if (this.protocol !== null) {
      return this.protocol
    } else if (this.secure !== null) {
      return this.secure ? 'https' : 'http'
    }
    return 'https'
  }

  addRoute({ path, method = 'post', handler }) {
    this.app[method](path, handler);
  }

  // Remove direct routes only
  removeRoute({ path, method = null } = {}) {
    this.app._router.stack = this.app._router.stack.filter(layer => {
      if (!layer.route) return true;
      if (layer.route.path !== path) return true;
      if (method && !layer.route.methods[method]) return true;
      return false; // remove
    });
  }

  // Remove router layers only
  removeRouter({ path } = {}) {
    this.app._router.stack = this.app._router.stack.filter(layer => {
      if (layer.name !== 'router') return true;
      if (!layer.regexp) return true;
      if (!layer.regexp.test(path)) return true;
      return false; // remove
    });
  }

  async stop() {
    // Nothig
    // NOTE: Keep the server running since it might be used by other bridges
  }
}

// NOTE: Exportng an instance of the WebServer class but not the class itself
//       to make all bridges use the same web server
const webServer = new WebServer()
export default webServer

