import modesl from 'modesl'
import fsExtra from 'fs-extra'
import path from 'path'
import dotenv from 'dotenv'
import fs from 'fs'
import os from 'os'
import { exec } from 'node:child_process'
import { client, xml } from '@xmpp/client'
import FormData from 'form-data';
import axios from 'axios';
import { randomUUID } from 'crypto'
import { NodeSSH } from 'node-ssh'
import nunjucks from 'nunjucks';

import { log, warn, error, Verbose } from '../services.js'
import Connector from './connector.js'
import Bridge from '../models/bridge.js'
import XmppAgent from '../swarm/xmpp-agent.js'
import conf from '../conf.js'

const verbose = Verbose('sd:bridge/phone'); verbose('')

// Allow insecure certificates (without showing warning)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

nunjucks.configure({ autoescape: false })


// NOTE: You should turn off VPN to make it work
const eventSocketTemplate = `
<configuration name="event_socket.conf" description="Socket Client">
  <settings>
    <param name="nat-map" value="false"/>
    <param name="listen-ip" value="0.0.0.0"/>
    <param name="listen-port" value="{{ port }}"/>
    <param name="password" value="{{ password }}"/>
    <param name="apply-inbound-acl" value="localnet.auto"/>
  </settings>
  <acl>
    <node type="allow" cidr="127.0.0.1/32"/>
    <node type="allow" cidr="{{ host }}/24"/>
    <node type="allow" cidr="0.0.0.0/0"/>
  </acl>
</configuration>
`

const dialplanDefaultTemplate =`
<include>
    <extension name="{{ name }}">
      <condition field="destination_number" expression="^({{ name }})$">
        <action application="set" data="absolute_codec_string=PCMU"/>
        <action application="set" data="RECORD_STEREO=true"/>
        <action application="set" data="record_sample_rate=16000"/>
        <action application="set" data="record_channels=1"/>
        <action application="set" data="playback_terminators=#"/>
        <action application="set" data="record_read_only=false"/>
        <action application="set" data="record_write_only=false"/>
        <action application="answer"/>
        <action application="sleep" data="1000"/>
        <!-- <action application="playback" data="ivr/ivr-welcome_to_freeswitch.wav"/> -->
        <!-- <action application="say" data="en current_date pronounced \${strftime(%Y-%m-%d)}"/> -->
        <action application="say" data="en current_time pronounced \${strftime(%H:%M)}"/>
        <action application="park"/>
      </condition>
    </extension>
</include>
`

const dialplanPublicTemplate =`
<include>
  <extension name="{{ name }}_call">
    <condition field="destination_number" expression="^({{ username }})$">
      <action application="answer"/>
      <action application="playback" data="{loops=1}tone_stream://path=\${conf_dir}/tetris.ttml"/>
      <action application="sleep" data="1000"/>
      <action application="park"/>
    </condition>
  </extension>
</include>
`

const directoryUserTemplate = `
<include>
  <user id="{{ number }}">
    <params>
      <param name="password" value="{{ password }}"/>
      <param name="vm-password" value="{{ number }}"/>
    </params>
    <variables>
      <variable name="accountcode" value="{{ number }}"/>
      <variable name="user_context" value="default"/>
      <variable name="effective_caller_id_name" value="Extension {{ number }}"/>
      <variable name="effective_caller_id_number" value="{{ number }}"/>
      <!-- <variable name="outbound_caller_id_name" value="\$\${outbound_caller_name}"/> -->
      <!-- <variable name="outbound_caller_id_number" value="\$\${outbound_caller_id}"/> -->
    </variables>
  </user>
</include>
`

const sipProfileTemplate = `
<include>
  <gateway name="{{ name }}">
    <!-- Replace the values below with your Voip.ms username and password. -->
    <param name="username" value="{{ username }}" />
    <param name="password" value="{{ password }}" />
    <!-- This gateway could be different depending on which switch you are on -->
    <param name="proxy" value="{{ host }}" />
    <param name="realm" value="{{ realm }}" />
    <!-- This should be set to "true" for registration based -->
    <param name="register" value="true" />
    <!-- Voip.ms requires the Remote-Party-Identity Header to be set in the Sip invite for Caller-ID to work right
        DON'T FORGET TO REMOVE ANY CALLER ID INFO IN http://voip.ms->Main Menu->Account Settings->General->CallerID Number
    -->
    <param name="sip_cid_type" value="rpid" />
    <!--Setting in one place is much easier than everywhere you may bridge. You can do this since 2010 Sept 27
       http://jira.freeswitch.org/browse/FS-2722
    -->
  </gateway>
</include>
`

