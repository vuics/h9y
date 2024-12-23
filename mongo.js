import mongoose from 'mongoose'
import bluebird from 'bluebird'
import { log, error, Verbose } from './services.js'

import conf from './conf.js'

const debug = Verbose('sd:mongo'); debug('')

export const mongoOptions = {
  sslPass: conf.db.sslPass,
}

mongoose.set('debug', true)
mongoose.set('strictQuery', false)
mongoose.Promise = bluebird
let reconnectTimeSec = 1

debug('Connect with Mongoose to MongoDB using:', conf.db.url)

const db = mongoose.connection
export default db

db.on('connecting', () => {
  log('connecting to MongoDB...')
})

db.on('error', (err) => {
  error('Error in MongoDb connection: ', err)
  mongoose.disconnect()
})

db.on('connected', () => {
  log('MongoDB connected!')
  reconnectTimeSec = 1
})

db.once('open', () => {
  log('MongoDB connection opened!')
  reconnectTimeSec = 1
})

db.on('reconnected', () => {
  log('MongoDB reconnected!')
  reconnectTimeSec = 1
})

db.on('disconnected', () => {
  log(`MongoDB disconnected! Attempt to reconnect in ${reconnectTimeSec} seconds...`)
  setTimeout(() => {
    reconnectTimeSec = reconnectTimeSec * 2
    if (reconnectTimeSec > 512) {
      reconnectTimeSec = 512
    }
    mongoose.connect(conf.db.url, mongoOptions)
  }, reconnectTimeSec * 1000)
})

if (conf.db.enable) {
  mongoose.connect(conf.db.url, mongoOptions)
}
