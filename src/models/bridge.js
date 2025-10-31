import mongoose from 'mongoose'
import mongooseTimestamp from 'mongoose-timestamp'
import { Verbose } from '../services.js'

const verbose = Verbose('sd:models/bridge'); verbose('')

const { ObjectId, Mixed } = mongoose.Schema.Types

export default mongoose.model(
  'Bridge',
  mongoose.Schema({
    userId: {
      type: ObjectId,
      required: true,
      ref: 'User'
    },
    appId: { type: ObjectId, ref: 'App' },

    type: String, // whatsapp, telegram, etc.
    deployed: Boolean, // only run the agents with deployed===true

    options: {
      name: { type: String, required: true }, // unique name
      description: String,
      // joinRooms: [ String ], // XMPP rooms to join,

      whatsapp: {
      },

      telegram: {
      },

    },
  })
    .plugin(mongooseTimestamp)
)
