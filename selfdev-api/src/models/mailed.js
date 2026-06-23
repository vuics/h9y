import mongoose from 'mongoose'
import mongooseTimestamp from 'mongoose-timestamp'
import { Verbose } from '../services.js'

const verbose = Verbose('sd:models/mailed'); verbose('')
const { ObjectId } = mongoose.Schema.Types

export default mongoose.model(
  'Mailed',
  mongoose.Schema({
    userId: { type: ObjectId, required: true, ref: 'User' },
    from: String,
    to: String,
    subject: String,
    text: String,
  })
    .plugin(mongooseTimestamp)
)
