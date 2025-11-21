import { spawn } from 'child_process'
import nunjucks from 'nunjucks'
import fs from 'fs/promises'

import { log, warn, error, Verbose } from '../services.js'
import Connector from './connector.js'
import conf from '../conf.js'

const verbose = Verbose('sd:bridge/messengers'); verbose('')

nunjucks.configure({ autoescape: false })

const matterbridgeTemplate = `
[general]
RemoteNickFormat = "{{ general.RemoteNickFormat | default('[{PROTOCOL}] <{NICK}> ') }}"
{% if general.MediaServerUpload %}MediaServerUpload = "{{ general.MediaServerUpload }}"{% endif %}
{% if general.MediaServerDownload %}MediaServerDownload = "{{ general.MediaServerDownload }}"{% endif %}

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
{% for proto in protocols %}
  [[gateway.{{ proto.direction | default('inout') }}]]
  account = "{{ proto.type }}.{{ proto.name }}"
  channel = "{{ proto.channel }}"
{% endfor %}
`

async function generateMatterbridgeToml({ filename, messengers }) {
  try {
    verbose('matterbridgeTemplate:', matterbridgeTemplate)
    verbose('messengers:', messengers)
    const renderedToml = nunjucks.renderString(matterbridgeTemplate, messengers);

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

export default class Messengers extends Connector {
  constructor (args) {
    super(args)
    // const { bridge } = args
    verbose('Messengers constructed')
  }

  async start () {
    super.start()
    verbose('Messengers started')
    try {

    } catch (err) {
      error('Error starting Messengers:', err)
    }

    const filename = `/etc/matterbridge/matterbridge-${this.bridge._id.toString()}.toml`
    await generateMatterbridgeToml({
      filename,
      messengers: this.bridge.options.messengers,
    });

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

