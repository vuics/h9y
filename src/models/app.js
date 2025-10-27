import mongoose from 'mongoose'
import mongooseTimestamp from 'mongoose-timestamp'
import { Verbose } from '../services.js'

const verbose = Verbose('sd:models/app'); verbose('')

const { ObjectId, Mixed } = mongoose.Schema.Types

export default mongoose.model(
  'App',
  mongoose.Schema({
    userId: {
      type: ObjectId,
      required: true,
      ref: 'User'
    },

    package: Mixed,
    agentIds: [{ type: ObjectId, ref: 'Agent'}],
    mapIds: [{ type: ObjectId, ref: 'Map' }],
  })
    .plugin(mongooseTimestamp)
)
