import express from 'express';
import morgan from 'morgan'
import compression from 'compression'
import cookieParser from 'cookie-parser'
import http from 'http'
import cors from 'cors';

import { log, warn, error, Verbose } from '../services.js'
import conf from '../conf.js'

const verbose = Verbose('sd:bridge/web-server'); verbose('')

class WebServer {
  constructor () {
    verbose('WebServer constructed');
    this.app = null;
    this.server = null;
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
          exposedHeaders: ['Mcp-Session-Id'],
          allowedHeaders: ['Content-Type', 'mcp-session-id']
        })
      );

      this.app.get('/', (req, res) => res.send('Selfdev Webhook Server'));

      this.server = http.createServer(this.app);
      this.server.listen(conf.webServer.port, () => {
        log('Bridge WebServer is listening on port', conf.webServer.port);
        verbose(`  http://localhost:${conf.webServer.port}`);
      });
    }
    return this.app;
  }

  addRoute({ path, method = 'post', handler }) {
    this.app[method](path, handler);
  }

  removeRoute({ path, method = 'post' }) {
    this.app._router.stack = this.app._router.stack.filter(layer => {
      if (!layer.route) return true;
      if (layer.route.path !== path) return true;
      if (!layer.route.methods[method]) return true;
      return false;
    });
  }

  async stop() {
    // Nothig
    // Keep the server running since it might be used by other bridges
  }
}

// NOTE: Exportng an instance of the WebServer class but not the class itself
//       to make all bridges use the same web server
const webServer = new WebServer()
export default webServer

