import path from 'path'
import { randomUUID } from 'crypto'
import { spawn } from 'child_process'
import fs from 'fs'
import { createProxyMiddleware } from "http-proxy-middleware";

import { log, warn, error, Verbose } from '../services.js'
import Connector from './connector.js'
import XmppAgent from '../swarm/xmpp-agent.js'
import Bridge from '../models/bridge.js'
import State from '../models/state.js'
import conf from '../conf.js'
import webServer from './web-server.js'
import { sleep } from '../utils/helper.js'

const verbose = Verbose('sd:bridge/webapp'); verbose('')

let availablePort = conf.webapp.portStart

const fallbackCode = `
lowdefy: 4.5.2
name: HyperAgency Web App Bridge Fallback

pages:
  - id: fallback
    type: PageHeaderMenu
    properties:
      title: Web App Fallback
    areas:
      content:
        justify: center
        blocks:
          - id: content_card
            type: Card
            style:
              maxWidth: 800
            blocks:
              - id: content
                type: Result
                properties:
                  title: Web App Bridge Fallback
                  subTitle: Please, add the code of the web app
      footer:
        blocks:
          - id: footer
            type: Paragraph
            properties:
              type: secondary
              content: |
                Made by a HyperAgency and Lowdefy
`

export default class Webapp extends Connector {
  constructor(args) {
    super(args);
    verbose('Webapp constructed');

    this.xmppAgent = new XmppAgent({
      agent: {
        options: {
          name: this.bridge.options.name,
          joinRooms: [this.bridge.options.joinRoom],
        },
        userId: this.bridge.userId,
      },
      handleChat: this.bridge.options.enablePersonal,
      handleRooms: this.bridge.options.enableRoom,
    });

    this.path = null
    this.port = null
    this.lowdefy = null
    this.state = null
  }

