'''
SttV1 Agent Archetype
'''
import os
import logging

from dotenv import load_dotenv
from openai import OpenAI
import httpx

from xmpp_agent import XmppAgent
from file_manager import FileManager

logger = logging.getLogger("SttV1")

load_dotenv()

SPEACHES_BASE_URL = os.getenv("SPEACHES_BASE_URL", "http://localhost:8000/v1")


class SttV1(XmppAgent):
  '''
  SttV1 provides speech recogniton to text
  '''
  def __init__(self, *args, **kwargs):
    super().__init__(*args, **kwargs)
    self.file_manager = FileManager()

  async def start(self):
    await super().start()
    try:
      # logger.debug(f"self.config.options.stt: {self.config.options.stt}")
      # logger.debug(f"self.config.options.stt.model: {self.config.options.stt.model}")
      if self.config.options.stt.model.provider == 'openai':
        self.client = OpenAI(
          api_key=self.config.options.stt.model.apiKey or None,
        )
      elif self.config.options.stt.model.provider == 'speaches':
        self.client = OpenAI(
          api_key="any-value-is-ok",
          base_url=SPEACHES_BASE_URL,
        )
      else:
        raise Exception(f"Unknown model provider: {self.config.options.stt.model.provider}")

      logger.debug(f"Client initialized: {self.client}")
      await self.slog('debug', 'Agent started')

    except Exception as e:
      logger.error(f"Error initializing client: {e}")
      await self.slog('error', f"Error initializing client: {e}")

  async def chat(self, *, prompt, reply_func=None):
    try:
      logger.debug(f"Received prompt: {prompt}")

      if not self.client:
        await self.slog('error', "Client was not initialized")
        raise Exception("Client was not initialized")

      if self.file_manager.is_shared_file_url(prompt):
        return self.file_manager.add_file_url(prompt)

      content = ''

      file_urls = self.file_manager.get_file_urls()
      logger.debug(f"file_urls: {file_urls}")
      files_iobytes = self.file_manager.get_files_iobytes()
      # logger.debug(f"files_iobytes: {files_iobytes}")
      for file_iobytes, url in zip(files_iobytes, file_urls):
        # logger.debug(f"file_iobytes: {file_iobytes}")
        logger.debug(f"url: {url}")
        filename = self.file_manager.get_filename_from_url(url)
        logger.debug(f"filename: {filename}")
        file_iobytes.name = filename
        file_iobytes.seek(0)

        if self.config.options.stt.model.provider in ['openai', 'speaches']:
          result = self.client.audio.transcriptions.create(
            model=self.config.options.stt.model.name,
            file=file_iobytes,
            language=self.config.options.stt.language,
          )
          logger.debug(f"openai result: {result}")
          content += result.text
        else:
          await self.slog('error', "Unknown model provider")
          raise Exception(f"Unknown model provider: {self.config.options.stt.model.provider}")

      self.file_manager.clear()
      return content
    except Exception as e:
      logger.error(f"Stt error: {e}")
      await self.slog('error', f"Stt error: {e}")
      return f"Error: {str(e)}"
