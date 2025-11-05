import mongoose from 'mongoose'
import mongooseTimestamp from 'mongoose-timestamp'
import { Verbose } from '../services.js'

const verbose = Verbose('sd:models/bridge')
verbose('Loading Bridge model')

const { ObjectId, Mixed } = mongoose.Schema.Types

// === Subschema: General settings ===
const GeneralSchema = new mongoose.Schema({
  RemoteNickFormat: {
    type: String,
    default: '[{PROTOCOL}] <{NICK}> ',
    description: 'Format of remote nicknames displayed in chat.'
  }
}, { _id: false })

// === Subschema: Protocols ===
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
  Token: String,
  Server: String,
  AutoWebhooks: { type: Boolean, default: undefined },
  RemoteNickFormat: String,
  PreserveThreading: { type: Boolean, default: undefined },
  MessageFormat: String,
  QuoteFormat: String,
  QuoteLengthLimit: String,
  IgnoreMessages: String,
  Login: String,
  Password: String,
  NoHomeServerSuffix: { type: Boolean, default: undefined },
  Team: String,
  NoTLS: { type: Boolean, default: undefined },
  PrefixMessagesWithNick: { type: Boolean, default: undefined },
  Nick: String,
  NickServNick: String,
  NickServPassword: String,
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
  TeamID: String,
  TLSClientCertificate: String,
  TLSClientKey: String,
  TLSCACertificate: String,
}, { _id: false })

// === Subschema: Gateway Channels ===
const GatewayChannelSchema = new mongoose.Schema({
  account: { type: String, required: true },
  channel: { type: String, required: true },
  direction: {
    type: String,
    enum: ['inout', 'in', 'out'],
    default: 'inout'
  }
}, { _id: false })

// === Subschema: Gateways ===
const GatewaySchema = new mongoose.Schema({
  name: { type: String, required: true },
  enable: { type: Boolean, default: true },
  inout: {
    type: [GatewayChannelSchema],
    required: true,
    default: []
  }
}, { _id: false })

// === Subschema: Messengers ===
const MessengersSchema = new mongoose.Schema({
  general: { type: GeneralSchema, required: true, default: () => ({}) },
  protocols: { type: [ProtocolSchema], required: true, default: [] },
  gateways: { type: [GatewaySchema], required: true, default: [] }
}, { _id: false })

// === Subschema: Phone ===
const PhoneSchema = new mongoose.Schema({
  host: String,
  username: String,
  password: String,

  altHost: String,
  altUsername: String,

  xmppJid: String,
  xmppPassword: String,

  recipient: String,
  recipientNickname: String,
  joinRoom: String,
  enablePersonal: Boolean,
  enableRoom: Boolean,

  welcomeMessage: String,
}, { _id: false })

// === Root Bridge Schema ===
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

    messengers: { type: MessengersSchema, required: false },
    phone: { type: PhoneSchema, required: false },
  },

  logs: String
})

// Plugins
BridgeSchema.plugin(mongooseTimestamp)

export default mongoose.model('Bridge', BridgeSchema)
