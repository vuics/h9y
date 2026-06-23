#!/usr/bin/env python

import asyncio

from agency_core import run_agency

# Import agent classes
from hermes_v1 import HermesV1

# Map of agent class names to their actual classes
ARCHETYPE_CLASSES = {
  "hermes-v1.0": HermesV1,
}

if __name__ == "__main__":
  asyncio.run(run_agency(ARCHETYPE_CLASSES))
