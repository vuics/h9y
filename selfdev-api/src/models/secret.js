import mongoose from 'mongoose'
import mongooseTimestamp from 'mongoose-timestamp'
import { Verbose } from '../services.js'

const verbose = Verbose('sd:models/secret')

const SecretSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },

  key: {
    type: String,
    required: true,
    trim: true,
  },

  value: {
    type: String,
    required: true,
  },
})

SecretSchema.index(
  { userId: 1, key: 1 },
  { unique: true }
)

SecretSchema.plugin(mongooseTimestamp)

export default mongoose.model('Secret', SecretSchema)
