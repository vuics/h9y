import mongoose from 'mongoose'
import mongooseTimestamp from 'mongoose-timestamp'
import { Verbose } from '../services.js'
const verbose = Verbose('sd:models/outcome'); verbose('')
const { ObjectId } = mongoose.Schema.Types

export default mongoose.model(
  'Outcome',
  mongoose.Schema({
    userId: {
      type: ObjectId,
      required: true,
      ref: 'User'
    },
    code: String,
    device: String,
    result: String,
    output: String,
    drawing: String,
    error: String,
  })
    .plugin(mongooseTimestamp)
)
