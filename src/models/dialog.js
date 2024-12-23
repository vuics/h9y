import mongoose from 'mongoose'
import mongooseTimestamp from 'mongoose-timestamp'
import { Verbose } from '../services.js'

const verbose = Verbose('sd:models/dialog'); verbose('')
const { ObjectId } = mongoose.Schema.Types

export default mongoose.model(
  'Dialog',
  mongoose.Schema({
    userId: {
      type: ObjectId,
      required: true,
      ref: 'User'
    },
    prompt: String,
    reply: String,
  })
    .plugin(mongooseTimestamp)
)
