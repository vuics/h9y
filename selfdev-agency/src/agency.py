#!/usr/bin/env python

import asyncio

from agency_core import run_agency

# Import agent classes
from chat_v1 import ChatV1
from rag_v1 import RagV1
from stt_v1 import SttV1
from tts_v1 import TtsV1
from imagegen_v1 import ImagegenV1
from code_v1 import CodeV1
from quantum_v1 import QuantumV1
from storage_v1 import StorageV1
from command_v1 import CommandV1
from langflow_v1 import LangflowV1
from nodered_v1 import NoderedV1
from n8n_v1 import N8nV1
from notebook_v1 import NotebookV1
from avatar_v1 import AvatarV1
# from browseruse_v1 import BrowseruseV1

# Map of agent class names to their actual classes
ARCHETYPE_CLASSES = {
  "chat-v1.0": ChatV1,
  "rag-v1.0": RagV1,
  "stt-v1.0": SttV1,
  "tts-v1.0": TtsV1,
  "imagegen-v1.0": ImagegenV1,
  "code-v1.0": CodeV1,
  "quantum-v1.0": QuantumV1,
  "storage-v1.0": StorageV1,
  "command-v1.0": CommandV1,
  "langflow-v1.0": LangflowV1,
  "nodered-v1.0": NoderedV1,
  "n8n-v1.0": N8nV1,
  "notebook-v1.0": NotebookV1,
  "avatar-v1.0": AvatarV1,
  # "browseruse-v1.0": BrowseruseV1,
}

if __name__ == "__main__":
  asyncio.run(run_agency(ARCHETYPE_CLASSES))
