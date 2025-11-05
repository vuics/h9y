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

import { log, warn, error, Verbose } from '../services.js'
import Connector from './connector.js'
import Bridge from '../models/bridge.js'

// FIXME: exclude bool, json, num, arr
import conf, { bool, json, num, arr } from '../conf.js'

const verbose = Verbose('sd:bridge/phone'); verbose('')


// Allow insecure certificates (without showing warning)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// FIXME: move to conf
//
// Configuration variables
const FREESWITCH_HOST = process.env.FREESWITCH_HOST || '192.168.50.68';
// const FREESWITCH_HOST = process.env.FREESWITCH_HOST || '127.0.0.1';
// const FREESWITCH_PORT = num(process.env.FREESWITCH_PORT || 8021);
const FREESWITCH_PORT = num(process.env.FREESWITCH_PORT || 8022);
const FREESWITCH_PASSWORD = process.env.FREESWITCH_PASSWORD || 'ClueCon';

// const RECORDINGS_DIR = process.env.RECORDINGS_DIR || path.join(__dirname, 'recordings');
// /opt/app/src/bridge/recordings/
const RECORDINGS_DIR = process.env.RECORDINGS_DIR || path.join(new URL('.', import.meta.url).pathname, 'recordings');
const RECORDINGS_EXTERNAL_DIR = process.env.RECORDINGS_EXTERNAL_DIR || '/Users/artemarakcheev/workspace/vuics/self-developing/tmp/recordings'


const RECORD_MAX_SEC = num(process.env.RECORD_MAX_SEC || 3600)

// const SAVE_TRANSCRIPT = bool(process.env.SAVE_TRANSCRIPT || false)
// const SAVE_NORMALIZATION = bool(process.env.SAVE_NORMALIZATION || false)
// const SAVE_RECORDING = bool(process.env.SAVE_RECORDING || false)
// const SAVE_TTS_FILE = bool(process.env.SAVE_TTS_FILE || false)
const SAVE_TRANSCRIPT = bool(process.env.SAVE_TRANSCRIPT || true)
const SAVE_NORMALIZATION = bool(process.env.SAVE_NORMALIZATION || true)
const SAVE_RECORDING = bool(process.env.SAVE_RECORDING || true)
const SAVE_TTS_FILE = bool(process.env.SAVE_TTS_FILE || true)

const WHISPER_MODEL = process.env.WHISPER_MODEL || 'tiny' // Use tiny model for speed (options: tiny, base, small, medium, large)
const WHISPER_LANGUAGE = process.env.WHISPER_LANGUAGE || 'auto' // Auto-detect language
// const TTS_ENGINE = process.env.TTS_ENGINE || "gtts"    // options "say" or "gtts"
const SMS_ME = arr(process.env.SMS_ME || '9639@192.168.50.223,450905@paris1.voip.ms')
// const SMS_ME = ['selfdev-voip@192.168.50.223', '450905@paris1.voip.ms']
// const SMS_ME = ['1000@192.168.50.223', '450905@paris1.voip.ms']

// Configuration
const config = {
  enable: bool(process.env.XMPP_ENABLE || true),
  service: process.env.XMPP_SERVICE || `xmpp://selfdev-prosody.dev.local:5222`,
  domain: process.env.XMPP_DOMAIN || 'selfdev-prosody.dev.local',
  mucDomain: process.env.XMPP_MUC_DOMAIN || 'conference.selfdev-prosody.dev.local',

  // jid: process.env.XMPP_JID || 'art@selfdev-prosody.dev.local',
  // password: process.env.XMPP_PASSWORD || '123',
  // botJid: process.env.XMPP_BOT_JID || 'assist@selfdev-prosody.dev.local',
  jid: process.env.XMPP_JID || 'voip@selfdev-prosody.dev.local',
  // password: process.env.XMPP_PASSWORD || 'V01p-Sec_ReT-jfk',
  password: 'V01p-Sec_ReT-jfk',
  botJid: process.env.XMPP_BOT_JID || 'artemarakcheev@selfdev-prosody.dev.local',

  botNickname: process.env.XMPP_BOT_NICKNAME || 'assist',
  groupChatRoom: process.env.XMPP_GROUP_CHAT_ROOM || 'voip',
  enablePersonalMessage: bool(process.env.XMPP_ENABLE_PERSONAL_MESSAGE || false),
  enableGroupChat: bool(process.env.XMPP_ENABLE_GROUP_CHAT || true),
};
console.log('config:', config)

