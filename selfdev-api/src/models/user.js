import mongoose from 'mongoose'
import mongooseTimestamp from 'mongoose-timestamp'
import mongooseBcrypt from 'mongoose-bcrypt'
import db from '../mongo.js'
import { error, Verbose } from '../services.js'

const verbose = Verbose('sd:models/user'); verbose('')

const { Mixed } = mongoose.Schema.Types

const schema = mongoose.Schema({
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  phone: { type: String, required: false },

  roles: [String], // 'user'
  avatar: String,

  address: {
    line1: String,
    line2: String,
    city: String,
    state: String,
    postalCode: String,
    country: String,
  },

  settings: {
    language: String,
    marketingConsent: Boolean,
  },

  consent: {
    termsConsent: Boolean,
    privacyConsent: Boolean,
    ip: String,
    timestamp: String,
  },

  xmpp: {
    user: String,
    password: String,
  },
  firefly: {
    address: String,
    identityId: String,
  },
  stripe: {
    customerId: String,
  },
  yookassa: {
    pending: {
      plan: String,
      paymentId: String,
      confirmationUrl: String,
    },

    plan: String,
    paymentIds: [String],
    paymentMethodIds: [String],
    createdAt: Date,
    periodStart: Date,
    periodEnd: Date,
    active: Boolean,
    canceled: Boolean,
    canceledAt: Date,
    cancelationReason: String,
  },

  limits: {
    type: {
      // backend limits
      apiAccess: Boolean,
      maps: Number,
      deployedAgents: Number,
      archetypes: { type: [String], default: undefined },
      agentExpires: { type: [String], default: undefined },
      //
      chatProviders: { type: [String], default: undefined },
      ragProviders: { type: [String], default: undefined },
      ragEmbeddingsProviders: { type: [String], default: undefined },
      sttProviders: { type: [String], default: undefined },
      ttsProviders: { type: [String], default: undefined },
      imagegenProviders: { type: [String], default: undefined },
      avatarProviders: { type: [String], default: undefined },

      deployedBridges: Number,
      connectors: { type: [String], default: undefined }, // 'messengers', 'phone', 'scheduler', 'webhook', 'email', 'mcp', 'webapp', 'a2a', 'client'
      bridgeExpires: { type: [String], default: undefined }, // '1m', '1h', '12h', '1d', '1w', '1mo', ''

      // TODO: add
      // files: Number,
      // filesSize: String,
      // storages: Number,

      // front-end limits
      audioRecordings: Boolean,
      fileAttachments: Boolean,
      synthetic: Boolean,
    },
    default: undefined,
  },

  rememberMe: {
    token: String,
  },
  resetPassword: {
    token: String,
    createdAt: Date,
  },
})
  .plugin(mongooseTimestamp)
  .plugin(mongooseBcrypt)

schema.methods.isAdmin = () =>
  Object.prototype.hasOwnProperty.call(this, 'roles') &&
  this.roles.includes('admin')

schema.static.getByEmail = async ({ email }) => {
  try {
    const user = await db.collection('users').findOne({ email })
    return user
  } catch (err) {
    error('User.getByEmail error:', err)
    throw new Error(err)
  }
}

export default mongoose.model('User', schema)
