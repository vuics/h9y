import session from 'express-session'
import MongoStore from 'connect-mongo'
import mongoose from 'mongoose'

import conf from '../conf.js'
import db, { mongoOptions } from '../mongo.js'

export const sessionCollection = 'sessions'

export const sessionStore = MongoStore.create({
  mongoUrl: conf.db.url,
  mongoOptions,
  collectionName: sessionCollection,
})

// NOTE: Sign every browser of one account out, for when the password behind
//       them is no longer the password that was used to sign in.
//       connect-mongo keeps the session as a JSON string, so there is no field
//       to match on and the id has to be found inside it. What sits under
//       `passport.user` is what serializeUser hands the session: the user id.
export const destroyUserSessions = async ({ userId }) => {
  const id = String(userId)
  if (!/^[0-9a-f]{24}$/.test(id)) {
    throw new Error(`Refusing to match sessions against ${id}, which is not a user id`)
  }
  const { deletedCount } = await db.collection(sessionCollection)
    .deleteMany({ session: { $regex: `"user":"${id}"` } })
  return deletedCount
}

export default session({
  key: conf.session.key,
  secret: conf.session.secret,
  proxy: conf.session.proxy,
  cookie: {
    maxAge: conf.session.maxAge, // 1000 * 60 * 60 * 24 * 7, // 7 days
    httpOnly: conf.session.httpOnly,
    sameSite: conf.session.sameSite,
    secure: conf.ssl.enable, // Enable for HTTPS only
    path: '/',
    domain: conf.session.domain,
  },
  resave: true,
  saveUninitialized: false, // do not save session before login
  store: sessionStore
})
