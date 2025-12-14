import session from 'express-session'
import MongoStore from 'connect-mongo'
import mongoose from 'mongoose'

import conf from '../conf.js'
import db, { mongoOptions } from '../mongo.js'

export const sessionStore = MongoStore.create({
  mongoUrl: conf.db.url,
  mongoOptions,
})

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
    // domain: '.h9y.ai', // TODO: Should I set from conf to allow using on h9y.ai and app.h9y.ai
  },
  resave: true,
  saveUninitialized: false, // do not save session before login
  store: sessionStore
})
