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
  stripe: {
    customerId: String,
  },
  yookassa: {
    pending: {
      plan: String,
      paymentId: String,
    },

    plan: String,
    paymentIds: [String],
    paymentMethodIds: [String],
    createdAt: Date,
    periodStart: Date,
    periodEnd: Date,
    // status: String,
    active: Boolean,
    canceled: Boolean,
    canceledAt: Date,
  },

  limits: {
    // backend limits
    apiAccess: Boolean,
    maps: Number,
    deployedAgents: Number,
    archetypes: [String],
    //
    chatProviders: [String],
    ragProviders: [String],
    ragEmbeddingsProviders: [String],
    sttProviders: [String],
    ttsProviders: [String],
    imagegenProviders: [String],
    avatarProviders: [String],

    // front-end limits
    audioRecordings: Boolean,
    fileAttachments: Boolean,
    synthetic: Boolean,
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
