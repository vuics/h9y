-- Load environment variable function
local function split(str, sep)
  local t = {}
  for s in string.gmatch(str, "([^"..sep.."]+)") do
    s = s:match("^%s*(.-)%s*$")  -- trim spaces
    table.insert(t, s)
  end
  return t
end

-- Prosody Example Configuration File
--
-- Information on configuring Prosody can be found on our
-- website at https://prosody.im/doc/configure
--
-- Tip: You can check that the syntax of this file is correct
-- when you have finished by running this command:
--     prosodyctl check config
-- If there are any errors, it will let you know what and where
-- they are, otherwise it will keep quiet.
--
-- The only thing left to do is rename this file to remove the .dist ending, and fill in the
-- blanks. Good luck, and happy Jabbering!

-- pidfile = "/var/run/prosody/prosody.pid" -- this is the default on Debian
pidfile = "/tmp/prosody.pid" -- this is the default on Debian


---------- Server-wide settings ----------
-- Settings in this section apply to the whole server and are the default settings
-- for any virtual hosts

-- This is a (by default, empty) list of accounts that are admins
-- for the server. Note that you must create the accounts separately
-- (see https://prosody.im/doc/creating_accounts for info)
-- Example: admins = { "user1@example.com", "user2@example.net" }

-- admins = { }
admins = split((os.getenv("ADMINS") or ""), ",")

-- This option allows you to specify additional locations where Prosody
-- will search first for modules. For additional modules you can install, see
-- the community module repository at https://modules.prosody.im/
--plugin_paths = {}

-- This is the list of modules Prosody will load on startup.
-- Documentation for bundled modules can be found at: https://prosody.im/doc/modules
modules_enabled = {

  -- Generally required
  "disco"; -- Service discovery
  "roster"; -- Allow users to have a roster. Recommended ;)
  "saslauth"; -- Authentication for clients and servers. Recommended if you want to log in.
  "tls"; -- Add support for secure TLS on c2s/s2s connections

  -- Not essential, but recommended
  "blocklist"; -- Allow users to block communications with other users
  "bookmarks"; -- Synchronise the list of open rooms between clients
  "carbons"; -- Keep multiple online clients in sync
  "dialback"; -- Support for verifying remote servers using DNS
  "limits"; -- Enable bandwidth limiting for XMPP connections
  "pep"; -- Allow users to store public and private data in their account
  "private"; -- Legacy account storage mechanism (XEP-0049)
  "smacks"; -- Stream management and resumption (XEP-0198)
  "vcard4"; -- User profiles (stored in PEP)
  "vcard_legacy"; -- Conversion between legacy vCard and PEP Avatar, vcard

  -- Nice to have
  "csi_simple"; -- Simple but effective traffic optimizations for mobile devices
  "invites"; -- Create and manage invites
  "invites_adhoc"; -- Allow admins/users to create invitations via their client
  "invites_register"; -- Allows invited users to create accounts
  "ping"; -- Replies to XMPP pings with pongs
  "register"; -- Allow users to register on this server using a client and change passwords
  "time"; -- Let others know the time here on this server
  "uptime"; -- Report how long server has been running
  "version"; -- Replies to server version requests
  "mam"; -- Store recent messages to allow multi-device synchronization
  "turn_external"; -- Provide external STUN/TURN service for e.g. audio/video calls

  -- Admin interfaces
  "admin_adhoc"; -- Allows administration via an XMPP client that supports ad-hoc commands
  "admin_shell"; -- Allow secure administration via 'prosodyctl shell'

  -- HTTP modules
  --"bosh"; -- Enable BOSH clients, aka "Jabber over HTTP"
  --"http_openmetrics"; -- for exposing metrics to stats collectors
  --"websocket"; -- XMPP over WebSockets

  -- Other specific functionality
  --"announce"; -- Send announcement to all online users
  --"groups"; -- Shared roster support
  --"legacyauth"; -- Legacy authentication. Only used by some old clients and bots.
  --"mimicking"; -- Prevent address spoofing
  --"motd"; -- Send a message to users when they log in
  --"proxy65"; -- Enables a file transfer proxy service which clients behind NAT can use
  "s2s_bidi"; -- Bi-directional server-to-server (XEP-0288)
  --"server_contact_info"; -- Publish contact information for this service
  --"tombstones"; -- Prevent registration of deleted accounts
  --"watchregistrations"; -- Alert admins of registrations
  --"welcome"; -- Welcome users who register accounts

  "conversejs";
  "muc_mam";
  "http";
  "s2s";
}

-- These modules are auto-loaded, but should you want
-- to disable them then uncomment them here:
modules_disabled = {
  -- "offline"; -- Store offline messages
  -- "c2s"; -- Handle client connections
  -- "s2s"; -- Handle server-to-server connections
  -- "posix"; -- POSIX functionality, sends server to background, etc.

  -- "mod_bosh";
  -- "mod_websocket";
}


