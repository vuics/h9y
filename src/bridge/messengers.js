import { spawn } from 'child_process'
import nunjucks from 'nunjucks'
import fs from 'fs/promises'

import { log, warn, error, Verbose } from '../services.js'
import Connector from './connector.js'
import Bridge from '../models/bridge.js'
import conf from '../conf.js'

const verbose = Verbose('sd:bridge/messengers'); verbose('')


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
    const compactToml = renderedToml.replace(/^\s*$/gm, '');  // Remove all empty lines
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

    const filename = '/etc/matterbridge/matterbridge.toml'
    await generateMatterbridgeToml({
      filename,
      messengers: this.bridge.options.messengers,
    });

    const command = '/bin/matterbridge';
    const args = ['-conf', filename];
    let logs = '';

    this.matterbridge = spawn(command, args, {
      // stdio: 'inherit'
    });
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
      const bridgeDoc = await Bridge.findById(this.bridge._id)
      if (bridgeDoc) {
        bridgeDoc.logs = logs
        await bridgeDoc.save()
        verbose('bridgeDoc:', bridgeDoc)
        verbose('bridgeDoc.logs:', bridgeDoc.logs)
      }
    });
    // Capture stdout
    this.matterbridge.stdout.on('data', (data) => {
      const text = data.toString();
      logs += text;
      console.log('stdout:', text); // optional: still print to console
    });
    // Capture stderr
    this.matterbridge.stderr.on('data', (data) => {
      const text = data.toString();
      logs += text;
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

