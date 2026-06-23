"""
Usage tracking with meters for agents
"""
import os
import json
import logging

from stripe import StripeError, StripeClient
from dotenv import load_dotenv, find_dotenv

from helpers import str_to_bool

logger = logging.getLogger("metering")

# Setup Stripe python client library
load_dotenv(find_dotenv())

STRIPE_ENABLE = str_to_bool(os.getenv("STRIPE_ENABLE", "False"))
STRIPE_SECRET_KEY = os.getenv('STRIPE_SECRET_KEY')

stripe_client = None
if STRIPE_ENABLE:
  if STRIPE_SECRET_KEY is None:
    raise ValueError("STRIPE_SECRET_KEY environment variable is not set")
  else:
    stripe_client = StripeClient(api_key=STRIPE_SECRET_KEY, stripe_version='2024-09-30.acacia')


def meter_event(*, event_name, customerId, value=1):
  ''' Create meter event '''
  try:
    logger.debug(f"Meter event: {event_name} ({value}) for {customerId}. Stripe enabled: {STRIPE_ENABLE}")
    if not STRIPE_ENABLE:
      return
    if customerId is None:
      raise ValueError('customerId is not set')
    meterEvent = stripe_client.v2.billing.meter_events.create(params={
      'event_name': event_name,
      'payload': {
        'value': str(value),
        'stripe_customer_id': customerId,
      }
    })
    logger.debug(f"Meter event created: {meterEvent}")
  except StripeError as e:
    logger.error(f"Meter event Stripe error: {e._message}")
  except Exception as e:
    logger.error(f"Meter event error: {e}")

