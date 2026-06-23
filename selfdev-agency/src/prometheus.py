import os
import time
import logging
import uuid
import asyncio

from dotenv import load_dotenv
from prometheus_client import CollectorRegistry, push_to_gateway

from conf import has_profile

load_dotenv()

PROMETHEUS_PUSHGATEWAY_URL = os.getenv("PROMETHEUS_PUSHGATEWAY_URL", 'http://pushgateway:9091')
PROMETHEUS_PUSH_INTERVAL_SEC = int(os.getenv("PROMETHEUS_PUSH_INTERVAL_SEC", "30"))

CONTAINER_ID = os.getenv("CONTAINER_ID", os.getenv("HOSTNAME", str(uuid.uuid4())))

logger = logging.getLogger("prometheus")

prometheus_registry = CollectorRegistry()


async def push_metrics_async():
  """Push metrics once (async wrapper around push_to_gateway)."""
  if not has_profile(['all', 'h9y', 'metrics']):
    return None
  # push_to_gateway is blocking, so run it in a thread pool executor
  # to avoid blocking the event loop
  loop = asyncio.get_running_loop()
  try:
    await loop.run_in_executor(
      None,
      lambda: push_to_gateway(
        gateway=PROMETHEUS_PUSHGATEWAY_URL,
        job=CONTAINER_ID,
        registry=prometheus_registry,
        grouping_key={"containerId": CONTAINER_ID},
      )
    )
  except Exception as err:
    logger.error(f"Error pushing metrics: {err}")


async def prometheus_pusher():
  """Async loop similar to setInterval in Node.js."""
  if not has_profile(['all', 'h9y', 'metrics']):
    return None
  while True:
    logger.debug('Pushing metrics to Prometheus gateway')
    await push_metrics_async()
    logger.debug(f'Sleeping for {PROMETHEUS_PUSH_INTERVAL_SEC} seconds...')
    await asyncio.sleep(PROMETHEUS_PUSH_INTERVAL_SEC)

