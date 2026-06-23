import mongoose from 'mongoose'
import mongooseTimestamp from 'mongoose-timestamp'
import { Verbose } from '../services.js'

const verbose = Verbose('sd:models/storage')

const { ObjectId, Mixed } = mongoose.Schema.Types

const StorageSchema = new mongoose.Schema({
  userId: {
    type: ObjectId,
    required: true,
    ref: 'User'
  },

  namespace: String,

  key: String,
  value: String,
})

StorageSchema.plugin(mongooseTimestamp)

export default mongoose.model('Storage', StorageSchema)
