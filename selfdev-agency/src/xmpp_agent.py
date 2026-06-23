'''
Base XMPP Agent
'''
import os
import logging
import ssl
import asyncio
import base64
from io import BytesIO
# from xml.etree.ElementTree import QName

from slixmpp import ClientXMPP
import httpx
from dotenv import load_dotenv
from aiohttp import ClientSession
import magic

from helpers import str_to_bool
from opensearch import send_log
from prometheus_client import Counter
from prometheus import prometheus_registry

logger = logging.getLogger("XmppAgent")

load_dotenv()

ALLOW_INSECURE = str_to_bool(os.getenv("ALLOW_INSECURE", "False"))
XMPP_COMMANDER_URL = os.getenv("XMPP_COMMANDER_URL", "http://localhost:8387")
XMPP_CONNECT_HOST = os.getenv("XMPP_CONNECT_HOST", "")
XMPP_CONNECT_PORT = int(os.getenv("XMPP_CONNECT_PORT", "5222"))
XMPP_RECONNECT_MAX_DELAY = int(os.getenv("XMPP_RECONNECT_MAX_DELAY", "300"))
XMPP_SHARE_HOST = os.getenv("XMPP_SHARE_HOST", "share.localhost")
XMPP_SHARE_URL_PREFIX = os.getenv("XMPP_SHARE_URL_PREFIX", "https://selfdev-prosody.dev.local:5281/file_share/")
API_FILES_URL = os.getenv("API_FILES_URL", "https://selfdev-prosody.dev.local:5281/file_share/")


# FIXME: Set verify=True to check the certificates
SSL_VERIFY = str_to_bool(os.getenv("SSL_VERIFY", "true"))


h9y_messages_received_total = Counter(
  'h9y_messages_received_total',
  'Number of messages the agent received from XMPP',
  ['channel', 'agentId', 'userId', 'archetype', 'name'],
  registry=prometheus_registry,
)
h9y_messages_sent_total = Counter(
  'h9y_messages_sent_total',
  'Number of messages the agent sent from XMPP',
  ['channel', 'agentId', 'userId', 'archetype', 'name'],
  registry=prometheus_registry,
)


