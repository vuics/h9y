'''
N8nV1 Agent Archetype
'''
import os
import logging
import json
import copy

import httpx

from dotenv import load_dotenv

from xmpp_agent import XmppAgent
from helpers import extract_and_parse_json

logger = logging.getLogger("N8nV1")

load_dotenv()

# N8N_URL = os.getenv("N8N_URL", "http://localhost:5678")


class N8nV1(XmppAgent):
  '''
  N8nV1 provides execution of Langflow workflows
  '''
  async def start(self):
    await super().start()
    await self.slog('debug', 'Agent started')

  async def chat(self, *, prompt, reply_func=None):
    try:
      logger.debug(f"prompt: {prompt}")
      logger.debug(f'self.config.options: {self.config.options}')

      n8n = self.config.options.n8n
      # url = f"{N8N_URL}{n8n.route}"
      url = n8n.url
      logger.debug(f"url: {url}")
      headers = {
        "Content-Type": "application/json"
      }

      payload = {}
      if hasattr(n8n, 'payload'):
        payload = copy.deepcopy(n8n.payload)
      if hasattr(n8n, 'parseJson') and n8n.parseJson:
        try:
          parsed_json = extract_and_parse_json(prompt)
          logger.debug(f'parsed_json: {parsed_json}')
          payload.update(parsed_json)
        except Exception:
          pass
      if hasattr(n8n, 'promptKey'):
        payload[n8n.promptKey] = prompt
      logger.debug(f"payload: {payload}")

      async with httpx.AsyncClient() as client:
        allowed_methods = {"get", "post", "put", "patch", "delete"}
        method_lower = n8n.method.lower()
        if method_lower not in allowed_methods:
          raise ValueError(f"Unsupported method: {n8n.method}")

        client_method_func = getattr(client, n8n.method.lower())
        response = await client_method_func(url, json=payload, headers=headers)
        response.raise_for_status()  # Raise exception for bad status codes

      logger.debug(f"response.text: {response.text}")
      # return self.extract_response(response.text)
      return response.text

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
