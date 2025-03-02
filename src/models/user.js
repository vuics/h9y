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

  xmpp: {
    user: String,
    password: String,
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
