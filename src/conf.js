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
    dialog: bool(process.env.RESOURCE_DIALOG || false),
    landing: bool(process.env.RESOURCE_LANDING || false),
    interest: bool(process.env.RESOURCE_INTEREST || false),
    agent: bool(process.env.RESOURCE_AGENT || true),
    map: bool(process.env.RESOURCE_MAP || true),

    // Swagger Specification
    spec: {
      enable: bool(process.env.RESOURCE_SPEC_ENABLE || true),
      excludes: arr(process.env.RESOURCE_SPEC_EXCLUDES || 'key,dialog,landing,interest'),

      json: json(process.env.RESOURCE_SPEC_JSON || `{
  "info": {
    "title": "HyperAgency API Reference",
    "description": "HyperAgency API provides a RESTful interface for managing and automating resources in the HyperAgency platform, including agents, execution maps, and other operational components. This API allows developers, integrators, and DevOps engineers to programmatically create, retrieve, update, and delete resources over HTTPS using standard tools such as curl or through client libraries in languages like Node.js, Python, and others. The API follows common REST conventions and supports JSON-encoded request and response bodies. All endpoints are versioned under v1 prefix and secured via HTTPS. Resources are organized by type (e.g., agent, map), and standard HTTP methods (GET, POST, PUT, DELETE) are used to perform operations.",
    "version": "1.0.0",
    "contact": {
      "name": "API Support",
      "url": "https://hyag.org/",
      "email": "admin@vuics.com"
    }
  },
  "license": {
    "name": "Business Source License 1.1",
    "identifier": "BUSL-1.1",
    "url": "https://github.com/vuics/hyag?tab=License-1-ov-file"
  },
  "host": "api.hyag.org",
  "basePath": "",
  "schemes": ["https"],
  "servers": [ {
    "url": "https://api.hyag.org",
    "description": "HyperAgency Cloud"
  }, {
    "url": "https://selfdev-api.dev.local:6369",
    "description": "Self-hosted Deployment"
  } ]
}`),
    }
  },

  agency: {
    enable: bool(process.env.AGENCY_ENABLE || true),
    url: process.env.AGENCY_URL || 'http://127.0.0.1:6600/v1',
  },

  // TODO: deprecate
  snake: {
    enbale: bool(process.env.SNAKE_ENABLE || false),
    url: process.env.SNAKE_URL || 'http://127.0.0.1:6699/v1',
  },

  vault: {
    enable: bool(process.env.VAULT_ENABLE || false),
    addr: process.env.VAULT_ADDR || 'http://127.0.0.1:8200',
    token: process.env.VAULT_TOKEN || '(not-set)',
    unseal: bool(process.env.VAULT_UNSEAL || false),
    unsealKeys: arr(process.env.VAULT_UNSEAL_KEYS || '(not-set),(not-set),(not-set),(not-set),(not-set)'),
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
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '(TBS)',
    secretKey: process.env.STRIPE_SECRET_KEY || '(TBS)',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '(TBS)',
    // key: process.env.STRIPE_KEY || '<STRIPE_KEY_PLACEHOLDER>',
    // endpointSecret: process.env.STRIPE_ENDPOINT_SECRET || '<STRIPE_ENDPOINT_SECRET_PLACEHOLDER>',
  },

  yookassa: {
    shopId: process.env.YOOKASSA_SHOP_ID || '(TBS)',
    apiKey: process.env.YOOKASSA_API_KEY || '(TBS)',

    // false -> type: "embedded"
    // true -> type: "redirect"
    // confirmationRedirect: bool(process.env.YOOKASSA_CONFIRMATION_REDIRECT || false),
    confirmationRedirect: bool(process.env.YOOKASSA_CONFIRMATION_REDIRECT || true),
  },

  limits: {
    enable: bool(process.env.LIMITS_ENABLE || true),
  },

  plans: {
    free: {
      limits: {
        apiAccess: false,
        maps: 3,
        deployedAgents: 0,
        archetypes: [ ],
        chatProviders: [ ],
        ragProviders: [ ],
        ragEmbeddingsProviders: [ ],
        sttProviders: [],
        ttsProviders: [],
        imagegenProviders: [],
        avatarProviders: [],
        audioRecordings: false,
        fileAttachments: false,
        synthetic: false,
      },
    },
    basic1: {
      product: {
        name: 'basic1-product',
      },
      pricesRu: { // Yookassa
        value: '1.23',
        currency: 'RUB',
        interval: 'month',
        number: 1,
      },
      prices: [{ // Stripe
        lookup_key: 'basic1-fixed-price',  // NOTE: lookup_key should be unique
        unit_amount: 3999,
        currency: 'usd',
        recurring: { interval: 'month', },
      }, {
        lookup_key: 'basic1-metered1-price',
        unit_amount_decimal: '0.0042',
        currency: 'usd',
        recurring: {
          interval: 'month',
          usage_type: 'metered',
          meter: {   // NOTE: the subobject will be replaced with meter: meter.id,
            display_name: 'meter1',
            event_name: 'meter1',   // NOTE: another meter name maybe reused
            default_aggregation: { formula: 'sum', },
          },
        },
      }],
      // subscription: {
      //   trial_period_days: 3,
      // },
      limits: {
        apiAccess: false,
        maps: 30,
        deployedAgents: 3,
        archetypes: [ 'chat-v1.0', 'rag-v1.0', 'storage-v1.0', ],
        chatProviders: [ 'openai' ],
        ragProviders: [ 'openai' ],
        ragEmbeddingsProviders: [ 'openai' ],
        sttProviders: [],
        ttsProviders: [],
        imagegenProviders: [],
        avatarProviders: [],
        audioRecordings: false,
        fileAttachments: false,
        synthetic: false,
      },
    },
    premium1: {
      product: {  // Yookassa & Stripe
        name: 'premium1-product',
      },
      pricesRu: {  // Yookassa
        value: '2.34',
        currency: 'RUB',
        interval: 'month',
        number: 1,
      },
      prices: [{ // Stripe
        lookup_key: 'premium1-fixed-price',  // NOTE: lookup_key should be unique
        unit_amount: 9699,
        currency: 'usd',
        recurring: { interval: 'month', },
      }, {
        lookup_key: 'premium1-metered1-price',
        unit_amount_decimal: '0.0039',
        currency: 'usd',
        recurring: {
          interval: 'month',
          usage_type: 'metered',
          meter: {   // NOTE: the subobject will be replaced with meter: meter.id,
            display_name: 'meter1',
            event_name: 'meter1',   // NOTE: another meter name maybe reused
            default_aggregation: { formula: 'sum', },
          },
        },
      }],
      // subscription: {
      //   trial_period_days: 3,
      // },
      limits: {
        apiAccess: true,
        maps: 100,
        deployedAgents: 10,
        archetypes: [
          'chat-v1.0', 'rag-v1.0', 'storage-v1.0',
          'stt-v1.0', 'tts-v1.0', 'imagegen-v1.0',
        ],
        chatProviders: [ 'openai', 'google_genai' ],
        ragProviders: [ 'openai', 'google_genai' ],
        ragEmbeddingsProviders: [ 'openai', 'google_genai' ],
        sttProviders: [ 'speaches' ],
        ttsProviders: [ 'speaches' ],
        imagegenProviders: [ 'openai' ],
        avatarProviders: [ ],
        audioRecordings: true,
        fileAttachments: true,
        synthetic: false,
      },
    },
    enterprise: {
      limits: {
        apiAccess: true,
        maps: null,
        deployedAgents: null,
        archetypes: null,
        chatProviders: null,
        ragProviders: null,
        ragEmbeddingsProviders: null,
        sttProviders: null,
        ttsProviders: null,
        imagegenProviders: null,
        avatarProviders: null,
        audioRecordings: true,
        fileAttachments: true,
        synthetic: true,
      },
    },

    // NOTE: this is for the test of creating product/price/meters
    //
    /* /
    test8: {
      product: {
        name: 'Test8',
      },
      prices: [{
        lookup_key: 'test8',
        unit_amount: 12.34,
        currency: 'usd',
        recurring: { interval: 'month', },
      }, {
        lookup_key: 'test8-payasyougo',
        unit_amount_decimal: '0.02',
        currency: 'usd',
        recurring: {
          interval: 'month',
          usage_type: 'metered',
          meter: {   // NOTE: the subobject will be replaced with meter: meter.id,
            display_name: 'Test8-Meter1',
            event_name: 'test8-meter1',
            default_aggregation: { formula: 'sum', },
          },
        },
      }],
      // subscription: {
      //   trial_period_days: 7,
      // },
      limits: {
        apiAccess: true,
        maps: 300,
        deployedAgents: 133,
        archetypes: [ 'chat-v1.0', 'rag-v1.0' ],
        chatProviders: [ 'openai', 'google_genai' ],
        ragProviders: [ 'openai', 'google_genai' ],
        ragEmbeddingsProviders: [ 'openai', 'google_genai' ],
        sttProviders: [],
        ttsProviders: [],
        imagegenProviders: [],
        avatarProviders: [],
        audioRecordings: true,
        fileAttachments: true,
        synthetic: true,
      },
    },
    /**/
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

  delete publicConf.vault.token
  delete publicConf.vault.unsealKeys

  return publicConf
}