const SPEACHES_BASE_URL = process.env.SPEACHES_BASE_URL || 'http://selfdev-speech.dev.local:8372';
const TRANSCRIPTION_MODEL_ID = process.env.TRANSCRIPTION_MODEL_ID || 'Systran/faster-distil-whisper-small.en';
const SPEECH_MODEL_ID = process.env.SPEECH_MODEL_ID || 'speaches-ai/Kokoro-82M-v1.0-ONNX'
const VOICE_ID = process.env.VOICE_ID || 'af_heart'



// Make sure the directory exists
try {
  fsExtra.ensureDirSync(RECORDINGS_DIR);
  console.log(`Recordings directory ensured at: ${RECORDINGS_DIR}`);
} catch (error) {
  console.error(`Failed to create recordings directory: ${error.message}`);
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
    // this.logs = ''
    // this.collectLogs = true
  }

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

  async start () {
    super.start()
    verbose('Phone started')
    try {
      this.freeswitchOnline = false;
      this.parkUuid = null
      this.sendSmsCmdPrefix = null
      this.xmppOnline = false;

      // Create a FreeSWITCH connection
      console.log(`Connecting to FreeSwitch on ${FREESWITCH_HOST}:${FREESWITCH_PORT}`);
      // verbose('FREESWITCH_PASSWORD:', FREESWITCH_PASSWORD)
      this.conn = new modesl.Connection(FREESWITCH_HOST, FREESWITCH_PORT, FREESWITCH_PASSWORD, () => {
        console.log('Connected to FreeSWITCH');
        this.freeswitchOnline = true;

        // Subscribe to all events
        this.conn.subscribe(['ALL'], () => {
          console.log('Subscribed to FreeSWITCH events');
        });

        // Set up event handler for inbound calls
        this.conn.on('esl::event::CHANNEL_ANSWER::*', async (event) => {
          console.log('even handler for inbound calls, event:', event)
          await handleCall(event);
        });

      });

      // Handle connection errors
      this.conn.on('error', (error) => {
        console.error('FreeSWITCH connection error:', error);
      });

      this.conn.on('esl::connect', () => {
        console.log('ESL connected');
      });

      this.conn.on('esl::event::*::*', (event) => {
        // verbose('event:', event)
        const eventName = event.getHeader('Event-Name');
        console.log(`Event name received: ${eventName}`);
        // console.log('event:', JSON.stringify(event))

        // For CUSTOM events, show the subclass
        if (eventName === 'CUSTOM') {
          console.log(`  Subclass: ${event.getHeader('Event-Subclass')}`);
        }

        // For call-related events, show more details
        if (['CHANNEL_CREATE', 'CHANNEL_ANSWER', 'CHANNEL_EXECUTE', 'CHANNEL_HANGUP',
             'CHANNEL_DESTROY', 'DTMF'].includes(eventName)) {
          console.log(`  UUID: ${event.getHeader('Unique-ID')}`);
          console.log(`  From: ${event.getHeader('Caller-Caller-ID-Number') || 'unknown'}`);
          console.log(`  To: ${event.getHeader('Caller-Destination-Number') || 'unknown'}`);
          console.log(`  Direction: ${event.getHeader('Call-Direction') || 'unknown'}`);
        }
      });

      this.conn.on('esl::event::CHANNEL_CREATE::*', (event) => {
        const uuid = event.getHeader('Unique-ID');
        const caller = event.getHeader('Caller-Caller-ID-Number');
        const callee = event.getHeader('Caller-Destination-Number');
        console.log(`New call detected: ${caller} → ${callee} (UUID: ${uuid})`);

        if (callee && callee === 'voicemail') {
          console.log('Voicemail call detected');

          // FIXME: the callee is hardcodded, make a setting
        } else if (callee && callee === '450905') {
          console.log('Inbound 450905@VoIP.ms call detected');
        }
      });

      this.conn.on('esl::event::CHANNEL_PARK::*', async (event) => {
        console.log('--------------PARK--------------')
        const uuid = event.getHeader('Unique-ID');
        this.parkUuid = uuid
        const callerNumber = event.getHeader('Caller-ANI');
        console.log(`Parking call from ${callerNumber} with UUID: ${uuid}`);

        await ttsToFreeswitch({
          text: `Welcome to the ${config.botNickname} agent. Voice your prompt and press hashtag.`,
          parkUuid: this.parkUuid,
        })
      });

      // Add this to your connection event handlers
      this.conn.on('esl::event::CHANNEL_DESTROY::*', (event) => {
        console.log('Call ended:', event.getHeader('Unique-ID'));
        this.parkUuid = null
      });

      this.conn.on('esl::event::CUSTOM::*', (event) => {
        const eventSubclass = event.getHeader('Event-Subclass');
        if (eventSubclass) {
          console.log('Custom event:', eventSubclass);
        }
      });

      const removeFile = async (filePath) => {
        try {
          await fs.promises.unlink(filePath);
          console.log(`Successfully removed file: ${filePath}`);
        } catch (err) {
          if (err.code === 'ENOENT') {
            console.log(`File not found: ${filePath}`);
          } else {
            console.error(`Error removing file: ${err.message}`);
          }
        }
      }

      const handleCall = async (event) => {
        const uuid = event.getHeader('Unique-ID');
        const callerNumber = event.getHeader('Caller-ANI');
        console.log(`Incoming call from ${callerNumber} with UUID: ${uuid}`);

        // Create a new recording session with proper format settings
        const recordingFile = path.join(RECORDINGS_DIR, `${uuid}.wav`);
        const recordingExternalFile = path.join(RECORDINGS_EXTERNAL_DIR, `${uuid}.wav`);

        // Start the recording - provide full path
        console.log(`Starting recording for call ${uuid} to file ${recordingFile}`);
        await executeCommand(uuid, 'record', `${recordingExternalFile} ${RECORD_MAX_SEC}`);

        // Set up a listener for when the call ends
        this.conn.once('esl::event::CHANNEL_HANGUP::' + uuid, () => {
          console.log(`Call ${uuid} ended, stopping recording`);

          // Explicitly stop the recording
          this.conn.api('uuid_record', `${uuid} stop all`, (res) => {
            console.log(`Recording stopped for ${uuid}: ${res.getBody()}`);
          });
        });
      }

      this.conn.on('esl::event::RECORD_STOP::*', (event) => {
        const recordExternalPath = event.getHeader('Record-File-Path');
        const uuid = event.getHeader('Unique-ID');
        console.log(`Recording stopped for call ${uuid}, file: ${recordExternalPath}`);

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
        console.log(`----> DTMF: ${digit}, uuid: ${uuid}`);
        if (digit === '#') {
          console.log('User pressed #');

          const recordPath = event.getHeader('Record-File-Path');
          console.log(`Keep recording for call ${uuid}, file: ${recordPath}`);

          // Explicitly stop the recording
          this.conn.api('uuid_record', `${uuid} stop all`, (res) => {
            console.log(`Recording stopped for ${uuid}: ${res.getBody()}`);
          });
        }
      })

      const ttsToFreeswitch = async ({ text, parkUuid }) => {
        try {
          const ttsFilename = `tts_${randomUUID()}.wav`;
          const ttsFile = path.join(RECORDINGS_DIR, ttsFilename);
          const ttsExternalFile = path.join(RECORDINGS_EXTERNAL_DIR, ttsFilename);

          console.log('🔊 Generating TTS:', { ttsFile, ttsExternalFile });

          // Generate TTS with Speaches.ai
          const response = await axios.post(
            `${SPEACHES_BASE_URL}/v1/audio/speech`,
            {
              input: text,
              model: SPEECH_MODEL_ID,
              voice: VOICE_ID,
              response_format: 'wav',
            },
            {
              responseType: 'arraybuffer',
              headers: { 'Content-Type': 'application/json' },
            }
          );

          // Save audio to file
          await fs.promises.writeFile(ttsFile, Buffer.from(response.data));
          console.log('TTS generation complete:', ttsFile);

          // Play it via FreeSWITCH
          await executeCommand(parkUuid, 'playback', ttsExternalFile);

          // Optionally delete file after playback
          if (!SAVE_TTS_FILE) {
            await sleep(1000);
            await removeFile(ttsFile);
            console.log('Temporary TTS file removed');
          }
        } catch (err) {
          console.error('TTS generation failed:', err);
        }
      };

      const executeCommand = async (uuid, command, args) => {
        return new Promise((resolve, reject) => {
          switch (command) {
            case 'playback':
              this.conn.api('uuid_broadcast', `${uuid} ${args} aleg`, (res) => {
                console.log(`Playback executed for ${uuid}: ${res.getBody()}`);
                resolve()
              });
              break;

            case 'record':
              this.conn.api('uuid_record', `${uuid} start ${args}`, (res) => {
                console.log(`Recording started for ${uuid}: ${res.getBody()}`);
                verbose(`Recording started for ${uuid}:`, res);
                resolve()
              });
              break;

            case 'set':
              this.conn.api('uuid_setvar', `${uuid} ${args}`, (res) => {
                console.log(`Variable set for ${uuid}: ${res.getBody()}`);
                resolve()
              });
              break;

            case 'answer':
              this.conn.api('uuid_answer', uuid, (res) => {
                console.log(`Call answered for ${uuid}: ${res.getBody()}`);
                resolve()
              });
              break;

            default:
              this.conn.api(`uuid_${command}`, `${uuid} ${args}`, (res) => {
                console.log(`Command ${command} executed for ${uuid}: ${res.getBody()}`);
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
        console.log(`Processing external recording ${recordingExternalFile}`);
        const recordingFile = recordingExternalFile.replace(RECORDINGS_EXTERNAL_DIR, RECORDINGS_DIR)
        console.log(`Processing recording ${recordingFile}`);

        try {
          // Check if the file exists and has content
          if (await fsExtra.pathExists(recordingFile)) {
            // Show audio details using FFmpeg
            // exec(`ffprobe -v error -show_format -show_streams "${recordingFile}"`, (error, stdout) => {
            //   if (error) {
            //     console.error(`Error analyzing audio: ${error.message}`);
            //   } else {
            //     console.log(`Audio file details:\n${stdout}`);
            //   }
            // });

            const stats = await fsExtra.stat(recordingFile);
            if (stats.size === 0) {
              console.log(`Recording file ${recordingFile} is empty. No transcription needed.`);
              return;
            }
            console.log(`Recording file exists: ${recordingFile}`);
            console.log(`File size: ${stats.size} bytes`);

            // Transcribe the audio file
            try {
              const transcript = await transcribeAudio(recordingFile);
              console.log('Transcript from:', callerNumber, ':', transcript);

              // const text = transcriptToText(JSON.parse(transcript))
              const { text } = transcript
              verbose('text:', text)

              verbose('attempt to save transcript')
              if (SAVE_TRANSCRIPT) {
                verbose('saving transcript')
                const transcriptFile = recordingFile.replace(/\.wav$/, '.txt');
                await fsExtra.writeFile(transcriptFile, JSON.stringify(transcript));
                console.log(`Transcription saved to ${transcriptFile}`);
              }
              verbose('attempt to remove recording')
              if (!SAVE_RECORDING) {
                verbose('removing recording')
                await removeFile(recordingFile);
              }

              console.log('xmppOnline:', this.xmppOnline)
              if (this.xmppOnline && config.enablePersonalMessage) {
                verbose('sending personal message:', text)
                await sendPersonalMessage({ message: text });
              }
              if (this.xmppOnline && config.enableGroupChat) {
                verbose('sending group message:', text)
                await sendGroupChatMessage({ message: text });
              }
            } catch (error) {
              console.error(`Error transcribing audio and sending it: ${error.message}`);
            }
          } else {
            console.error(`Recording file ${recordingFile} does not exist.`);
          }
        } catch (error) {
          console.error(`Error processing recording: ${error.message}`);
        }
      }

      // Send audio file to Speaches.ai container for transcription
      const sendToSpeaches = async (filePath) => {
        console.log(`Sending ${filePath} to Speaches.ai for transcription...`);

        const formData = new FormData();
        formData.append('file', fsExtra.createReadStream(filePath));
        formData.append('model', TRANSCRIPTION_MODEL_ID);

        try {
          const response = await axios.post(
            `${SPEACHES_BASE_URL}/v1/audio/transcriptions`,
            formData,
            {
              headers: formData.getHeaders(),
              maxBodyLength: Infinity,
              timeout: 300_000 // 5 minutes
            }
          );

          console.log('Speaches.ai transcription response received.');
          return response.data;
        } catch (error) {
          const msg = error.response
            ? `Speaches.ai error: ${error.response.status} ${error.response.statusText} - ${JSON.stringify(error.response.data)}`
            : `Speaches.ai request failed: ${error.message}`;
          throw new Error(msg);
        }
      }

      const transcribeAudio = async (audioFilePath) => {
        console.log(`Starting transcription of ${audioFilePath}`);

        try {
          if (!await fsExtra.pathExists(audioFilePath)) {
            throw new Error(`Audio file not found: ${audioFilePath}`);
          }
          const stats = await fsExtra.stat(audioFilePath);
          console.log(`Audio file size: ${stats.size} bytes`);

          if (stats.size === 0) {
            return 'Empty audio file, no transcription possible.';
          }

          const transcript = await sendToSpeaches(audioFilePath);
          return transcript
        } catch (error) {
          console.error(`Error during transcription process: ${error.message}`);
          console.log(`Attempting transcription with original file as fallback...`);

          try {
            const transcript = await sendToSpeaches(audioFilePath);
            return transcript
          } catch (fallbackError) {
            console.error(`Fallback transcription failed: ${fallbackError.message}`);
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

          if (SMS_ME.includes(from)) {
            console.log('Skipping SMS from myself, from:', from, `(SMS_ME=${SMS_ME})`)
            return
          }

          console.log(`Received SMS from ${from} to ${to}, body: ${body}`);
          if (SMS_ME.includes(to)) {
            console.log('The SMS is for me, to:', to, `(SMS_ME=${SMS_ME})`)
            // console.log("MESSAGE event:", event)
          }

          const sipContentType = extractSIPContentType(body)
          console.log("sipContentType:", sipContentType)
          if (sipContentType === 'application/im-iscomposing+xml') {
            console.log("Skipping composing sipContentType:", sipContentType)
            return
          } else if (sipContentType !== 'text/plain') {
            console.log("Skipping non-textual sipContentType:", sipContentType)
            return
          }

          // Echo the message back using a "chat" API command
          const chatTo=from
          const chatFrom=to
          this.sendSmsCmdPrefix = `chat sip|${chatFrom}|${chatTo}|`

          // const cmd = `${this.sendSmsCmdPrefix}Echo: ${body}`;
          // console.log(`Sending echo: ${cmd}`);
          // this.conn.api(cmd, (res) => {
          //   console.log('Echo message sent:', res.getBody());
          // });

          const sipBody = extractSIPBody(body)
          console.log('sipBody:', sipBody)

          if (this.xmppOnline && config.enablePersonalMessage) {
            await sendPersonalMessage({ message: sipBody });
          }
          if (this.xmppOnline && config.enableGroupChat) {
            await sendGroupChatMessage({ message: sipBody });
          }
        } catch (err) {
          console.error('Error processing sms:', err)
        }
      });


      verbose('service:', config.service)
      verbose('domain:', config.domain)
      verbose('username:', config.jid.split('@')[0])
      verbose('password:', config.password,)

      // Initialize XMPP client
      this.xmpp = client({
        service: config.service,
        domain: config.domain,
        username: config.jid.split('@')[0],
        password: config.password,
      });

      // Track state
      this.nickname = null;
      this.clientFullJid = null; // Store the full JID including resource

      // Handle online event
      this.xmpp.on('online', async (jid) => {
        console.log(`Connected as ${jid.toString()}`);
        this.xmppOnline = true
        this.nickname = config.jid.split('@')[0];
        this.clientFullJid = jid.toString(); // Store the full JID

        // Get roster (contact list)
        await this.xmpp.send(xml('iq', { type: 'get', id: 'roster_1' },
          xml('query', { xmlns: 'jabber:iq:roster' })
        ));
        console.log('Requested roster');

        // Send initial presence to let the server know we're online
        this.xmpp.send(xml('presence'));
        console.log('Sent initial presence');

        // Join group chat and continue if enabled
        if (config.enableGroupChat) {
          await joinGroupChat();
        }
      });

      // Handle incoming stanzas
      this.xmpp.on('stanza', async (stanza) => {
        // For debugging specific stanzas
        // console.log('Got stanza:', stanza.toString());

        // Handle roster responses
        if (stanza.is('iq') && stanza.attrs.type === 'result') {
          const query = stanza.getChild('query', 'jabber:iq:roster');
          if (query) {
            const items = query.getChildren('item');
            if (items && items.length) {
              console.log('Roster received, contacts:', items.length);
            }
          }
        }

        // Skip non-message stanzas
        if (!stanza.is('message')) return;

        const body = stanza.getChildText('body');
        if (!body) return;

        const from = stanza.attrs.from;
        const type = stanza.attrs.type;

        if (type === 'chat' || type === 'normal' || !type) {
          // Handle personal messages
          console.log(`Personal message response from ${from}: ${body}`);
        } else if (type === 'groupchat') {
          // Handle group chat messages
          // Skip our own messages
          if (from.includes(`/${this.nickname}`)) return;

          // Skip historical messages
          const delay = stanza.getChild('delay');
          if (delay) return;

          console.log(`Group chat message from ${from}: ${body}`);
        }

        if (this.freeswitchOnline && this.parkUuid) {
          await ttsToFreeswitch({
            text: body,
            parkUuid: this.parkUuid,
          })
        }

        if (this.freeswitchOnline && this.sendSmsCmdPrefix) {
          const text = body.replace(/[\r\n]+/g, ' ')
          const cmd = `${this.sendSmsCmdPrefix}${text}`;
          console.log(`Sending agentic reply sms: ${cmd}`);
          this.conn.api(cmd, (res) => {
            console.log('Agentic reply message sent:', res.getBody());
            this.sendSmsCmdPrefix = null
          });
        }
      });

      // Handle errors
      this.xmpp.on('error', (err) => {
        console.error('XMPP error:', err);
      });

      // Handle disconnection
      this.xmpp.on('close', () => {
        console.log('Connection closed');
      });

      // Send a personal message
      const sendPersonalMessage = async ({ message }) => {
        console.log(`Sending personal message to ${config.botJid}...`);
        // messageBody = message || config.message
        const messageBody = message

        // Send with more complete attributes
        const messageXml = xml(
          'message',
          {
            type: 'chat',
            to: config.botJid,
            from: this.clientFullJid,
            id: randomUUID()
          },
          xml('active', { xmlns: 'http://jabber.org/protocol/chatstates' }),
          xml('body', {}, messageBody)
        );

        await this.xmpp.send(messageXml);
        console.log('Personal message sent:', messageBody);
      }

      // Join group chat and send a message with mention
      const joinGroupChat = async () => {
        const roomJid = `${config.groupChatRoom}@${config.mucDomain}`;

        console.log(`Joining group chat ${roomJid} as ${this?.nickname || '(?)'}...`);

        // Join room with no history
        const presence = xml(
          'presence',
          { to: `${roomJid}/${this.nickname}` },
          xml('x', { xmlns: 'http://jabber.org/protocol/muc' },
            xml('history', { maxstanzas: '0', maxchars: '0' })
          )
        );

        await this.xmpp.send(presence);
        console.log('Joined group chat');
      }

      // Send a message with a mention to the group chat
      const sendGroupChatMessage = async ({ message }) => {
        console.log(`Sending message with proper mention format...`);
        const roomJid = `${config.groupChatRoom}@${config.mucDomain}`;

        const messageBody = `@${config.botNickname} ${message}`;

        const messageXml = xml(
          'message',
          {
            type: 'groupchat',
            to: roomJid,
            id: randomUUID(),
            'xml:lang': 'en'
          },
          xml('body', {}, messageBody),
          xml('reference', {
            xmlns: 'urn:xmpp:reference:0',
            type: 'mention',
            begin: '0',
            end: config.botNickname.length + 1,
            uri: `xmpp:${config.botNickname}@${config.mucDomain}/${config.botNickname}`
          })
        );

        await this.xmpp.send(messageXml);
        console.log('Message with mention sent:', messageBody);
      }

      // FIXME: use conf
      if (config.enable) {
        // Start the client
        console.log(`Connecting to XMPP on ${config.service}, domain: ${config.domain}.`);
        this.xmpp.start().catch(console.error);
      } else {
        console.warn('XMPP connection is disabled: config.enable:', config.enable)
      }
    } catch (err) {
      error('Error starting Phone:', err)
    }
  }

  async stop () {
    super.stop()

    console.log('Disconnecting from FreeSWITCH');
    this.conn.disconnect();
    this.freeswitchOnline = false;
    console.log('Disconnecting from XMPP');
    this.xmpp.stop().catch(console.error);
    this.xmppOnline = false;

    verbose('Phone stopped')
  }
}
