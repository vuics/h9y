#!/usr/bin/env python

import asyncio

from agency_core import run_agency

# Import agent classes
from imagegen_v1 import ImagegenV1
from storage_v1 import StorageV1
from command_v1 import CommandV1

# Map of agent class names to their actual classes
ARCHETYPE_CLASSES = {
  "imagegen-v1.0": ImagegenV1,
  "storage-v1.0": StorageV1,
  "command-v1.0": CommandV1,
}

if __name__ == "__main__":
  asyncio.run(run_agency(ARCHETYPE_CLASSES))