-- Server-to-server authentication
-- Require valid certificates for server-to-server connections?
-- If false, other methods such as dialback (DNS) may be used instead.

-- s2s_secure_auth = true
s2s_secure_auth = false

-- Some servers have invalid or self-signed certificates. You can list
-- remote domains here that will not be required to authenticate using
-- certificates. They will be authenticated using other methods instead,
-- even when s2s_secure_auth is enabled.

--s2s_insecure_domains = { "insecure.example", "localhost", "127.0.0.1" }
s2s_insecure_domains = split((os.getenv("S2S_INSECURE_DOMAINS") or ""), ",")

-- Even if you disable s2s_secure_auth, you can still require valid
-- certificates for some domains by specifying a list here.

s2s_secure_domains = split((os.getenv("S2S_SECURE_DOMAINS") or ""), ",")

-- Rate limits
-- Enable rate limits for incoming client and server connections. These help
-- protect from excessive resource consumption and denial-of-service attacks.

limits = {
  c2s = {
    rate = "10kb/s";
  };
  s2sin = {
    rate = "30kb/s";
  };
}

-- Authentication
-- Select the authentication backend to use. The 'internal' providers
-- use Prosody's configured data storage to store the authentication data.
-- For more information see https://prosody.im/doc/authentication

authentication = "internal_hashed"
-- authentication = "any"
-- authentication = "anonymous"

-- Many authentication providers, including the default one, allow you to
-- create user accounts via Prosody's admin interfaces. For details, see the
-- documentation at https://prosody.im/doc/creating_accounts


-- Storage
-- Select the storage backend to use. By default Prosody uses flat files
-- in its configured data directory, but it also supports more backends
-- through modules. An "sql" backend is included by default, but requires
-- additional dependencies. See https://prosody.im/doc/storage for more info.

-- storage = "sql" -- Default is "internal"
storage = (os.getenv("STORAGE") or "internal")

-- For the "sql" backend, you can uncomment *one* of the below to configure:
--sql = { driver = "SQLite3", database = "prosody.sqlite" } -- Default. 'database' is the filename.
--sql = { driver = "MySQL", database = "prosody", username = "prosody", password = "secret", host = "localhost" }
--sql = { driver = "PostgreSQL", database = "prosody", username = "prosody", password = "secret", host = "localhost" }
sql = {
  driver = (os.getenv("SQL_DRIVER") or "PostgreSQL"),
  database = (os.getenv("SQL_DATABASE") or "postgres_prosody"),
  username = (os.getenv("SQL_USER") or "postgres_user"),
  password = (os.getenv("SQL_PASSWORD") or "postgres_secret_123"),
  host = (os.getenv("SQL_HOST") or "localhost")
}


-- Archiving configuration
-- If mod_mam is enabled, Prosody will store a copy of every message. This
-- is used to synchronize conversations between multiple clients, even if
-- they are offline. This setting controls how long Prosody will keep
-- messages in the archive before removing them.

-- archive_expires_after = "1w" -- Remove archived messages after 1 week
archive_expires_after = "never" -- keep messages forever
default_archive_policy = true
max_archive_query_results = 50

-- You can also configure messages to be stored in-memory only. For more
-- archiving options, see https://prosody.im/doc/modules/mod_mam


-- Audio/video call relay (STUN/TURN)
-- To ensure clients connected to the server can establish connections for
-- low-latency media streaming (such as audio and video calls), it is
-- recommended to run a STUN/TURN server for clients to use. If you do this,
-- specify the details here so clients can discover it.
-- Find more information at https://prosody.im/doc/turn

-- Specify the address of the TURN service (you may use the same domain as XMPP)
-- turn_external_host = "eturnal.dev.local"
turn_external_host = (os.getenv("TURN_HOST") or "eturnal.localhost")
turn_external_port = 3478

-- This secret must be set to the same value in both Prosody and the TURN server
turn_external_secret = "turn-external-secret-access-token"


-- Logging configuration
-- For advanced logging see https://prosody.im/doc/logging
log = {
  -- info = "/opt/homebrew/var/log/prosody/prosody.log"; -- Change 'info' to 'debug' for verbose logging
  -- error = "/opt/homebrew/var/log/prosody/prosody.err";
  -- "*syslog"; -- Uncomment this for logging to syslog
  "*console"; -- Log to the console, useful for debugging when running in the foreground
}


-- Uncomment to enable statistics
-- For more info see https://prosody.im/doc/statistics
-- statistics = "internal"


