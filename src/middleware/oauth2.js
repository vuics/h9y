import oauth2orize from 'oauth2orize'
import passport from 'passport'
import jsonwebtoken from 'jsonwebtoken'
const { sign } = jsonwebtoken

import { Verbose } from '../services.js'
import conf from '../conf.js'

const verbose = Verbose('sd:middleware/oauth2'); verbose('')

// create OAuth 2.0 server
const server = oauth2orize.createServer()

server.exchange(oauth2orize.exchange.clientCredentials(
  async (key, scope, done) => {
    // verbose('oauth2orize.exchange.clientCredentials key:', key, 'scope:', scope)
    try {
      const jwt = sign({
        userId: key.userId,
      }, conf.jwt.secret, {
        algorithm: conf.jwt.algorithm,
        expiresIn: conf.jwt.expiresIn,
      })
      done(null, jwt)
    } catch (err) {
      verbose('oauth2orize.exchange.clientCredentials Error: ', err)
      done(err)
    }
  }
))

// token endpoint
export default {
  token: [
    passport.authenticate(['basic', 'oauth2-client-password'], { session: false }),
    server.token(),
    server.errorHandler()
  ]
}
