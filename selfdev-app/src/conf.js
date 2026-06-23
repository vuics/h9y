export const bool = (val) => ['true', '1', true, 1, 'yes', 'y', 'on'].includes(val)
export const json = (val) => val && JSON.parse(val)
export const num = (val) => val ? Number(val) : (val === 0 ? 0 : undefined)
export const arr = (str) => str ? str.split(',') : []

export const hasProfile = (profiles) => profiles.some(x => conf.compose.profiles.includes(x))

const conf = {
  meta: {
    name: import.meta.env.VITE_APP_NAME || 'HyperAgency',
    // company: import.meta.env.VITE_APP_COMPANY || 'Vuics LLC',
    // url: import.meta.env.VITE_APP_URL || 'http://localhost:3990',
  },

  style: {
    color0: 'teal',
    grayLogo: false,
  },

  api: {
    url: import.meta.env.VITE_API_URL || 'http://localhost:6369/v1',
  },

  web: {
    url: import.meta.env.VITE_WEB_URL || 'http://localhost:3690',
  },

  bridge: {
    url: import.meta.env.VITE_BRIDGE_URL || 'http://localhost:6370',
  },

  synthetic: {
    enable: bool(import.meta.env.VITE_SYNTHETIC_PLUGIN || false),
    // enable: bool(import.meta.env.VITE_SYNTHETIC_PLUGIN || true),
    components: json(import.meta.env.VITE_SYNTHETIC_COMPONENTS || '{"talk":{},"meet":{},"hive":{},"flow":{"url":"http://localhost:7860/"},"node":{"url":"http://localhost:1880/"},"code":{"url":"http://localhost:8000/"},"note":{"url":"http://localhost:8889/lab?token=my-token-abc"},"sell":{"url":"http://localhost:8059"},"train":{"url":"http://localhost:8180/vnc.html"},"bank":{"url":"http://localhost:4200"},"blockchain":{"url":"http://localhost:5000/ui"},"contract":{"url":"http://localhost:5109"},"blockchain1":{"url":"http://localhost:5001/ui"},"contract1":{"url":"http://localhost:5209"},"blockchain2":{"url":"http://localhost:5002/ui"},"contract2":{"url":"http://localhost:5309"},"ecommerce":{"url":"http://localhost:9012"},"storefront":{"url":"http://localhost:8012"},"docs":{"url":"http://localhost:9188"}}'),
  },

  iframe: {
    topOffset: num(import.meta.env.VITE_IFRAME_TOP_OFFSET || 40),
    bottomOffset: num(import.meta.env.VITE_IFRAME_BOTTOM_OFFSET || 0),
  },

  account: {
    start: import.meta.env.VITE_ACCOUNT_START || '/dash',
  },

  dash: {
    enable: bool(import.meta.env.VITE_DASH_ENABLE || true),
  },

  hive: {
    enable: bool(import.meta.env.VITE_HIVE_ENABLE || true),
    skip: 0,
    limit: 1000,
  },

  chat: {
    enable: bool(import.meta.env.VITE_CHAT_ENABLE || true),
  },

  map: {
    enable: bool(import.meta.env.VITE_MAP_ENABLE || true),
    skip: 0,
    limit: 1000,
  },

  omni: {
    enable: bool(import.meta.env.VITE_OMNI_ENABLE || true),
    skip: 0,
    limit: 1000,
  },

  data: {
    enable: bool(import.meta.env.VITE_DATA_ENABLE || true),
    skip: 0,
    limit: 1000,
  },

  o11y: {
    enable: bool(import.meta.env.VITE_O11Y_ENABLE || false),
    skip: 0,
    limit: 1000,
  },

  apps: {
    enable: bool(import.meta.env.VITE_APPS_ENABLE || true),
    registryUrl: import.meta.env.VITE_APPS_REGISTRY_URL || 'https://hyag.org',
  },

  docs: {
    enable: bool(import.meta.env.VITE_DOCS_ENABLE || true),
    // url: import.meta.env.VITE_DOCS_URL || 'http://docs.dev.local:9298/',
    url: import.meta.env.VITE_DOCS_URL || 'https://docs.h9y.ai/',
    // http://docs.dev.local:9298/
    i18n: {
      'en-US': '',
      'ru-RU': '/ru',
    },
  },

  profile: {
    enable: bool(import.meta.env.VITE_PROFILE_ENABLE || true),
  },

  subscription: {
    enable: bool(import.meta.env.VITE_SUBSCRIPTION_ENABLE || false),
  },

  subscribe: {
    enable: bool(import.meta.env.VITE_SUBSCRIBE_ENABLE || false),
  },

  keys: {
    enable: bool(import.meta.env.VITE_KEYS_ENABLE || true),
  },

  vault: {
    enable: bool(import.meta.env.VITE_VAULT_ENABLE || true),
  },

  wallet: {
    enable: bool(import.meta.env.VITE_WALLET_ENABLE || false),
  },

  settings: {
    enable: bool(import.meta.env.VITE_SETTINGS_ENABLE || true),
  },

  xmpp: {
    host: import.meta.env.VITE_XMPP_HOST || 'localhost',
    boshServiceUrl: import.meta.env.VITE_XMPP_BOSH_SERVICE_URL || '',  // 'https://localhost:5281/http-bind/',
    discoverConnectionMethods: bool(import.meta.env.VITE_XMPP_DISCOVER_CONNECTION_METHODS || false),
    websocketUrl: import.meta.env.VITE_XMPP_WEBSOCKET_URL || 'wss://localhost:5281/xmpp-websocket',
    mucHost: import.meta.env.VITE_XMPP_MUC_HOST || 'conference.localhost',
    shareHost: import.meta.env.VITE_XMPP_SHARE_HOST || 'share.localhost',
    shareUrlPrefix: import.meta.env.VITE_XMPP_SHARE_URL_PREFIX || 'https://selfdev-api.dev.local:6369/v1/files/',
  },

  umami: {
    enable: bool(import.meta.env.VITE_UMAMI_ENABLE || false),
    url: import.meta.env.VITE_UMAMI_URL || 'http://umami.dev.local:3083/script.js',
    websiteId: import.meta.env.VITE_UMAMI_WEBSITE_ID || 'TBS',
  },

  protocol: {
    enable: bool(import.meta.env.VITE_PROTOCOL_ENABLE || true),
    proto: import.meta.env.VITE_PROTOCOL_PROTO || "web+hyag",
  },

  compose: {
    profiles: arr(import.meta.env.VITE_COMPOSE_PROFILES || 'all'),
  },
}

export default conf
