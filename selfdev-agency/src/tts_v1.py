'''
TtsV1 Agent Archetype
'''
import os
import logging

from dotenv import load_dotenv
from openai import OpenAI

from xmpp_agent import XmppAgent

logger = logging.getLogger("TtsV1")

load_dotenv()

SPEACHES_BASE_URL = os.getenv("SPEACHES_BASE_URL", "http://localhost:8000/v1")


class TtsV1(XmppAgent):
  '''
  TtsV1 provides speech synthesis from text to audio
  '''
  def __init__(self, *args, **kwargs):
    super().__init__(*args, **kwargs)
    # self.file_manager = FileManager()

  async def start(self):
    await super().start()
    try:
      # logger.debug(f"self.config.options.tts: {self.config.options.tts}")
      # logger.debug(f"self.config.options.tts.model: {self.config.options.tts.model}")
      if self.config.options.tts.model.provider == 'openai':
        self.client = OpenAI(
          api_key=self.config.options.tts.model.apiKey or None,
        )
      elif self.config.options.tts.model.provider == 'speaches':
        self.client = OpenAI(
          api_key="any-value-is-ok",
          base_url=SPEACHES_BASE_URL,
        )
      else:
        await self.slog('error', "Unknown model provider")
        raise Exception(f"Unknown model provider: {self.config.options.tts.model.provider}")

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

      if self.config.options.tts.model.provider in ['openai', 'speaches']:
        result = self.client.audio.speech.create(
          model=self.config.options.tts.model.name,
          voice=self.config.options.tts.model.voice,
          input=prompt,
          response_format=self.config.options.tts.format,
          speed=self.config.options.tts.speed,
        )
        # logger.debug(f"openai result: {result}")
        file_bytes = result.content
        filename = f"speech.{self.config.options.tts.format}"
        content_type = self.get_content_type(self.config.options.tts.format)
      else:
        await self.slog('error', "Unknown model provider")
        raise Exception(f"Unknown model provider: {self.config.options.tts.model.provider}")

      get_url = await self.upload_file(
        file_bytes=file_bytes,
        filename=filename,
        content_type=content_type,
      )
      logger.info(f"get_url: {get_url}")

      if reply_func:
        reply_func(get_url)

      content = f'<audio controls><source src="{get_url}" type="{content_type}" />Your browser does not support the audio element.</audio>'
      logger.debug(f"content: {content}")

      return content
    except Exception as e:
      logger.error(f"Tts error: {e}")
      return f"Error: {str(e)}"

  def get_content_type(self, format):
    format_to_content_type = {
      'mp3': 'audio/mpeg',
      'flac': 'audio/flac',
      'wav': 'audio/wav',
      'pcm': 'audio/L16'  # PCM audio, 16-bit linear, might vary by context
    }
    return format_to_content_type.get(format.lower(), 'application/octet-stream')  # Fallback for unknown types