-- Certificates
-- Every virtual host and component needs a certificate so that clients and
-- servers can securely verify its identity. Prosody will automatically load
-- certificates/keys from the directory specified here.
-- For more information, including how to use 'prosodyctl' to auto-import certificates
-- (from e.g. Let's Encrypt) see https://prosody.im/doc/certificates

-- Location of directory to find certificates in (relative to main config file):
certificates = "certs"

-- Running behind a reverse proxy
-- https://prosody.im/doc/http
local HTTP_EXTERNAL_URL = os.getenv("HTTP_EXTERNAL_URL")
if HTTP_EXTERNAL_URL and HTTP_EXTERNAL_URL ~= "" then
  http_external_url = HTTP_EXTERNAL_URL
end
local TRUSTED_PROXIES = os.getenv("TRUSTED_PROXIES")
if TRUSTED_PROXIES and TRUSTED_PROXIES ~= "" then
  trusted_proxies = split(TRUSTED_PROXIES, ",")
end

----------- Virtual hosts -----------
-- You need to add a VirtualHost entry for each domain you wish Prosody to serve.
-- Settings under each VirtualHost entry apply *only* to that host.

-- VirtualHost "localhost"
-- Prosody requires at least one enabled VirtualHost to function. You can
-- safely remove or disable 'localhost' once you have added another.

--VirtualHost "example.com"
VirtualHost (os.getenv("HOST") or "localhost")

------ Components ------
-- You can specify components to add hosts that provide special services,
-- like multi-user conferences, and transports.
-- For more information on components, see https://prosody.im/doc/components

---Set up a MUC (multi-user chat) room server on conference.example.com:
--Component "conference.example.com" "muc"
--- Store MUC messages in an archive and allow users to access it
--modules_enabled = { "muc_mam" }

-- Component "conference.selfdev-prosody.dev.local" "muc"
Component (os.getenv("MUC_HOST") or "conference.localhost") "muc"
  name = "The selfdev-prosody chatrooms server"
  restrict_room_creation = false
  modules_enabled = { "muc_mam" } -- Store MUC messages in an archive and allow users to access it

---Set up a file sharing component
--Component "share.example.com" "http_file_share"
-- Component "share.selfdev-prosody.dev.local" "http_file_share"
Component (os.getenv("SHARE_HOST") or "share.localhost") "http_file_share"
  modules_enabled = { "muc_mam" } -- Store MUC messages in an archive and allow users to access it
  muc_log_by_default = true
  muc_log_presences = true
  muc_log_expires_after = "never"

  -- Tell Prosody we don't need server-to-server
  -- connections (s2s), because this service is
  -- only for local users anyway.
  modules_disabled = { "s2s" }

  -- Larger files: Change the Limit to 100MB:
  http_file_share_size_limit = 100 * 1024 * 1024
  -- Daily quota: 100 MiB per day per user
  http_file_share_daily_quota = 100 * 1024 * 1024
  -- Global quota: 1 GiB total
  http_file_share_global_quota = 1024 * 1024 * 1024

  -- NOTE: this setting disables the file share (@alphara)
  -- Retention
  -- http_file_share_expires_after = "never"
  -- http_file_share_expires_after = "2 weeks"

  -- NOTE: this setting disables the file share (@alphara)
  -- -- Set it to the same as the apache host above:
  -- http_external_url = (os.getenv("SHARE_HOST") or "share.localhost")
  -- -- here you see how we can manipulate the path:
  -- http_paths = {
  --   file_share = "/"; --Serve from the base URL
  -- }

  -- Generate links pointing to https://example.com
  -- instead of https://upload.example.com
  http_host = (os.getenv("HOST") or "localhost")

  -- The http_file_share_access setting can be specified to limit access
  -- to certain users or hosts, including hosts on other servers. Be careful!
  -- In Prosody 13.0+ access can also be customized with the
  -- http_file_share:upload permission.
  -- http_file_share_access = {
  --   "filesharingenthusiast@example.net", -- this specific user
  --   "example.org", -- anyone with a @example.org address
  -- }

  -- Restricting file types to {"image/*","video/*","audio/*","text/plain"}
  -- http_file_share_allowed_file_types = { "image/*" }

---Set up an external component (default component port is 5347)
--
-- External components allow adding various services, such as gateways/
-- bridges to non-XMPP networks and services. For more info
-- see: https://prosody.im/doc/components#adding_an_external_component
--
--Component "gateway.example.com"
--  component_secret = "password"


---------- End of the Prosody Configuration file ----------
-- You usually **DO NOT** want to add settings here at the end, as they would
-- only apply to the last defined VirtualHost or Component.
--
-- Settings for the global section should go higher up, before the first
-- VirtualHost or Component line, while settings intended for specific hosts
-- should go under the corresponding VirtualHost or Component line.
--
-- For more information see https://prosody.im/doc/configure

conversejs_options = {
  debug = true;
  view_mode = "fullscreen";
  -- view_mode = "overlayed";
  -- view_mode = "mobile";
  -- view_mode = "embedded";
}
