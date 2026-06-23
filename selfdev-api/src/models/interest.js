import mongoose from 'mongoose'
import mongooseTimestamp from 'mongoose-timestamp'
import { Verbose } from '../services.js'

const verbose = Verbose('sd:models/interest'); verbose('')
const { ObjectId } = mongoose.Schema.Types

export default mongoose.model(
  'Interest',
  mongoose.Schema({
    landingId: { type: ObjectId, required: true, ref: 'Landing' },
    email: String,
    firstName: String,
    lastName: String,
  })
    .plugin(mongooseTimestamp)
)
