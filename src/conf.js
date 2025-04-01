import { config } from 'dotenv'
import lodash from 'lodash'
const { cloneDeep } = lodash

const name = 'selfdev-api'

const result = config()
if (result.error) {
  result.error.code === 'ENOENT'
    ? console.log('.env file is omitted')
    : console.error('.env error:', result.error)
}
// console.log('process.env:', process.env)

const bool = (val) => ['true', '1', true, 1].includes(val)
const json = (val) => val && JSON.parse(val)
const num = (val) => val ? Number(val) : (val === 0 ? 0 : undefined)
const arr = (str) => str ? str.split(',') : []

const conf = {

  node: {
    tlsRejectUnauthorized: process.env.NODE_TLS_REJECT || '',
    defaultMaxListeners: num(process.env.NODE_DEFAULT_MAX_LISTENERS || 1000),
  },

  port: process.env.PORT || 6369,

  ssl: {
    // NOTE:
    //   It is better to run the Web & API servers through HTTP.
    //   It is exposed through HTTPS in production anyway.
    enable: bool(process.env.SSL_ENABLE || false),
    keyFile: process.env.SSL_KEY_FILE || '/opt/ssl/tls.key',
    certFile: process.env.SSL_CERT_FILE || '/opt/ssl/tls.crt',
  },

  security: {
    hpp: bool(process.env.SECURITY_HPP || true),
    helmet: bool(process.env.SECURITY_HELMET || true),
    csp: bool(process.env.SECURITY_CSP || false), // This is disabled because it does not allow to load fonts.
    trustProxy: bool(process.env.SECURITY_TRUST_PROXY || true),
    powered: bool(process.env.SECURITY_POWERED || true),
  },

  cors: {
    enabled: bool(process.env.CORS_ENABLED || true),
    whitelist: arr(process.env.CORS_WHITELIST || 'http://localhost:3000,https://localhost:3000'),
  },

  session: {
    key: process.env.SESSION_KEY || 'SelfDev.sid',
    maxAge: process.env.SESSION_MAX_AGE || (1000 * 3600 * 24 * 7), // 7 days
    secret: process.env.SESSION_SECRET || '!Se1f!DEV!$ecret',
    httpOnly: bool(process.env.SESSION_HTTP_ONLY || true),
    sameSite: process.env.SESSION_SAME_SITE || 'lax',
    proxy: bool(process.env.SESSION_PROXY || true),
  },

  db: {
    enable: bool(process.env.DB_ENABLE || true),
    url: process.env.DB_URL || 'mongodb://localhost:27017/selfdev',
    replicaSet: process.env.DB_REPLICA_SET || '',
    ssl: bool(process.env.DB_SSL || false),
    // sslValidate: bool(process.env.DB_SSL_VALIDATE || false),
    sslCAFiles: process.env.DB_SSL_CA_FILES || null,
    sslCertFile: process.env.DB_SSL_CERT_FILE || null,
    sslKeyFile: process.env.DB_SSL_KEY_FILE || null,
    sslPass: process.env.DB_SSL_PASS || null
  },

  arangodb: {
    enable: bool(process.env.ARANGODB_ENABLE || false),
    url: process.env.ARANGODB_URL || 'mongodb://localhost:8529',
    database: process.env.ARANGODB_DATABASE || 'selfdev',
    auth: {
      username: process.env.ARANGODB_AUTH_USERNAME || 'root',
      password: process.env.ARANGODB_AUTH_PASSWORD || '',
    },
  },

  jwt: {
    issuer: process.env.JWT_ISSUER || 'selfde-jwt-issuer',
    jwks: process.env.JWT_JWKS || null,

    secret: process.env.JWT_SECRET || 'SF-Jwt-$ecreT',

    // Expressed in seconds or
    // a string describing a time span: https://github.com/zeit/ms
    // Eg: 60, "2 days", "10h", "7d".
    expiresIn: process.env.JWT_EXPIRESIN || '8h',

    // HS256 HS384 HS512 RS256 RS384 RS512 PS256 PS384 PS512 ES256 ES384 ES512
    algorithm: process.env.JWT_ALGORITHM || 'HS256',
  },

  resource: {
    // Resource.js API
    user: bool(process.env.RESOURCE_USER || false),
    key: bool(process.env.RESOURCE_KEY || true),
    dialog: bool(process.env.RESOURCE_DIALOG || true),
    landing: bool(process.env.RESOURCE_LANDING || true),
    interest: bool(process.env.RESOURCE_INTEREST || true),
    agent: bool(process.env.RESOURCE_AGENT || true),
  },

  agency: {
    enable: bool(process.env.AGENCY_ENABLE || true),
    url: process.env.AGENCY_URL || 'http://127.0.0.1:6600/v1',
  },

  snake: {
    enbale: bool(process.env.SNAKE_ENABLE || false),
    url: process.env.SNAKE_URL || 'http://127.0.0.1:6699/v1',
  },

  smtp: {
    // TODO: USE GCP MAILING
    host: process.env.SMPT_HOST || 'smtp.mail.us-west-2.awsapps.com',
    port: num(process.env.SMPT_PORT || 465),
    secure: bool(process.env.SMPT_SECURE || true),
    user: process.env.SMTP_USER || 'admin@vuics.awsapps.com',
    pass: process.env.SMTP_PASS || '<SMTP_PASSWORD_PLACEHOLDER>',
    from: process.env.SMTP_FROM || '"Self-developing" <admin@vuics.com>',
  },

  reset: {
    expiresMinutes: num(process.env.RESET_EXPIRES_MINUTES || 20),
  },

  webApp: {
    origin: process.env.WEB_APP_ORIGIN || 'http://localhost:3008'
  },

  stripe: {
    key: process.env.STRIPE_KEY || '<STRIPE_KEY_PLACEHOLDER>',
    endpointSecret: process.env.STRIPE_ENDPOINT_SECRET || '<STRIPE_ENDPOINT_SECRET_PLACEHOLDER>',
  },

  xmpp: {
    host: process.env.XMPP_HOST || 'localhost',
    commanderUrl: process.env.XMPP_COMMANDER_URL || 'http://localhost:8387',
  },
}

export default conf

export const revealConf = () => {
  const publicConf = cloneDeep(conf)

  delete publicConf.session.secret
  delete publicConf.db.sslPass
  delete publicConf.jwt.secret
  delete publicConf.db.url
  delete publicConf.smtp.pass
  delete publicConf.stripe

  return publicConf
}