// Make sure the directory exists
try {
  fsExtra.ensureDirSync(conf.phone.recordingsDir);
  log(`Recordings directory ensured at: ${conf.phone.recordingsDir}`);
} catch (error) {
  error(`Failed to create recordings directory: ${error.message}`);
  process.exit(1);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default class Phone extends Connector {
  constructor (args) {
    super(args)
    // const { bridge } = args
    verbose('Phone constructed')

    this.xmppAgent = new XmppAgent({
      agent: {
        options: {
          name: this.bridge.options.name,
          joinRooms: [this.bridge.options.phone.joinRoom],
        },
        userId: this.bridge.userId,
      },
      handleChat: this.bridge.options.phone.enablePersonal,
      handleRooms: this.bridge.options.phone.enableRoom,
    })

    // TODO: move to parent class
    // this.logs = ''
    // this.collectLogs = true
  }

  // TODO: move to parent class
  // async saveLogs () {
  //   try {
  //     const bridgeDoc = await Bridge.findById(this.bridge._id)
  //     if (bridgeDoc) {
  //       bridgeDoc.logs = this.logs
  //       await bridgeDoc.save()
  //       log('Logs saved for bridge:', this.bridge._id, ":", this.bridge.options.name)
  //       // verbose('bridgeDoc:', bridgeDoc)
  //       // verbose('bridgeDoc.logs:', bridgeDoc.logs)
  //     }
  //   } catch (err) {
  //     error('Error saving logs:', err)
  //   }
  // }


  async ensureFreeswitchRunning({ ssh }) {
    // Try to detect if FreeSWITCH is running
    // TODO: make it starting in loop
    const check = await ssh.execCommand('pgrep freeswitch');
    if (check.stdout.trim()) {
      log('FreeSWITCH is already running, PID(s):', check.stdout.trim());
    } else {
      log('FreeSWITCH is not running — starting it now...');

      // You can adapt depending on your setup:
      // Option 1: systemd
      // const start = await ssh.execCommand('sudo systemctl start freeswitch');

      // Option 2 (if running manually)
      const result = await ssh.execCommand(`PATH=\$PATH:${conf.freeswitch.path} nohup freeswitch -nc &`);
      if (result.code === 0 || result.stderr.includes('Backgrounding')) {
        log('Waiting 30 seconds for the freeswitch to start')
        await sleep(30_000)
        log('Finished to wait. Continuing...')
      } else {
        error('Failed to start FreeSWITCH:', result.stderr);
      }
    }
  }

  async putToRemote({ sftp, remotePath, content }) {
    return new Promise((resolve, reject) => {
      const writeStream = sftp.createWriteStream(remotePath);
      writeStream.write(content);
      writeStream.end();
      writeStream.on('close', resolve);
      writeStream.on('error', reject);
    });
  }

  async configure () {
    verbose('Phone configure')
    try {
      const ssh = new NodeSSH()
      await ssh.connect({
        host: conf.freeswitch.sshHost,
        username: conf.freeswitch.sshUsername,
        // privateKey: '/path/to/key'
        password: conf.freeswitch.sshPassword,
      });
      const sftp = await ssh.requestSFTP();
      // verbose('sftp:', sftp)


      verbose('eventSocketTemplate:', eventSocketTemplate)
      const eventSocketRendered = nunjucks.renderString(eventSocketTemplate, {
        host: conf.freeswitch.host,
        port: conf.freeswitch.port,
        password: conf.freeswitch.password,
      });
      verbose('eventSocketRendered:', eventSocketRendered)
      const eventSocketFilename = path.join(conf.freeswitch.configDir,
        `autoload_configs/event_socket.conf.xml`
      );
      await this.putToRemote({
        sftp,
        remotePath: eventSocketFilename,
        content: eventSocketRendered,
      })
      verbose('File saved as:', eventSocketFilename)


      verbose('dialplanDefaultTemplate:', dialplanDefaultTemplate)
      const dialplanDefaultRendered = nunjucks.renderString(dialplanDefaultTemplate, {
        name: this.bridge.options.name,
      });
      verbose('dialplanDefaultRendered:', dialplanDefaultRendered)
      const dialplanDefaultFilename = path.join(conf.freeswitch.configDir,
        `dialplan/default/99_${this.bridge.options.name}.xml`
      );
      await this.putToRemote({
        sftp,
        remotePath: dialplanDefaultFilename,
        content: dialplanDefaultRendered,
      })
      verbose('File saved as:', dialplanDefaultFilename)


      verbose('dialplanPublicTemplate:', dialplanPublicTemplate)
      const dialplanPublicRendered = nunjucks.renderString(dialplanPublicTemplate, {
        name: this.bridge.options.name,
        username: this.bridge.options.phone.username,
      });
      verbose('dialplanPublicRendered:', dialplanPublicRendered)
      const dialplanPublicFilename = path.join(conf.freeswitch.configDir,
        `dialplan/public/99_${this.bridge.options.name}_call.xml`
      );
      await this.putToRemote({
        sftp,
        remotePath: dialplanPublicFilename,
        content: dialplanPublicRendered,
      })
      verbose('File saved as:', dialplanPublicFilename)


      verbose('directoryUserTemplate:', directoryUserTemplate)
      const directoryUserRendered = nunjucks.renderString(directoryUserTemplate, {
        name: this.bridge.options.name,
        number: this.bridge.options.phone.directoryNumber,
        password: this.bridge.options.phone.directoryPassword,
      });
      verbose('directoryUserRendered:', directoryUserRendered)
      const directoryUserFilename = path.join(conf.freeswitch.configDir,
        `directory/default/${this.bridge.options.name}.xml`
      );
      await this.putToRemote({
        sftp,
        remotePath: directoryUserFilename,
        content: directoryUserRendered,
      })
      verbose('File saved as:', directoryUserFilename)


      verbose('sipProfileTemplate:', sipProfileTemplate)
      const sipProfileRendered = nunjucks.renderString(sipProfileTemplate, {
        name: this.bridge.options.name,
        username: this.bridge.options.phone.username,
        password: this.bridge.options.phone.password,
        host: this.bridge.options.phone.host,
        realm: this.bridge.options.phone.realm,
      });
      verbose('sipProfileRendered:', sipProfileRendered)
      const sipProfileFilename = path.join(conf.freeswitch.configDir,
        `/sip_profiles/external/${this.bridge.options.name}.xml`
      );
      await this.putToRemote({
        sftp,
        remotePath: sipProfileFilename,
        content: sipProfileRendered,
      })
      verbose('File saved as:', sipProfileFilename)

      if (conf.freeswitch.ensureRunning) {
        await this.ensureFreeswitchRunning({ ssh })
      }

      sftp.end();
      ssh.dispose();
      verbose('DONE')
    } catch (err) {
      error('Error configuring the phone:', err)
      throw err
    }
  }

  async removeFiles({ sftp, filePaths }) {
    for (const filePath of filePaths) {
      try {
        await new Promise((resolve, reject) => {
          sftp.unlink(filePath, (err) => (err ? reject(err) : resolve()));
        });
        log(`Removed: ${filePath}`);
      } catch (err) {
        error(`Failed to remove ${filePath}:`, err.message);
      }
    }

  }

  async deconfigure () {
    verbose('Phone configure')
    try {
      const ssh = new NodeSSH()
      await ssh.connect({
        host: conf.freeswitch.sshHost,
        username: conf.freeswitch.sshUsername,
        // privateKey: '/path/to/key'
        password: conf.freeswitch.sshPassword,
      });
      const sftp = await ssh.requestSFTP();
      // verbose('sftp:', sftp)

      const filePaths = [
        // `autoload_configs/event_socket.conf.xml`, // NOTE: this config is one for all
        `dialplan/default/99_${this.bridge.options.name}.xml`,
        `dialplan/public/99_${this.bridge.options.name}_call.xml`,
        `directory/default/${this.bridge.options.name}.xml`,
        `sip_profiles/external/${this.bridge.options.name}.xml`,
      ].map(p => path.join(conf.freeswitch.configDir, p));
      // log('Removing path:', filePaths)
      await this.removeFiles({ sftp, filePaths, })

      if (conf.freeswitch.shutdown) {
        const deployedPhones = await Bridge.countDocuments({ deployed: true, connector: 'phone' });
        verbose('deployedPhones:', deployedPhones)
        if (deployedPhones === 0) {
          log('No more deployed phones left. Shutting down freeswitch...')
          const result = await ssh.execCommand('killall freeswitch');
          if (result.stderr) {
            error('Error:', result.stderr.trim());
          } else {
            log('Freeswitch is down. Output:', result.stdout.trim());
          }
        } else {
          log('There are other deployed phones left. Keeping freeswitch running...')
        }
      }

      sftp.end();
      ssh.dispose();
      verbose('DONE')
    } catch (err) {
      error('Error configuring the phone:', err)
      throw err
    }
  }

  async start () {
    super.start()
    verbose('Phone started')
    try {
      this.freeswitchOnline = false;
      this.parkUuid = null
      this.sendSmsCmdPrefix = null

      await this.configure()

      // Create a FreeSWITCH connection
      log(`Connecting to FreeSwitch on ${conf.freeswitch.host}:${conf.freeswitch.port}`);
      verbose('conf.freeswitch.password:', conf.freeswitch.password)
      this.conn = new modesl.Connection(conf.freeswitch.host, conf.freeswitch.port, conf.freeswitch.password, async () => {
        log('Connected to FreeSWITCH');
        this.freeswitchOnline = true;

        // Subscribe to all events
        this.conn.subscribe(['ALL'], () => {
          log('Subscribed to FreeSWITCH events');
        });

        // Set up event handler for inbound calls
        this.conn.on('esl::event::CHANNEL_ANSWER::*', async (event) => {
          log('even handler for inbound calls, event:', event)
          await handleCall(event);
        });


        if (conf.freeswitch.reloadxml) {
          this.conn.api('reloadxml', (res) => {
            log(`> reloadxml: ${res.getBody()}`);
          });
          await sleep(3000)
        }

        if (conf.freeswitch.restartSofia) {
          this.conn.api('sofia profile internal restart', (res) => {
            const body = res.getBody()
            log(`> sofia profile internal restart: ${body}`);
            if (body.includes('Invalid Profile')) {
              log('Fixing invalid profile...')
              this.conn.api('sofia profile internal start', (res) => {
                log(`> sofia profile internal start: ${res.getBody()}`);
              });
            }
          });
          await sleep(3000)

          this.conn.api('sofia profile external restart', (res) => {
            const body = res.getBody()
            log(`> sofia profile external restart: ${body}`);
            if (body.includes('Invalid Profile')) {
              log('Fixing invalid profile...')
              this.conn.api('sofia profile external start', (res) => {
                log(`> sofia profile external start: ${res.getBody()}`);
              });
            }
          });
          await sleep(3000)

          this.conn.api('sofia status', (res) => {
            log(`> sofia status: ${res.getBody()}`);
          });
        }
      });

      // Handle connection errors
      this.conn.on('error', (err) => {
        error('FreeSWITCH connection error:', err);
      });

      this.conn.on('esl::connect', async () => {
        log('ESL connected');
        try {
        } catch (err) {
          error('Error configuring freeswitch on connect:', err)
        }
      });


      this.conn.on('esl::event::*::*', (event) => {
        const eventName = event.getHeader('Event-Name');
        log(`Event name received: ${eventName}`);
        if (!eventName) {
          verbose('event:', event)
        }
        // log('event:', JSON.stringify(event))

        // For CUSTOM events, show the subclass
        if (eventName === 'CUSTOM') {
          log(`  Subclass: ${event.getHeader('Event-Subclass')}`);
        }

        // For call-related events, show more details
        if (['CHANNEL_CREATE', 'CHANNEL_ANSWER', 'CHANNEL_EXECUTE', 'CHANNEL_HANGUP',
             'CHANNEL_DESTROY', 'DTMF'].includes(eventName)) {
          log(`  UUID: ${event.getHeader('Unique-ID')}`);
          log(`  From: ${event.getHeader('Caller-Caller-ID-Number') || 'unknown'}`);
          log(`  To: ${event.getHeader('Caller-Destination-Number') || 'unknown'}`);
          log(`  Direction: ${event.getHeader('Call-Direction') || 'unknown'}`);
        }
      });

      this.conn.on('esl::event::CHANNEL_CREATE::*', (event) => {
        const uuid = event.getHeader('Unique-ID');
        const caller = event.getHeader('Caller-Caller-ID-Number');
        const callee = event.getHeader('Caller-Destination-Number');
        log(`New call detected: ${caller} → ${callee} (UUID: ${uuid})`);

        if (callee && callee === this.bridge.options.name) {
          log(`Inbound named ${this.bridge.options.name} call detected`);
        } else if (callee && callee === this.bridge.options.phone.username) {
          log(`Inbound external ${this.bridge.options.phone.username}@${this.bridge.options.phone.host} call detected`);
        }
      });

      this.conn.on('esl::event::CHANNEL_PARK::*', async (event) => {
        log('--------------PARK--------------')
        const uuid = event.getHeader('Unique-ID');
        this.parkUuid = uuid
        const callerNumber = event.getHeader('Caller-ANI');
        log(`Parking call from ${callerNumber} with UUID: ${uuid}`);

        log('phone:', this.bridge.options.phone)
        log('welcomeMessage:', this.bridge.options.phone.welcomeMessage)
        await ttsToFreeswitch({
          text: this.bridge.options.phone.welcomeMessage,
          parkUuid: this.parkUuid,
        })
      });

      // Add this to your connection event handlers
      this.conn.on('esl::event::CHANNEL_DESTROY::*', (event) => {
        log('Call ended:', event.getHeader('Unique-ID'));
        this.parkUuid = null
      });

      this.conn.on('esl::event::CUSTOM::*', (event) => {
        const eventSubclass = event.getHeader('Event-Subclass');
        if (eventSubclass) {
          log('Custom event:', eventSubclass);
        }
      });

      const removeFile = async (filePath) => {
        try {
          await fs.promises.unlink(filePath);
          log(`Successfully removed file: ${filePath}`);
        } catch (err) {
          if (err.code === 'ENOENT') {
            log(`File not found: ${filePath}`);
          } else {
            error(`Error removing file: ${err.message}`);
          }
        }
      }

      const handleCall = async (event) => {
        const uuid = event.getHeader('Unique-ID');
        const callerNumber = event.getHeader('Caller-ANI');
        log(`Incoming call from ${callerNumber} with UUID: ${uuid}`);

        // Create a new recording session with proper format settings
        const recordingFile = path.join(conf.phone.recordingsDir, `${uuid}.wav`);
        const recordingExternalFile = path.join(conf.phone.recordingsExternalDir, `${uuid}.wav`);

        // Start the recording - provide full path
        log(`Starting recording for call ${uuid} to file ${recordingFile}`);
        await executeCommand(uuid, 'record', `${recordingExternalFile} ${conf.phone.recordMaxSec}`);

        // Set up a listener for when the call ends
        this.conn.once('esl::event::CHANNEL_HANGUP::' + uuid, () => {
          log(`Call ${uuid} ended, stopping recording`);

          // Explicitly stop the recording
          this.conn.api('uuid_record', `${uuid} stop all`, (res) => {
            log(`Recording stopped for ${uuid}: ${res.getBody()}`);
          });
        });
      }

      this.conn.on('esl::event::RECORD_STOP::*', (event) => {
        const recordExternalPath = event.getHeader('Record-File-Path');
        const uuid = event.getHeader('Unique-ID');
        log(`Recording stopped for call ${uuid}, file: ${recordExternalPath}`);

        if (recordExternalPath) {
          // Process the recording file that FreeSWITCH created
          setTimeout(() => {
            processRecording(recordExternalPath, uuid, '');
          }, 2000);
        }
      });

      this.conn.on('esl::event::DTMF::*', (event) => {
        const digit = event.getHeader('DTMF-Digit');
        const uuid = event.getHeader('Unique-ID');
        log(`----> DTMF: ${digit}, uuid: ${uuid}`);
        if (digit === '#') {
          log('User pressed #');

          const recordPath = event.getHeader('Record-File-Path');
          log(`Keep recording for call ${uuid}, file: ${recordPath}`);

          // Explicitly stop the recording
          this.conn.api('uuid_record', `${uuid} stop all`, (res) => {
            log(`Recording stopped for ${uuid}: ${res.getBody()}`);
          });
        }
      })

      const ttsToFreeswitch = async ({ text, parkUuid }) => {
        try {
          const ttsFilename = `tts_${randomUUID()}.wav`;
          const ttsFile = path.join(conf.phone.recordingsDir, ttsFilename);
          const ttsExternalFile = path.join(conf.phone.recordingsExternalDir, ttsFilename);

          log('🔊 Generating TTS:', { ttsFile, ttsExternalFile });

          // log('conf.speech:', conf.speech)
          log('url:', conf.speech.url)
          log('model:', conf.speech.ttsModel)
          log('voice:', conf.speech.ttsVoice)
          log('text:', text)
          // Generate TTS with Speaches.ai
          const response = await axios.post(
            `${conf.speech.url}/v1/audio/speech`,
            {
              input: text,
              model: conf.speech.ttsModel,
              voice: conf.speech.ttsVoice,
              response_format: 'wav',
            },
            {
              responseType: 'arraybuffer',
              headers: { 'Content-Type': 'application/json' },
            }
          );

          // Save audio to file
          await fs.promises.writeFile(ttsFile, Buffer.from(response.data));
          log('TTS generation complete:', ttsFile);

          // Play it via FreeSWITCH
          await executeCommand(parkUuid, 'playback', ttsExternalFile);

          // Optionally delete file after playback
          if (!conf.phone.saveTts) {
            await sleep(1000);
            await removeFile(ttsFile);
            log('Temporary TTS file removed');
          }
        } catch (err) {
          error('TTS generation failed:', err);
        }
      };

      const executeCommand = async (uuid, command, args) => {
        return new Promise((resolve, reject) => {
          switch (command) {
            case 'playback':
              this.conn.api('uuid_broadcast', `${uuid} ${args} aleg`, (res) => {
                log(`Playback executed for ${uuid}: ${res.getBody()}`);
                resolve()
              });
              break;

            case 'record':
              this.conn.api('uuid_record', `${uuid} start ${args}`, (res) => {
                log(`Recording started for ${uuid}: ${res.getBody()}`);
                verbose(`Recording started for ${uuid}:`, res);
                resolve()
              });
              break;

            case 'set':
              this.conn.api('uuid_setvar', `${uuid} ${args}`, (res) => {
                log(`Variable set for ${uuid}: ${res.getBody()}`);
                resolve()
              });
              break;

            case 'answer':
              this.conn.api('uuid_answer', uuid, (res) => {
                log(`Call answered for ${uuid}: ${res.getBody()}`);
                resolve()
              });
              break;

            default:
              this.conn.api(`uuid_${command}`, `${uuid} ${args}`, (res) => {
                log(`Command ${command} executed for ${uuid}: ${res.getBody()}`);
                resolve()
              });
          }
        })
      }

      const transcriptToText = async (transcriptJson) => {
        if (!Array.isObject(transcriptJson) ) {
          throw new Error("transcriptToText() input must be an array");
        }

        return transcriptJson
          .map(segment => segment.speech)
          .filter(Boolean) // removes any undefined/null/empty strings
          .join(' ');
      }

      const processRecording = async (recordingExternalFile, uuid, callerNumber) => {
        log(`Processing external recording ${recordingExternalFile}`);
        const recordingFile = recordingExternalFile.replace(conf.phone.recordingsExternalDir, conf.phone.recordingsDir)
        log(`Processing recording ${recordingFile}`);

        try {
          // Check if the file exists and has content
          if (await fsExtra.pathExists(recordingFile)) {
            // Show audio details using FFmpeg
            // exec(`ffprobe -v error -show_format -show_streams "${recordingFile}"`, (error, stdout) => {
            //   if (error) {
            //     error(`Error analyzing audio: ${error.message}`);
            //   } else {
            //     log(`Audio file details:\n${stdout}`);
            //   }
            // });

            const stats = await fsExtra.stat(recordingFile);
            if (stats.size === 0) {
              log(`Recording file ${recordingFile} is empty. No transcription needed.`);
              return;
            }
            log(`Recording file exists: ${recordingFile}`);
            log(`File size: ${stats.size} bytes`);

            // Transcribe the audio file
            try {
              const transcript = await transcribeAudio(recordingFile);
              log('Transcript from:', callerNumber, ':', transcript);

              // const text = transcriptToText(JSON.parse(transcript))
              const { text } = transcript
              verbose('text:', text)

              verbose('attempt to save transcript')
              if (conf.phone.saveTranscript) {
                verbose('saving transcript')
                const transcriptFile = recordingFile.replace(/\.wav$/, '.txt');
                await fsExtra.writeFile(transcriptFile, JSON.stringify(transcript));
                log(`Transcription saved to ${transcriptFile}`);
              }
              verbose('attempt to remove recording')
              if (!conf.phone.saveAudio) {
                verbose('removing recording')
                await removeFile(recordingFile);
              }

              if (this.bridge.options.phone.enablePersonal) {
                verbose('sending personal message:', text)
                await this.xmppAgent.xmppClient.sendPersonalMessage({
                  recipient: this.bridge.options.phone.recipient,
                  prompt: text,
                })
              }
              if (this.bridge.options.phone.enableRoom) {
                verbose('sending group message:', text)
                await this.xmppAgent.xmppClient.sendRoomMessage({
                  room: this.bridge.options.phone.joinRoom,
                  recipient: this.bridge.options.phone.recipientNickname,
                  prompt: text,
                  mucHost: conf.xmpp.mucHost,
                })
              }
            } catch (err) {
              error('Error transcribing audio and sending it:', err);
            }
          } else {
            error(`Recording file ${recordingFile} does not exist.`);
          }
        } catch (error) {
          error(`Error processing recording: ${error.message}`);
        }
      }

      // Send audio file to Speaches.ai container for transcription
      const sendToSpeaches = async (filePath) => {
        log(`Sending ${filePath} to Speaches.ai for transcription...`);

        const formData = new FormData();
        formData.append('file', fsExtra.createReadStream(filePath));
        formData.append('model', conf.speech.sttModel);

        try {
          const response = await axios.post(
            `${conf.speech.url}/v1/audio/transcriptions`,
            formData,
            {
              headers: formData.getHeaders(),
              maxBodyLength: Infinity,
              timeout: 300_000 // 5 minutes
            }
          );

          log('Speaches.ai transcription response received.');
          return response.data;
        } catch (error) {
          const msg = error.response
            ? `Speaches.ai error: ${error.response.status} ${error.response.statusText} - ${JSON.stringify(error.response.data)}`
            : `Speaches.ai request failed: ${error.message}`;
          throw new Error(msg);
        }
      }

      const transcribeAudio = async (audioFilePath) => {
        log(`Starting transcription of ${audioFilePath}`);

        try {
          if (!await fsExtra.pathExists(audioFilePath)) {
            throw new Error(`Audio file not found: ${audioFilePath}`);
          }
          const stats = await fsExtra.stat(audioFilePath);
          log(`Audio file size: ${stats.size} bytes`);

          if (stats.size === 0) {
            return 'Empty audio file, no transcription possible.';
          }

          const transcript = await sendToSpeaches(audioFilePath);
          return transcript
        } catch (error) {
          error(`Error during transcription process: ${error.message}`);
          log(`Attempting transcription with original file as fallback...`);

          try {
            const transcript = await sendToSpeaches(audioFilePath);
            return transcript
          } catch (fallbackError) {
            error(`Fallback transcription failed: ${fallbackError.message}`);
            return `Transcription error: ${fallbackError.message}`;
          }
        }
      }

      const extractSIPBody = async (sipMessage) => {
        const parts = sipMessage.split(/\r?\n\r?\n/); // split on blank line
        return parts[2] || '' // sipMessage; // return body or empty if not found
      }

      const extractSIPContentType = async (sipMessage) => {
        const match = sipMessage.match(/^Content-Type:\s*(.+)$/mi);
        return match ? match[1].trim() : null;
      }

      this.conn.on('esl::event::MESSAGE::*', async (event) => {
        try {
          const body = event.getBody();
          const from = event.getHeader('from');
          const to = event.getHeader('to');

          const me = [
            `${this.bridge.options.phone.username}@${this.bridge.options.phone.host}`
            `${this.bridge.options.phone.directoryNumber}@${this.bridge.options.phone.directoryHost}`
          ]

          if (me.includes(from)) {
            log('Skipping SMS from myself, from:', from, `(me=${me})`)
            return
          }

          log(`Received SMS from ${from} to ${to}, body: ${body}`);
          if (me.includes(to)) {
            log('The SMS is for me, to:', to, `(me=${me})`)
            // log("MESSAGE event:", event)
          }

          const sipContentType = extractSIPContentType(body)
          log("sipContentType:", sipContentType)
          if (sipContentType === 'application/im-iscomposing+xml') {
            log("Skipping composing sipContentType:", sipContentType)
            return
          } else if (sipContentType !== 'text/plain') {
            log("Skipping non-textual sipContentType:", sipContentType)
            return
          }

          // Echo the message back using a "chat" API command
          const chatTo=from
          const chatFrom=to
          this.sendSmsCmdPrefix = `chat sip|${chatFrom}|${chatTo}|`

          // const cmd = `${this.sendSmsCmdPrefix}Echo: ${body}`;
          // log(`Sending echo: ${cmd}`);
          // this.conn.api(cmd, (res) => {
          //   log('Echo message sent:', res.getBody());
          // });

          const sipBody = extractSIPBody(body)
          log('sipBody:', sipBody)

          if (this.bridge.options.phone.enablePersonal) {
            await this.xmppAgent.xmppClient.sendPersonalMessage({
              recipient: this.bridge.options.phone.recipient,
              prompt: text,
            })
          }
          if (this.bridge.options.phone.enableRoom) {
            await this.xmppAgent.xmppClient.sendRoomMessage({
              room: this.bridge.options.phone.joinRoom,
              recipient: this.bridge.options.phone.recipientNickname,
              prompt: sipBody,
              mucHost: conf.xmpp.mucHost,
            })
          }
        } catch (err) {
          error('Error processing sms:', err)
        }
      });

      await this.xmppAgent.start()
      this.xmppAgent.chat = async ({ prompt, replyFunc=()=>{} } = {}) => {
        verbose('Phone received chat with prompt:', prompt)
        if (this.freeswitchOnline && this.parkUuid) {
          verbose('ttsToFreeswitch')
          await ttsToFreeswitch({
            text: prompt,
            parkUuid: this.parkUuid,
          })
        }

        if (this.freeswitchOnline && this.sendSmsCmdPrefix) {
          verbose('sendSms')
          const text = prompt.replace(/[\r\n]+/g, ' ')
          const cmd = `${this.sendSmsCmdPrefix}${text}`;
          log(`Sending agentic reply sms: ${cmd}`);
          this.conn.api(cmd, (res) => {
            log('Agentic reply message sent:', res.getBody());
            this.sendSmsCmdPrefix = null
          });
        }
        return ''
      }
    } catch (err) {
      error('Error starting Phone:', err)
    }
  }

  async stop () {
    super.stop()

    log('Disconnecting from FreeSWITCH');
    this.conn.disconnect();
    this.freeswitchOnline = false;
    log('Disconnecting from XMPP');
    this.xmppAgent.stop()
    this.deconfigure()

    verbose('Phone stopped')
  }
}
