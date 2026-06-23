''' OpenSearch '''
import os
import logging
from datetime import datetime

from dotenv import load_dotenv
from opensearchpy import AsyncOpenSearch

from helpers import str_to_bool
from conf import has_profile

logger = logging.getLogger("opensearch")
logger.setLevel(logging.DEBUG)

# Load environment variables
load_dotenv()

OPENSEARCH_SECURE = str_to_bool(os.getenv('OPENSEARCH_SECURE', 'true'))
OPENSEARCH_USERNAME = os.getenv('OPENSEARCH_USERNAME', 'admin')
OPENSEARCH_PASSWORD = os.getenv('OPENSEARCH_PASSWORD', 'freeS0cketKeep-1iveTimeout')
OPENSEARCH_HOST = os.getenv('OPENSEARCH_HOST', 'opensearch-node1')
OPENSEARCH_PORT = int(os.getenv('OPENSEARCH_PORT', '9200'))

# Global async client
async_opensearch: AsyncOpenSearch | None = None


async def connect_to_opensearch() -> AsyncOpenSearch:
  """
  Initialize AsyncOpenSearch client. Call once at agent startup.
  """
  global async_opensearch
  if not has_profile(['all', 'h9y', 'logs']):
    return None
  try:
    if async_opensearch is not None:
      logger.debug("AsyncOpenSearch client already exists.")
    else:
      logger.debug('Connecting to OpenSearch')
      async_opensearch = AsyncOpenSearch(
        hosts=[{
          "host": OPENSEARCH_HOST,
          "port": OPENSEARCH_PORT,
          "scheme": "https" if OPENSEARCH_SECURE else "http",
        }],
        http_auth=(OPENSEARCH_USERNAME, OPENSEARCH_PASSWORD),
        http_compress=True,     # enables gzip compression
        use_ssl=OPENSEARCH_SECURE,
        verify_certs=False,     # same as rejectUnauthorized: false
        ssl_assert_hostname=False,
        ssl_show_warn=False,
      )
      logger.debug(f"Connected to OpenSearch: {async_opensearch}")
    return async_opensearch
  except Exception as e:
    logger.error("Error connecting to AsyncOpenSearch: %s", e)
    async_opensearch = None
    return None


async def disconnect_from_opensearch():
  """
  Close the async OpenSearch client when shutting down the agent.
  """
  global async_opensearch
  if not has_profile(['all', 'h9y', 'logs']):
    return None
  if async_opensearch is not None:
    await async_opensearch.close()
    async_opensearch = None
    logger.debug("AsyncOpenSearch client closed.")


async def send_log(level: str, message: str, meta: dict = None):
  """
  Send a log document to OpenSearch asynchronously.
  """
  global async_opensearch
  if not has_profile(['all', 'h9y', 'logs']):
    return None
  if async_opensearch is None:
    logger.error("AsyncOpenSearch client is not initialized.")
    # await connect_to_opensearch()
    return

  if meta is None:
    meta = {}

  doc = {
    "@timestamp": datetime.utcnow().isoformat() + "Z",
    "level": level,
    "message": message,
    **meta,
  }

  try:
    await async_opensearch.index(
      index="logs",
      body=doc,
    )
    logger.debug(f"Log sent: {doc}")
  except Exception as e:
    logger.error("Failed to send async log: %s", e)