class XmppAgent(ClientXMPP):
  """
  A Base XMPP Agent
  """

  def __init__(self, *,
               host, user, password, muc_host, join_rooms, nick, config,
               ownername, customerId):
    jid = f"{user}@{ownername}.{host}"
    super().__init__(jid, password)
    # ClientXMPP.__init__(self, jid, password)

    self.host = f"{ownername}.{host}"
    # self.host = host
    self.user = user
    self.jid = jid
    self.password = password
    self.muc_host = muc_host
    self.join_rooms = join_rooms
    self.nick = nick
    self.join_room_jids = [f"{room}@{muc_host}" for room in self.join_rooms]
    self.config = config
    self.ownername = ownername
    self.customerId = customerId

    self.metadata = {
      "agentId": self.config.id,
      "userId": self.config.userId,
      "archetype": self.config.archetype,
      "name": self.config.name,
    }

    # logger.debug(f'jid: {self.jid}')
    # logger.debug(f'host: {self.host}')
    # logger.debug(f'user: {self.user}')
    # logger.debug(f'ownername: {self.ownername}')

    # Reconnection backoff variables
    self.reconnect_attempts = 0
    self.current_delay = 1  # Start with 1 second

    self.presence_replied = []

    if ALLOW_INSECURE:
      # Allow insecure certificates
      logger.debug("Allowing insecure SSL connections")
      self.ssl_context = ssl.create_default_context()
      self.ssl_context.check_hostname = False
      self.ssl_context.verify_mode = ssl.CERT_NONE
      self.add_event_handler('ssl_invalid_cert', self.ssl_invalid_cert)

    self.add_event_handler('connected', self.connected)
    self.add_event_handler('failed_auth', self.failed_auth)

    # The session_start event will be triggered when
    # the bot establishes its connection with the server
    # and the XML streams are ready for use. We want to
    # listen for this event so that we we can initialize
    # our roster.
    self.add_event_handler("session_start", self.session_start)

    # The message event is triggered whenever a message
    # stanza is received. Be aware that that includes
    # MUC messages and error messages.
    self.add_event_handler("message", self.message)

    # The groupchat_message event is triggered whenever a message
    # stanza is received from any chat room. If you also also
    # register a handler for the 'message' event, MUC messages
    # will be processed by both handlers.
    self.add_event_handler("groupchat_message", self.groupchat_message)

    # The groupchat_presence event is triggered whenever a
    # presence stanza is received from any chat room, including
    # any presences you send yourself. To limit event handling
    # to a single room, use the events muc::room@server::presence,
    # muc::room@server::got_online, or muc::room@server::got_offline.
    for room_jid in self.join_room_jids:
      self.add_event_handler("muc::%s::got_online" % room_jid,
                             self.muc_online)

    self.add_event_handler("groupchat_direct_invite",
                           self.groupchat_direct_invite)

    self.register_plugin('xep_0030')  # Service Discovery
    self.register_plugin('xep_0045')  # Multi-User Chat
    self.register_plugin('xep_0199')  # XMPP Ping
    self.register_plugin('xep_0004')  # Data Forms
    self.register_plugin('xep_0060')  # PubSub
    self.register_plugin('xep_0249')  # Direct MUC Invitations
    self.register_plugin("xep_0363")  # HTTP File Upload

  async def slog(self, level: str, message: str, meta: dict = None):
    logger.debug(f'slog level: {level} message: {message}')
    if meta is None:
      meta = {}
    await send_log(level, message, {
      **meta,
      "agentId": self.config.id,
      "userId": self.config.userId,
      "archetype": self.config.archetype,
      "name": self.config.name,
    })

  async def connect(self):
    if self.reconnect_attempts == 0:
      logger.info("Connection attempt.")
    else:
      logger.info(f"Reconnection attempt {self.reconnect_attempts}. Waiting {self.current_delay} seconds before trying again.")
      await asyncio.sleep(self.current_delay)
      self.current_delay = min(self.current_delay * 2, XMPP_RECONNECT_MAX_DELAY)
    self.reconnect_attempts += 1

    if XMPP_CONNECT_HOST:
      super().connect((XMPP_CONNECT_HOST, XMPP_CONNECT_PORT))
    else:
      super().connect()

  def connected(self, data):
    logger.info(f'{self.jid} agent is connected. Data: {data}')
    # Reset reconnection parameters on successful connection
    self.reconnect_attempts = 0
    self.current_delay = 1

  def ssl_invalid_cert(self, pem_cert):
    logger.warning("Warning: Invalid SSL certificate received")
    return True

  async def failed_auth(self, event):
    logger.debug(f'{self.jid} Failed auth: {event}')
    condition = event.get_condition()
    text = event._get_sub_text('text')
    logger.debug(f'{self.jid} Failed auth> condition: {condition}, text: {text}')
    if text == "Unable to authorize you with the authentication credentials you've sent.":
      logger.debug('I can register the user')
      registered = await self.register_user()
      if registered:
        logger.debug('User registered. Reconnect')
        await self.connect()
      else:
        logger.error(f'Error registering user: {self.jid}')

  async def register_user(self):
    # logger.info(f'Register a new XMPP user with credentials> user: {self.user}, password: {self.password}')
    try:
      async with httpx.AsyncClient() as client:
        response = await client.get(
          f"{XMPP_COMMANDER_URL}/register-agent",
          params={
            "user": self.user,
            "password": self.password,
            "host": self.host,
          },
          headers={"Content-Type": "application/json"}
        )
      logger.debug(f'XMPP Registration Status Code: {response.status_code}')
      logger.debug(f'XMPP Registration Data: {response.text}')
      if response.status_code >= 400:
        return False
      return True
    except Exception as e:
      logger.error(f'XMPP registration error: {e}')
      return False

  async def session_start(self, event):
    """
    Process the session_start event.

    Typical actions for the session_start event are
    requesting the roster and broadcasting an initial
    presence stanza.

    Arguments:
      event -- An empty dictionary. The session_start
           event does not provide any additional
           data.
    """
    await self.get_roster()
    self.send_presence()
    # logger.debug('Session started')
    for room_jid in self.join_room_jids:
      logger.info(f'  Join room> jid: {room_jid},  nick: {self.nick}')
      self.plugin['xep_0045'].join_muc(room_jid, self.nick)

  async def start(self):
    await self.slog('info', 'Starting agent')
    await self.register_user()
    await self.connect()

  async def chat(self, *, prompt, reply_func=None):
    await self.slog('info', 'Agent received prompt')
    logger.warning("WARNING: XmppAgent.chat() should be defined in child class")
    return '(none)'

  async def message(self, msg):
    """
    Process incoming message stanzas. Be aware that this also
    includes MUC messages and error messages. It is usually
    a good idea to check the messages's type before processing
    or sending replies.

    Arguments:
      msg -- The received message stanza. See the documentation
           for stanza objects and the Message stanza to see
           how it may be used.
    """
    # logger.debug(f'msg: {msg}')
    # logger.debug(f'msg type: {msg['type']}')
    # logger.debug(f'msg body: {msg['body']}')
    # logger.debug(f'msg mucnick: {msg['mucnick']}')
    # logger.debug(f'msg from: {msg['from']}')
    if msg['type'] in ('chat', 'normal'):
      try:
        h9y_messages_received_total.labels(channel='chat', **self.metadata).inc(1)

        def reply_func(content):
          h9y_messages_sent_total.labels(channel='chat', **self.metadata).inc(1)
          self.send_message(mto=msg['from'].bare,
                            mbody=content,
                            mtype='chat')

        content = await self.chat(prompt=msg['body'], reply_func=reply_func)
        reply_func(content)
      except Exception as err:
        logger.error(f'message error: {err}')

  async def groupchat_message(self, msg):
    """
    Process incoming message stanzas from any chat room. Be aware
    that if you also have any handlers for the 'message' event,
    message stanzas may be processed by both handlers, so check
    the 'type' attribute when using a 'message' event handler.

    Whenever the bot's nickname is mentioned, respond to
    the message.

    IMPORTANT: Always check that a message is not from yourself,
           otherwise you will create an infinite loop responding
           to your own messages.

    This handler will reply to messages that mention
    the bot's nickname.

    Arguments:
      msg -- The received message stanza. See the documentation
           for stanza objects and the Message stanza to see
           how it may be used.
    """
    # logger.debug(f'msg: {msg}')
    # logger.debug(f'msg type: {msg['type']}')
    # logger.debug(f'msg body: {msg['body']}')
    # logger.debug(f'msg mucnick: {msg['mucnick']}')
    # logger.debug(f'msg from: {msg['from']}')
    if msg['mucnick'] != self.nick and self.nick in msg['body']:
      try:
        h9y_messages_received_total.labels(channel='group', **self.metadata).inc(1)

        def reply_func(content):
          h9y_messages_sent_total.labels(channel='group', **self.metadata).inc(1)
          self.send_message(mto=msg['from'].bare,
                            mbody=content,
                            mtype='groupchat')

        # Detect <reference type="mention">
        for ref in msg.xml.findall('{urn:xmpp:reference:0}reference'):
          if ref.get('type') == 'mention':
            uri = ref.get('uri')
            if uri.endswith(f'/{self.nick}'):
              logger.debug(f"🔔 Mention detected via reference: {ref}")

              content = await self.chat(prompt=msg['body'], reply_func=reply_func)
              reply_func(content)

      except Exception as err:
        logger.error('groupchat_message error:', err)
    # elif msg['mucnick'] != self.nick:
    #   self.send_message(mto=msg['from'].bare,
    #                     mbody=f"Echo: {msg['body']}",
    #                     mtype='groupchat')

  def muc_online(self, presence):
    """
    Process a presence stanza from a chat room. In this case,
    presences from users that have just come online are
    handled by sending a welcome message that includes
    the user's nickname and role in the room.

    Arguments:
      presence -- The received presence stanza. See the
            documentation for the Presence stanza
            to see how else it may be used.
    """
    logger.debug(f'presense: {presence}')
    if presence['muc']['nick'] != self.nick:
      if not presence['from'].bare in self.presence_replied:
        self.send_message(mto=presence['from'].bare,
                          mbody="Hello!",
                          # NOTE: agents start talking if mention them
                          # mbody="Hello, %s %s" % (presence['muc']['role'], presence['muc']['nick']),
                          mtype='groupchat')
        self.presence_replied.append(presence['from'].bare)

  async def groupchat_direct_invite(self, msg):
    """
    Handler for direct MUC invitations.
    """
    logger.debug(f'Groupchat Invite msg: {msg}')
    logger.debug(f"  Inviter: {msg['from']}")
    logger.debug(f"  Invitee: {msg['to']}")
    invite = msg.xml.find('.//{jabber:x:conference}x')
    room_jid = invite.get('jid')
    logger.debug(f"  Room: {room_jid}")
    logger.debug(f"  Reason: {invite.get('reason')}")

    logger.info(f'Joining the room by invite> room_jid: {room_jid}')
    self.add_event_handler("muc::%s::got_online" % room_jid, self.muc_online)
    self.plugin['xep_0045'].join_muc(room_jid, self.nick)

  async def upload_file(self, *,
                        file_base64: str = None,
                        file_bytes: str = None,
                        file_iobytes: str = None,
                        filename: str,
                        content_type: str = None
                        ):
    try:
      if file_base64:
        file_bytes = base64.b64decode(file_base64)
        file_iobytes = BytesIO(file_bytes)
      elif file_bytes:
        file_iobytes = BytesIO(file_bytes)
      elif file_iobytes:
        file_bytes = file_iobytes.getvalue()
      else:
        raise Exception('Unknown file format')

      size = len(file_bytes)
      file_iobytes.seek(0)

      if not content_type:
        mime = magic.Magic(mime=True)
        content_type = mime.from_buffer(file_bytes)
        if not content_type:
          content_type = "application/octet-stream"

      slot = await self['xep_0363'].request_slot(
        filename=filename,
        size=size,
        content_type=content_type,
        jid=XMPP_SHARE_HOST,
      )

      ns = "urn:xmpp:http:upload:0"
      put_el = slot.xml.find(f".//{{{ns}}}put")
      get_el = slot.xml.find(f".//{{{ns}}}get")
      # logging.debug(f"put_el: {put_el}")
      # logging.debug(f"get_el: {get_el}")

      put_url = put_el.attrib.get("url") if put_el is not None else None
      get_url = get_el.attrib.get("url") if get_el is not None else None
      logging.debug(f"PUT URL: {put_url}")
      logging.debug(f"GET URL: {get_url}")

      auth_token = None
      if put_el is not None:
        header_el = put_el.find(f".//{{{ns}}}header")
        # logging.debug(f"header_el: {header_el}")
        if header_el is not None and header_el.attrib.get("name") == "Authorization":
          auth_token = header_el.text or ""
      # logging.debug(f"Auth token: {auth_token}")

      headers = {'Content-Type': content_type}
      if auth_token:
        headers['Authorization'] = auth_token
      async with ClientSession() as session:
        file_iobytes.seek(0)
        put_url1 = put_url.replace(XMPP_SHARE_URL_PREFIX, API_FILES_URL)
        logger.debug(f'Replace put_url: {put_url} with put_url1: {put_url1}')
        async with session.put(put_url1, data=file_iobytes, headers=headers, ssl=SSL_VERIFY) as resp:
          if resp.status not in (200, 201):
            text = await resp.text()
            raise Exception(f"Upload failed with status {resp.status}: {text}")
      return get_url
    except Exception as e:
      logging.error(f"Error uploading file: {e}")
      return None

  async def stop(self):
    await self.slog('info', 'Stopping agent')
    logger.debug('Disconnecting the agent from xmpp...')
    super().send_presence(
      ptype='unavailable',
      pshow='offline',
      pstatus='Agent stopped'
    )
    super().disconnect(wait=True)
    logger.info('Disconnected the agent from xmpp')
