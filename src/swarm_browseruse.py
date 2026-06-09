#!/usr/bin/env python

import asyncio

from agency_core import run_agency

# Import agent classes
from browseruse_v1 import BrowseruseV1

# Map of agent class names to their actual classes
ARCHETYPE_CLASSES = {
  "browseruse-v1.0": BrowseruseV1,
}

if __name__ == "__main__":
  asyncio.run(run_agency(ARCHETYPE_CLASSES))
