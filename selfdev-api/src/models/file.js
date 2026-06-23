import mongoose from 'mongoose'
import mongooseTimestamp from 'mongoose-timestamp'
import { Verbose } from '../services.js'

const verbose = Verbose('sd:models/file')

const { ObjectId, Mixed } = mongoose.Schema.Types

const FileSchema = new mongoose.Schema({
  userId: {
    type: ObjectId,
    required: true,
    ref: 'User'
  },

  slot: String,
  contentType: String,

  filename: String,
  filesize: Number,
  exp: Date,
  path: String,
})

FileSchema.plugin(mongooseTimestamp)

export default mongoose.model('File', FileSchema)
