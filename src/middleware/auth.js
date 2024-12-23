import passport from 'passport'
import { Strategy as LocalStrategy } from 'passport-local'
import { BasicStrategy } from 'passport-http'
import { Strategy as ClientPasswordStrategy } from 'passport-oauth2-client-password'
import { Strategy as BearerStrategy } from 'passport-http-bearer'
import { createLocalJWKSet, jwtVerify } from 'jose'
import jsonwebtoken from 'jsonwebtoken'
const { verify } = jsonwebtoken

import conf from '../conf.js'
import { randomToken } from '../utils/token.js'
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

  passport.serializeUser((user, done) => {
    async function createAccessToken () {
      try {
        const token = randomToken()
        const foundUser = await User.findOne({ rememberMe: { token } }).exec()
        if (foundUser) {
          // Run the function again - the token has to be unique!
          return createAccessToken()
        }
        user.set('rememberMe.token', token)
        await user.save()
        return done(null, token)
      } catch (err) {
        error('Serialize user error:', err)
        done(err)
      }
    }
    if (user._id) {
      createAccessToken()
    }
  })

  passport.deserializeUser(async (token, done) => {
    try {
      const user = await User.findOne({ rememberMe: { token: token } }).exec()
      done(null, user)
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
