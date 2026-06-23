''' Config '''
import os
import logging
import json as _json

from dotenv import load_dotenv

logger = logging.getLogger("opensearch")
logger.setLevel(logging.DEBUG)


# Load environment variables
load_dotenv()


def bool_(val):
  return val in ('true', '1', True, 1)


def json_(val):
  return _json.loads(val) if val else None


def num(val):
  if val:
    return float(val) if '.' in str(val) else int(val)
  return 0 if val == 0 else None


def arr(s):
  return s.split(',') if s else []


COMPOSE_PROFILES = arr(os.getenv('COMPOSE_PROFILES', 'all'))


def has_profile(profiles):
  return any(x in COMPOSE_PROFILES for x in profiles)