  async start() {
    super.start();
    verbose('Webapp starting...');

    try {
      this.lowdefy = null
      this.lowdefyIsReady = false
      this.lowdefyIsFailed = false

      const dirname = `/opt/webapp-bridges/${this.bridge.options.name}/`
      verbose('dirname:', dirname)
      if (!fs.existsSync(dirname)) {
        fs.mkdirSync(dirname, { recursive: true })
      }
      verbose('dirname created:', dirname)

      const devDirname = path.join(dirname, '.lowdefy/dev')
      verbose('devDirname:', devDirname)
      if (!fs.existsSync(devDirname)) {
        fs.mkdirSync(devDirname, { recursive: true })
      }
      verbose('dirname created:', devDirname)

      this.state = await State.findOne({
        userId: this.bridge.userId,
        bridgeId: this.bridge._id,
      })
      if (this.state) {
        log('Found state:', this.state, ' for bridge:', this.bridge.options.name)
      }
      const lowdefyYaml = this.state?.bridge.webapp.updatedCode || this.bridge.options.webapp.defaultCode || fallbackCode
      verbose('lowdefyYaml:', lowdefyYaml)

      const filename = path.join(dirname, 'lowdefy.yaml')
      await fs.promises.writeFile(filename, lowdefyYaml, 'utf-8');
      verbose('file is written:', filename)


      this.collectLogs = true
      this.logs = '';

      this.port = availablePort++
      log('this.port:', this.port, ', availablePort:', availablePort)

      const command = 'pnpx'
      const args = [
        'lowdefy', 'dev',
        '--port', this.port.toString(),
        '--config-directory', dirname,
        '--log-level', 'info',
        '--no-open',
        '--disable-telemetry',
      ];
      const opts = {
        shell: true,
        cwd: dirname,
        env: {
          NODE_ENV: 'production',
          PATH: process.env.PATH,
          PNPM_HOME: process.env.PNPM_HOME,
        },
      }
      verbose('command:', command, ', args:', args, ', opts:', opts)
      this.lowdefy = spawn(command, args, opts);

      setTimeout(async () => {
        await this.saveLogs()
        this.collectLogs = false
      }, 300_000)

      // Handle errors
      this.lowdefy.on('error', (err) => {
        error('Failed to start lowdefy:', err);
        this.lowdefyIsFailed = true
      });
      // Handle exit
      this.lowdefy.on('exit', async (code, signal) => {
        if (code !== null) {
          log(`Lowdefy exited with code ${code}`);
        } else {
          log(`Lowdefy was killed by signal ${signal}`);
        }
        this.lowdefyIsFailed = true
        await this.saveLogs()
      });
      // Capture stdout
      this.lowdefy.stdout.on('data', async (data) => {
        if (this.collectLogs) {
          const text = data.toString();
          this.logs += text;
          console.log('stdout:', text); // optional: still print to console
          // await this.sendMessage({ prompt: text })
        }
      });
      // Capture stderr
      this.lowdefy.stderr.on('data', async (data) => {
        if (this.collectLogs) {
          const text = data.toString();

          if (text.includes('∙  ✓ Ready') ||
              text.includes(`∙   - Local:        http://localhost:${this.port}`)) {
            this.lowdefyIsReady = true
          }
          if (text.includes('Failed to start server') ||
              text.includes('Error: listen EADDRINUSE: address already in use')) {
            this.lowdefyIsFailed = true
          }

          this.logs += text;
          console.error('stderr:', text); // optional: still print to console
          // await this.sendMessage({ prompt: 'stderr: ' + text })
        }
      });


      async function waitForLowdefy() {
        while (true) {
          if (this.lowdefyIsReady) {
            log("Lowdefy is ready...");
            return;
          }

          if (this.lowdefyIsFailed) {
            warn("Lowdefy is failed. Stopping...");
            await this.stop();
            log("Restarting after 30 seconds sleep...");
            await sleep(30_000);
            log("Restarting now");
            this.start();
            throw new Error("Error: Lowdefy is failed");
          }

          await sleep(3_000);
        }
      }

      log('Waiting for Lowdefy...')
      await waitForLowdefy.call(this);


      log('Starting proxy')
      await webServer.start();

      this.path = path.join(
        '/wa/' + this.bridge.userId._id.toString(),
        this.bridge.options.webapp.endpoint
      );
      verbose('path:', this.path);

      // NOTE: Below code works
      //
      const proxyOptions = {
        target: `http://localhost:${this.port}`,
        changeOrigin: true,
        logLevel: "debug",
        router: {
          [`http://localhost:${conf.webServer.port}/${this.path}`]: `http://localhost:${this.port}`,
          [`http://localhost:${conf.webServer.port}/_next`]: `http://localhost:${this.port}/_next`,
        },
        // pathFilter: [this.path, '/_next', '/api', '/icon.svg', '/manifest.webmanifest', '/.well-known' ]
      };

      // const proxyOptions = {
      //   target: `http://localhost:${this.port}`,
      //   changeOrigin: true,
      //   logLevel: "debug",
      //   router: {
      //     [`http://localhost:${conf.webServer.port}/${this.path}`]: `http://localhost:${this.port}`,
      //     [`http://localhost:${conf.webServer.port}/_next`]: `http://localhost:${this.port}/_next`,
      //   },
      //   // pathFilter: [this.path, '/_next', '/api', '/icon.svg', '/manifest.webmanifest', '/.well-known' ]
      //   pathRewrite: (path) => path.replace(this.path, ''),

      //   onProxyRes(proxyRes, req, res) {
      //     verbose('onProxyRes proxyRes:', proxyRes)
      //     const location = proxyRes.headers['location'];
      //     verbose('location:', location)
      //     if (location && location.startsWith('/')) {
      //       // Rewrite redirects to stay under the same prefix
      //       proxyRes.headers['location'] = this.path + location;
      //       verbose('🔁 Rewrote redirect location:', location, '→', proxyRes.headers['location']);
      //     }
      //   },
      // };


      // Main route
      webServer.app.use(this.path, createProxyMiddleware(proxyOptions));
      webServer.app.use('/', createProxyMiddleware(proxyOptions));

      // /icon.svg
      // /api/root
      // /manifest.webmanifest

      log('Starting XMPP Agent')

      await this.xmppAgent.start();

      this.xmppAgent.chat = async ({ prompt } = {}) => {
        verbose('XMPP chat received:', prompt);
        try {
          let out = ''
          if (!this.bridge.options.webapp.allowUpdates) {
            out += 'Updates are not allowed.\n'
          } else {
            verbose('lowdefyCode from prompt:', prompt)
            if (!this.state) {
              this.state = new State({
                userId: this.bridge.userId,
                bridgeId: this.bridge._id,
              })
            }
            this.state.bridge.webapp.updatedCode = prompt
            await this.state.save()
            log('Saved updatedCode for bridge:', this.bridge.options.name,
              ', with state:', this.state)

            const lowdefyYaml = this.state.bridge.webapp.updatedCode || this.bridge.options.webapp.defaultCode || fallbackCode
            verbose('lowdefyYaml:', lowdefyYaml)
            await fs.promises.writeFile(filename, lowdefyYaml, 'utf-8');
            verbose('file is written:', filename)
          }
          // FIXME: replace localhost with domain name
          out += `<iframe src="http://localhost:${conf.webServer.port}${this.path}" title="Web App Bridge" width="550" height="600"></iframe>\n`
          return out
        } catch (err) {
          error('Failed to handle XMPP message:', prompt, err);
        }
      };
      log('Started')
    } catch (err) {
      error('Error starting Webapp:', err);
    }
  }

  async sendMessage({ prompt }) {
    if (this.bridge.options.enablePersonal) {
      await this.xmppAgent.xmppClient.sendPersonalMessage({
        recipient: this.bridge.options.recipient,
        prompt,
      });
    }
    if (this.bridge.options.enableRoom) {
      await this.xmppAgent.xmppClient.sendRoomMessage({
        room: this.bridge.options.joinRoom,
        recipient: this.bridge.options.recipientNickname,
        prompt,
        mucHost: conf.xmpp.mucHost,
      });
    }
  }

  async stop() {
    super.stop();

    // FIXME:
    // webServer.removeProxy({
    //   host: this.path,
    // })

    if (!this.lowdefy.killed) {
      this.lowdefy.kill('SIGTERM'); // or 'SIGINT' depending on graceful shutdown
      log('Sent SIGTERM to Lowdefy');
    } else {
      log('Lowdefy is already stopped');
    }

    // NOTE: Keep the server running since it might be used by other bridges
    // webServer.stop();

    this.xmppAgent.stop();
    verbose('Webapp stopped');
  }
}
