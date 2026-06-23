'''
LangflowV1 Agent Archetype
'''
import os
import logging
import json

import httpx

from dotenv import load_dotenv

from xmpp_agent import XmppAgent

logger = logging.getLogger("LangflowV1")

load_dotenv()

LANGFLOW_URL = os.getenv("LANGFLOW_URL", "http://localhost:7860")


class LangflowV1(XmppAgent):
  '''
  LangflowV1 provides execution of Langflow workflows
  '''
  async def start(self):
    await super().start()
    await self.slog('debug', 'Agent started')

  async def chat(self, *, prompt, reply_func=None):
    try:
      logger.debug(f"prompt: {prompt}")
      logger.debug(f'self.config.options: {self.config.options}')
      url = f"{LANGFLOW_URL}/api/v1/run/{self.config.options.langflow.flowId}?stream=false"
      logger.debug(f"url: {url}")
      payload = {
        "input_value": prompt,
        "output_type": "chat",
        "input_type": "chat",
        "session_id": self.config.options.langflow.sessionId,
      }
      headers = {
        "Content-Type": "application/json"
      }
      async with httpx.AsyncClient() as client:
        response = await client.post(url, json=payload, headers=headers)
        response.raise_for_status()  # Raise exception for bad status codes
      logger.debug(f"response.text: {response.text}")
      return await self.extract_langflow_message(response.text)

    except httpx.RequestError as e:
      await self.slog('error', f"Error making API request: {e}")
      logger.error(f"Error making API request: {e}")
      return f'Error making API request: {str(e)}'

    except httpx.HTTPStatusError as e:
      await self.slog('error', f"HTTP error response: {e.response.status_code} - {e.response.text}")
      logger.error(f"HTTP error response: {e.response.status_code} - {e.response.text}")
      return f'HTTP error response: {e.response.status_code} - {e.response.text}'

    except ValueError as e:
      await self.slog('error', f"Error parsing response: {e}")
      logger.error(f"Error parsing response: {e}")
      return f'Error parsing response: {str(e)}'

    except Exception as e:
      await self.slog('error', f"Chat error: {e}")
      logger.error(f"Chat error: {e}")
      return f'Error: {str(e)}'

  async def extract_langflow_message(self, response_text: str) -> str:
    try:
      response = json.loads(response_text)
      return response["outputs"][0]["outputs"][0]["results"]["message"]["data"]["text"]
    except (KeyError, IndexError, TypeError, json.JSONDecodeError) as e:
      await self.slog('error', f"Error extracting message: {str(e)}")
      return f"Error extracting message: {str(e)}"
