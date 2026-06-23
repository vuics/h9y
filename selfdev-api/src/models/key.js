import mongoose from 'mongoose'
import mongooseTimestamp from 'mongoose-timestamp'
import { Verbose } from '../services.js'

const verbose = Verbose('sd:models/key'); verbose('')

const { ObjectId } = mongoose.Schema.Types

export default mongoose.model(
  'Key',
  mongoose.Schema({
    userId: {
      type: ObjectId,
      required: true,
      ref: 'User'
    },
    name: String,
    key: {
      type: String,
      required: true,
      unique: true
    },
    secret: {
      type: String,
      required: true
    },
    lastUsedAt: Date,
  })
    .plugin(mongooseTimestamp)
)
