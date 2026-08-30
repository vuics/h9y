import mongoose from 'mongoose'
import passport from 'passport'
import { Strategy as LocalStrategy } from 'passport-local'
import { BasicStrategy } from 'passport-http'
import { Strategy as ClientPasswordStrategy } from 'passport-oauth2-client-password'
import { Strategy as BearerStrategy } from 'passport-http-bearer'
import { createLocalJWKSet, jwtVerify } from 'jose'
import jsonwebtoken from 'jsonwebtoken'
const { verify } = jsonwebtoken

import conf from '../conf.js'
import User from '../models/user.js'
import Key from '../models/key.js'
import { error, Verbose } from '../services.js'

const verbose = Verbose('sd:middleware/auth'); verbose('')

export async function authenticateWithJWT (jwt) {
  let payload
  if (conf.jwt.jwks && conf.jwt.issuer) {
    const jwks = JSON.parse(conf.jwt.jwks)
    const jwksGetKeyFunction = createLocalJWKSet(jwks);
    ({ payload } = await jwtVerify(jwt, jwksGetKeyFunction, {
      issuer: conf.jwt.issuer
    }))
  } else {
    // use this case
    payload = await new Promise((resolve, reject) => {
      // verbose('jwt:', jwt)
      // verbose('secret:', conf.jwt.secret)
      // verbose('algorithms:', [conf.jwt.algorithms])
      verify(jwt, conf.jwt.secret, {
        algorithms: [conf.jwt.algorithm]
      }, (err, payload) => {
        if (err) {
          verbose('authenticateWithJWT reject err:', err)
          return reject(err)
        }
        resolve(payload)
      })
    })
  }
  // verbose('payload:', payload)

  const user = await User.findById(payload.userId).exec()
  if (!user) {
    throw new Error('Unknown user')
  }
  // verbose('user:', user)

  return user
}

export default (app) => {
  app.use(passport.initialize())
  app.use(passport.session())

  passport.use(new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password'
  }, async (email, password, done) => {
    // verbose('email: ', email)
    // verbose('password: ', password)
    try {
      const user = await User.findOne({ email }).exec()
      // verbose('user:', user)
      if (!user) {
        error('user does not exist')
        return done(null, false, {
          message: `Unknown user, email: ${email}`
        })
      }

      const valid = user.verifyPasswordSync(password)
      if (valid) {
        done(null, user)
      } else {
        // verbose('Invalid password')
        return done(null, false, { message: 'Invalid password' })
      }
    } catch (err) {
      error('Authenticaton with local strategy error:', err)
      done(err)
    }
  }))

  // NOTE: What the session stores is the user id. It used to store a token
  //       minted on every login and kept in a single field on the user
  //       document, so signing in from a second browser overwrote the key the
  //       first one was holding and logged it out. An account could hold
  //       exactly one session at a time, which is not a rule anybody asked for.
  //       Sessions are separate documents in the store, so an id lets an
  //       account keep as many of them as it has browsers.
  passport.serializeUser((user, done) => {
    done(null, user._id.toString())
  })

  passport.deserializeUser(async (id, done) => {
    try {
      // A session issued before the change carries the old token, which is not
      // an id. Answer that nobody is signed in rather than failing the request.
      if (!mongoose.isValidObjectId(id)) {
        verbose('Session carries an identifier that is not a user id')
        return done(null, false)
      }
      const user = await User.findById(id).exec()
      done(null, user || false)
    } catch (err) {
      error('deserializeUser Error: ', err)
      done(err)
    }
  })

  const basicStrategy = async (keyKey, keySecret, done) => {
    // verbose('Basic/CP Strategy keyKey:', keyKey, 'keySecret:', keySecret)
    try {
      const key = await Key.findOne({ key: keyKey }).exec()
      if (!key) {
        return done(null, false)
      }
      if (key.secret !== keySecret) {
        return done(null, false)
      }
      key.lastUsedAt = Date.now()
      await key.save()
      done(null, key)
    } catch (err) {
      error('Basic/CP Strategy Error: ', err)
      done(err)
    }
  }
  passport.use(new BasicStrategy(basicStrategy))
  passport.use(new ClientPasswordStrategy(basicStrategy))

  passport.use(new BearerStrategy(async (jwt, done) => {
    // verbose('BearerStrategy jwt:', jwt)
    try {
      const user = await authenticateWithJWT(jwt)
      done(null, user, { scope: '*' })
    } catch (err) {
      error('BearerStrategy Error: ', err)
      return done(null, false, { message: err })
    }
  }))
}
