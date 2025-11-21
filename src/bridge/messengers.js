import { spawn } from 'child_process'
import nunjucks from 'nunjucks'
import fs from 'fs/promises'

import { log, warn, error, Verbose } from '../services.js'
import Connector from './connector.js'
import XmppAgent from '../swarm/xmpp-agent.js'
import conf from '../conf.js'

const verbose = Verbose('sd:bridge/messengers'); verbose('')

nunjucks.configure({ autoescape: false })

const matterbridgeTemplate = `
[general]
RemoteNickFormat = "{{ general.RemoteNickFormat | default('[{PROTOCOL}] <{NICK}> ') }}"
{% if general.MediaServerUpload %}MediaServerUpload = "{{ general.MediaServerUpload }}"{% endif %}
{% if general.MediaServerDownload %}MediaServerDownload = "{{ general.MediaServerDownload }}"{% endif %}

# =====================================================
# Protocol: HyperAgency XMPP
# =====================================================
[xmpp.{{ xmpp.Name }}]
Server="{{ xmpp.Server }}"
Jid="{{ xmpp.Jid }}"
Password="{{ xmpp.Password }}"
Nick="{{ xmpp.Nick }}"
Muc="{{ xmpp.Muc }}"
PrefixMessagesWithNick = {{ xmpp.PrefixMessagesWithNick }}
UseTLS = {{ xmpp.UseTLS }}
SkipTLSVerify = {{ xmpp.SkipTLSVerify }}
NoTLS = {{ xmpp.NoTLS }}
RemoteNickFormat = "{{ xmpp.RemoteNickFormat }}"

{% for proto in protocols %}
# =====================================================
# Protocol: {{ proto.type | upper }} ({{ proto.name }})
# =====================================================
[{{ proto.type }}.{{ proto.name }}]
{% if proto.Server %}Server="{{ proto.Server }}"{% endif %}
{% if proto.Login %}Login="{{ proto.Login }}"{% endif %}
{% if proto.Jid %}Jid="{{ proto.Jid }}"{% endif %}
{% if proto.Password %}Password="{{ proto.Password }}"{% endif %}
{% if proto.Token %}Token="{{ proto.Token }}"{% endif %}
{% if proto.Nick %}Nick="{{ proto.Nick }}"{% endif %}
{% if proto.Team %}Team="{{ proto.Team }}"{% endif %}
{% if proto.TenantID %}TenantID="{{ proto.TenantID }}"{% endif %}
{% if proto.ClientID %}ClientID="{{ proto.ClientID }}"{% endif %}
{% if proto.TeamID %}TeamID="{{ proto.TeamID }}"{% endif %}
{% if proto.Muc %}Muc="{{ proto.Muc }}"{% endif %}
{% if proto.SessionFile %}SessionFile="{{ proto.SessionFile }}"{% endif %}
{% if proto.Number %}Number="{{ proto.Number }}"{% endif %}
{% if proto.NickServNick %}NickServNick="{{ proto.NickServNick }}"{% endif %}
{% if proto.NickServPassword %}NickServPassword="{{ proto.NickServPassword }}"{% endif %}
PrefixMessagesWithNick = {{ proto.PrefixMessagesWithNick | default(true) | string }}
UseTLS = {{ proto.UseTLS | default(true) | string }}
SkipTLSVerify = {{ proto.SkipTLSVerify | default(false) | string }}
NoTLS = {{ proto.NoTLS | default(false) | string }}
RemoteNickFormat = "{{ proto.RemoteNickFormat | default('[{PROTOCOL}] <{NICK}> ') }}"
{% endfor %}

[[gateway]]
name = "h9y-gateway"
enable = true
  [[gateway.inout]]
  account = "xmpp.{{ xmpp.Name }}"
  channel = "{{ xmpp.channel }}"
  direction = "{{ xmpp.direction }}"
{% for proto in protocols %}
  [[gateway.{{ proto.direction | default('inout') }}]]
  account = "{{ proto.type }}.{{ proto.name }}"
  channel = "{{ proto.channel }}"
{% endfor %}
`

