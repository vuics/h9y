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
PrefixMessagesWithNick = {{ proto.PrefixMessagesWithNick | default(true) | string }}
UseTLS = {{ proto.UseTLS | default(true) | string }}
SkipTLSVerify = {{ proto.SkipTLSVerify | default(false) | string }}
NoTLS = {{ proto.NoTLS | default(false) | string }}
RemoteNickFormat = "{{ proto.RemoteNickFormat | default('[{PROTOCOL}] <{NICK}> ') }}"
{% endfor %}

{% for gw in gateways %}
# =====================================================
# Gateway: {{ gw.name }}
# =====================================================
[[gateway]]
name = "{{ gw.name }}"
enable = {{ gw.enable | default(true) | string }}
{% for io in gw.inout %}
  [[gateway.inout]]
  account = "{{ io.account }}"
  channel = "{{ io.channel }}"
  direction = "{{ io.direction | default('inout') }}"
{% endfor %}
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

    // FIXME:
    // this.collectLogs = true
    // this.logs = '';

    this.matterbridge = spawn(command, args, {
      // stdio: 'inherit'
    });

    // setTimeout(async () => {
    //   await this.saveLogs()
    //   this.collectLogs = false
    // }, 10000)

    // Handle errors
    this.matterbridge.on('error', (err) => {
      error('Failed to start matterbridge:', err);
    });
    // Handle exit
    this.matterbridge.on('exit', async (code, signal) => {
      if (code !== null) {
        log(`Matterbridge exited with code ${code}`);
      } else {
        log(`Matterbridge was killed by signal ${signal}`);
      }
      // await this.saveLogs()
    });
    // Capture stdout
    this.matterbridge.stdout.on('data', (data) => {
      // FIXME:
      // if (this.collectLogs) {
      //   const text = data.toString();
      //   this.logs += text;
      //   console.log('stdout:', text); // optional: still print to console
      // }
      const text = data.toString();
      console.log('stdout:', text); // optional: still print to console
    });
    // Capture stderr
    this.matterbridge.stderr.on('data', (data) => {
      // FIXME:
      // if (this.collectLogs) {
      //   const text = data.toString();
      //   this.logs += text;
      //   console.error('stderr:', text); // optional: still print to console
      // }
      const text = data.toString();
      console.error('stderr:', text); // optional: still print to console
    });
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
  }
}

