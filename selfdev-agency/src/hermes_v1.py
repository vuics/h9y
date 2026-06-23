'''
HermesV1 Agent Archetype
'''
import os
import logging
import asyncio

from dotenv import load_dotenv
from run_agent import AIAgent

from xmpp_agent import XmppAgent

logger = logging.getLogger("HermesV1")

# Load environment variables
load_dotenv()


class HermesV1(XmppAgent):
  '''
  HermesV1 provides chats with Hermes-Agent
  '''
  def __init__(self, *args, **kwargs):
    super().__init__(*args, **kwargs)
    self.agent = None
    self.provider = None
    self.model = None
    self.api_key = None
    self.base_url = None

  async def start(self):
    await super().start()
    try:

      self.provider = self.config.options.hermes.model.provider
      self.model = self.config.options.hermes.model.name
      self.api_key = self.config.options.hermes.model.apiKey or None
      logger.debug(f"provider: {self.provider}")
      logger.debug(f"model: {self.model}")
      # logger.debug(f"api_key: {self.api_key}")

      if self.provider == "ollama" or self.provider == "custom":
        self.base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        self.base_url += '/v1'
        logger.debug(f"base_url: {self.base_url}")

      self.agent = AIAgent(
        # base_url=self.base_url,
        # api_key="ollama",
        # api_mode="chat_completions",
        # provider="ollama-launch",
        # # provider="ollama",
        # model="gemma4",

        # base_url="http://ollama:11436/v1",
        # api_key="none",
        # # api_mode="chat_completions",
        # provider="custom",
        # # model="gemma4",
        # # model="qwen3.5:0.8b",

        provider=self.provider,
        model=self.model,
        api_key=self.api_key,
        base_url=self.base_url,

        quiet_mode=True,
      )
      logger.debug(f"Hermes AIAgent initialized: {self.agent}")
      await self.slog('debug', 'AIAgent initialized')

      await self.slog('debug', 'Agent started')
    except Exception as e:
      logger.error(f"Error initializing model: {e}")
      await self.slog('error', f'Error initializing model: {e}')

  async def stop(self):
    """
    Release resources
    """
    try:
      await super().stop()
      logger.debug("Stopping Hermes-agent...")
    except Exception as e:
      logger.error(f"Stop error: {e}")
      await self.slog('debug', f"Stop error: {e}")

  async def chat(self, *, prompt, reply_func=None):
    try:
      logger.debug(f"Received prompt: {prompt}")

      # logger.debug(f"provider: {self.provider}")
      # logger.debug(f"model: {self.model}")
      # logger.debug(f"api_key: {self.api_key}")
      # logger.debug(f"base_url: {self.base_url}")

      # response = self.agent.chat(prompt)

      # Offload the blocking synchronous call to a background thread
      response = await asyncio.to_thread(self.agent.chat, prompt)

      logger.debug(f"Agent responded: {response}")
      return response

    except Exception as e:
      logger.error(f"Hermes error: {e}")
      await self.slog('error', f'Hermes error: {e}')
      return f"Error: {str(e)}"
