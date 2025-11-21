import mongoose from 'mongoose'
import mongooseTimestamp from 'mongoose-timestamp'
import { Verbose } from '../services.js'

const verbose = Verbose('sd:models/bridge')
verbose('Loading Bridge model')

const { ObjectId, Mixed } = mongoose.Schema.Types

const GeneralSchema = new mongoose.Schema({
  RemoteNickFormat: {
    type: String,
    default: '[{PROTOCOL}] <{NICK}> ',
    description: 'Format of remote nicknames displayed in chat.'
  }
}, { _id: false })

const ProtocolSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: [
      'discord', 'gitter', 'irc', 'keybase', 'matrix',
      'mattermost', 'msteams', 'mumble', 'nctalk', 'rocketchat',
      'slack', 'sshchat', 'telegram', 'vk', 'whatsapp',
      'xmpp', 'zulip'
    ]
  },
  name: { type: String, required: true },

  // Generic fields for all protocols — flexible to handle various types
  Token: {
    valueFromVault: String,
  },
  Login: String,
  Password: {
    valueFromVault: String,
  },
  Server: String,
  AutoWebhooks: { type: Boolean, default: undefined },
  RemoteNickFormat: String,
  PreserveThreading: { type: Boolean, default: undefined },
  MessageFormat: String,
  QuoteFormat: String,
  QuoteLengthLimit: String,
  IgnoreMessages: String,
  NoHomeServerSuffix: { type: Boolean, default: undefined },
  Team: String,
  NoTLS: { type: Boolean, default: undefined },
  PrefixMessagesWithNick: { type: Boolean, default: undefined },
  Nick: String,
  NickServNick: String,
  NickServPassword: {
    valueFromVault: String,
  },
  UseTLS: { type: Boolean, default: undefined },
  UseSASL: { type: Boolean, default: undefined },
  SkipTLSVerify: { type: Boolean, default: undefined },
  Number: String,
  SessionFile: String,
  QrOnWhiteTerminal: { type: Boolean, default: undefined },
  Jid: String,
  Muc: String,
  TenantID: String,
  ClientID: String,
  TeamID: {
    valueFromVault: String,
  },
  TLSClientCertificate: String,
  TLSClientKey: String,
  TLSCACertificate: String,

  channel: { type: String, required: true },
  direction: { type: String, enum: ['inout', 'in', 'out'], default: 'inout' }
}, { _id: false })

const MessengersSchema = new mongoose.Schema({
  direction: { type: String, enum: ['inout', 'in', 'out'], default: 'inout' },
  PrefixMessagesWithNick: { type: Boolean, default: undefined },

  general: { type: GeneralSchema, required: true, default: () => ({}) },
  protocols: { type: [ProtocolSchema], required: true, default: [] },
}, { _id: false })

const PhoneSchema = new mongoose.Schema({
  host: String,
  username: String,
  password: {
    valueFromVault: String,
  },
  realm: String,

  directoryHost: String,
  directoryNumber: String,
  directoryPassword: {
    valueFromVault: String,
  },

  welcomeMessage: String,
}, { _id: false })

const SchedulerSchema = new mongoose.Schema({
  cron: String,
  message: String,

  timezone: String,
  // maxExecutions: Number,
  maxRandomDelay: Number,
}, { _id: false })


const WebhookSchema = new mongoose.Schema({
  method: String,
  endpoint: String,
  timeoutSec: Number,
  setRequestId: Boolean,
  requestIdKey: String,
}, { _id: false })

const EmailSchema = new mongoose.Schema({
  imap: {
    host: String,
    port: Number,
    user: String,
    password: {
      valueFromVault: String,
    },
    secure: Boolean,
  },
  smtp: {
    host: String,
    port: Number,
    user: String,
    password: {
      valueFromVault: String,
    },
    secure: Boolean,
  },
  pollSec: Number,
  defaultRecipient: String,
  defaultSubject: String,
}, { _id: false })

const McpSchema = new mongoose.Schema({
  endpoint: String,
  timeoutSec: Number,
  // setRequestId: Boolean,
  // requestIdKey: String,
}, { _id: false })

const WebappSchema = new mongoose.Schema({
  domain: String,
  endpoint: String,
  defaultCode: String,
  allowUpdates: Boolean,
}, { _id: false })

const BridgeSchema = new mongoose.Schema({
  userId: {
    type: ObjectId,
    required: true,
    ref: 'User'
  },
  appId: { type: ObjectId, ref: 'App' },

  connector: String,        // Matterbridge (whatsapp, telegram, etc.)
  deployed: Boolean,        // Only run the agents with deployed===true

  options: {
    name: { type: String, required: true }, // unique name within user scope
    description: String,

    enablePersonal: Boolean,
    recipient: String,

    enableRoom: Boolean,
    recipientNickname: String,
    joinRoom: String,

    messengers: MessengersSchema,
    phone: PhoneSchema,
    scheduler: SchedulerSchema,
    webhook: WebhookSchema,
    email: EmailSchema,
    mcp: McpSchema,
    webapp: WebappSchema,
  },
})

BridgeSchema.plugin(mongooseTimestamp)

export default mongoose.model('Bridge', BridgeSchema)
