import mongoose from 'mongoose'
import mongooseTimestamp from 'mongoose-timestamp'
import { Verbose } from '../services.js'

const verbose = Verbose('sd:models/state'); verbose('')

const { ObjectId, Mixed } = mongoose.Schema.Types

export default mongoose.model(
  'State',
  mongoose.Schema({
    userId: {
      type: ObjectId,
      required: true,
      ref: 'User'
    },

    agentId: { type: ObjectId, ref: 'Agent'},
    mapId: { type: ObjectId, ref: 'Map' },
    bridgeId: { type: ObjectId, ref: 'Bridge' },

    bridge: {
      webapp: {
        updatedCode: String,
      },
    },
  })
    .plugin(mongooseTimestamp)
)