export default class Messengers extends Connector {
  constructor (args) {
    super(args)
    // const { bridge } = args
    verbose('Messengers constructed')

    this.xmppAgent = new XmppAgent({
      agent: {
        _id: `bridge:${this.bridge._id.toString()}`,
        archetype: `bridge:${this.bridge.connector}`,
        options: {
          name: this.bridge.options.name,
          joinRooms: [this.bridge.options.joinRoom],
        },
        userId: this.bridge.userId,
      },
      // handleChat: this.bridge.options.enablePersonal,
      // handleRooms: this.bridge.options.enableRoom,
      handleChat: true,
      handleRooms: true,
    })
  }

  async generateMatterbridgeToml({ filename }) {
    try {
      verbose('matterbridgeTemplate:', matterbridgeTemplate)
      verbose('messengers:', this.bridge.options.messengers)
      const renderedToml = nunjucks.renderString(matterbridgeTemplate, {
        ...this.bridge.options.messengers,

        xmpp: {
          Name: this.bridge.options.name,

          Server: conf.xmpp.host,
          Jid: `${this.bridge.options.name}@${this.xmppAgent.credentials.host}`,
          Password: this.xmppAgent.credentials.password,

          Nick: this.bridge.options.name,
          Muc: conf.xmpp.mucHost,
          UseTLS: true,
          SkipTLSVerify: true,  // FIXME: verify TLS for better security
          NoTLS: false,
          channel: this.bridge.options.joinRoom,

          direction: this.bridge.options.messengers.direction,
          PrefixMessagesWithNick: this.bridge.options.messengers.PrefixMessagesWithNick,
          RemoteNickFormat: this.bridge.options.messengers.general.RemoteNickFormat,
        },
      });

      // NOTE: Removes empty lines unless the next non-empty line starts with [,
      //       meaning section headers will stay visually separated.
      const compactToml = renderedToml.replace(/^(?!\n*\[)\s*\n/gm, '');
      verbose('compactToml:', compactToml)

      await fs.writeFile(filename, renderedToml, 'utf-8');
      log('Config generated successfully:', filename);
    } catch (err) {
      error('Error generating TOML:', err);
    }
  }

  async start () {
    super.start()
    verbose('Messengers started')
    try {
      // We do not run the agent, we just register it
      // It will be matterbridge connecting to it with our agent credentials
      await this.xmppAgent.registerAgent()


      const filename = `/etc/matterbridge/matterbridge-${this.bridge._id.toString()}.toml`
      await this.generateMatterbridgeToml({ filename });

      const command = '/bin/matterbridge';
      const args = ['-conf', filename];

      this.slog('info', 'Spawning Matterbridge')
      this.matterbridge = spawn(command, args, {
        // stdio: 'inherit'
      });

      // Handle errors
      this.matterbridge.on('error', (err) => {
        error('Failed to start Matterbridge:', err);
        this.slog('error', 'Failed to start Matterbridge', {
          error: err.toString()
        })
      });
      // Handle exit
      this.matterbridge.on('exit', async (code, signal) => {
        if (code !== null) {
          log(`Matterbridge exited with code ${code}`);
          this.slog('warn', `Matterbridge exited with code ${code}`, {
            code, signal,
          })
        } else {
          log(`Matterbridge was killed by signal ${signal}`);
          this.slog('warn', `Matterbridge was killed by signal ${signal}`, {
            code, signal,
          })
        }
      });
      // Capture stdout
      this.matterbridge.stdout.on('data', (data) => {
        const text = data.toString();
        log('stdout:', text);
        this.slog('info', text, { channel: 'stdout' })
      });
      // Capture stderr
      this.matterbridge.stderr.on('data', (data) => {
        const text = data.toString();
        warn('stderr:', text);
        this.slog('warn', text, { channel: 'stderr' })
      });

      this.slog('debug', 'Bridge started')
    } catch (err) {
      error('Error starting Messengers:', err)
    }
  }

  async stop () {
    super.stop()
    verbose('Messengers stopped')

    if (!this.matterbridge.killed) {
      this.matterbridge.kill('SIGTERM'); // or 'SIGINT' depending on graceful shutdown
      log('Sent SIGTERM to Matterbridge');
    } else {
      log('Matterbridge is already stopped');
    }
    this.slog('debug', 'Bridge stopped')
  }
}

