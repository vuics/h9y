#!/usr/bin/env python

import asyncio

from agency_core import run_agency

# Import agent classes
from computeruse_v1 import ComputeruseV1

# Map of agent class names to their actual classes
ARCHETYPE_CLASSES = {
  "computeruse-v1.0": ComputeruseV1,
}

if __name__ == "__main__":
  asyncio.run(run_agency(ARCHETYPE_CLASSES))
