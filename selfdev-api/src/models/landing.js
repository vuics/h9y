import mongoose from 'mongoose'
import mongooseTimestamp from 'mongoose-timestamp'
import { Verbose } from '../services.js'

const verbose = Verbose('sd:models/landing'); verbose('')
const { ObjectId } = mongoose.Schema.Types

export default mongoose.model(
  'Landing',
  mongoose.Schema({
    userId: { type: ObjectId, required: true, ref: 'User' },
    body: String,
    title: String,
    favicon: String,
    interestForm: String,
  })
    .plugin(mongooseTimestamp)
)

