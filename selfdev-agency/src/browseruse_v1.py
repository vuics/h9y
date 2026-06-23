'''
BrowseruseV1 Agent Archetype
'''
import os
import logging
import asyncio
import json
from dotenv import load_dotenv
from dataclasses import dataclass
from typing import TYPE_CHECKING, TypeVar, overload
from pydantic import BaseModel

from langchain_core.messages import (  # pyright: ignore
  AIMessage,
  HumanMessage,
  SystemMessage,
)
from langchain_core.messages import (  # pyright: ignore
  ToolCall as LangChainToolCall,
)
from langchain_core.messages.base import BaseMessage as LangChainBaseMessage  # pyright: ignore
from langchain_openai import ChatOpenAI
from browser_use import Agent, Browser
# from browser_use import ChatBrowserUse, ChatGoogle, ChatOpenAI, ChatAnthropic
from browser_use.llm.base import BaseChatModel
from browser_use.llm.exceptions import ModelProviderError
from browser_use.llm.views import ChatInvokeCompletion, ChatInvokeUsage
from browser_use.llm.messages import (
  AssistantMessage,
  BaseMessage,
  ContentPartImageParam,
  ContentPartRefusalParam,
  ContentPartTextParam,
  ToolCall,
  UserMessage,
  SystemMessage as BrowserUseSystemMessage,
)

from base_model import init_model, extract_total_tokens
from xmpp_agent import XmppAgent


logger = logging.getLogger("BrowseruseV1")

# Load environment variables
load_dotenv()


if TYPE_CHECKING:
  from langchain_core.language_models.chat_models import BaseChatModel as LangChainBaseChatModel  # type: ignore
  from langchain_core.messages import AIMessage as LangChainAIMessage  # type: ignore

T = TypeVar('T', bound=BaseModel)


class LangChainMessageSerializer:
  """Serializer for converting between browser-use message types and LangChain message types."""

  @staticmethod
  def _serialize_user_content(
    content: str | list[ContentPartTextParam | ContentPartImageParam],
  ) -> str | list[str | dict]:
    """Convert user message content for LangChain compatibility."""
    if isinstance(content, str):
      return content

    serialized_parts = []
    for part in content:
      if part.type == 'text':
        serialized_parts.append(
          {
            'type': 'text',
            'text': part.text,
          }
        )
      elif part.type == 'image_url':
        # LangChain format for images
        serialized_parts.append(
          {'type': 'image_url', 'image_url': {'url': part.image_url.url, 'detail': part.image_url.detail}}
        )

    return serialized_parts

  @staticmethod
  def _serialize_system_content(
    content: str | list[ContentPartTextParam],
  ) -> str:
    """Convert system message content to text string for LangChain compatibility."""
    if isinstance(content, str):
      return content

    text_parts = []
    for part in content:
      if part.type == 'text':
        text_parts.append(part.text)

    return '\n'.join(text_parts)

  @staticmethod
  def _serialize_assistant_content(
    content: str | list[ContentPartTextParam | ContentPartRefusalParam] | None,
  ) -> str:
    """Convert assistant message content to text string for LangChain compatibility."""
    if content is None:
      return ''
    if isinstance(content, str):
      return content

    text_parts = []
    for part in content:
      if part.type == 'text':
        text_parts.append(part.text)
      # elif part.type == 'refusal':
      #   # Include refusal content as text
      #   text_parts.append(f'[Refusal: {part.refusal}]')

    return '\n'.join(text_parts)

  @staticmethod
  def _serialize_tool_call(tool_call: ToolCall) -> LangChainToolCall:
    """Convert browser-use ToolCall to LangChain ToolCall."""
    # Parse the arguments string to a dict for LangChain
    try:
      args_dict = json.loads(tool_call.function.arguments)
    except json.JSONDecodeError:
      # If parsing fails, wrap in a dict
      args_dict = {'arguments': tool_call.function.arguments}

    return LangChainToolCall(
      name=tool_call.function.name,
      args=args_dict,
      id=tool_call.id,
    )

  # region - Serialize overloads
  @overload
  @staticmethod
  def serialize(message: UserMessage) -> HumanMessage: ...

  @overload
  @staticmethod
  def serialize(message: BrowserUseSystemMessage) -> SystemMessage: ...

  @overload
  @staticmethod
  def serialize(message: AssistantMessage) -> AIMessage: ...

  @staticmethod
  def serialize(message: BaseMessage) -> LangChainBaseMessage:
    """Serialize a browser-use message to a LangChain message."""

    if isinstance(message, UserMessage):
      content = LangChainMessageSerializer._serialize_user_content(message.content)
      return HumanMessage(content=content, name=message.name)

    elif isinstance(message, BrowserUseSystemMessage):
      content = LangChainMessageSerializer._serialize_system_content(message.content)
      return SystemMessage(content=content, name=message.name)

    elif isinstance(message, AssistantMessage):
      # Handle content
      content = LangChainMessageSerializer._serialize_assistant_content(message.content)

      # For simplicity, we'll ignore tool calls in LangChain integration
      # as requested by the user
      return AIMessage(
        content=content,
        name=message.name,
      )

    else:
      raise ValueError(f'Unknown message type: {type(message)}')

  @staticmethod
  def serialize_messages(messages: list[BaseMessage]) -> list[LangChainBaseMessage]:
    """Serialize a list of browser-use messages to LangChain messages."""
    return [LangChainMessageSerializer.serialize(m) for m in messages]


@dataclass
class ChatLangchain(BaseChatModel):
  """
  A wrapper around LangChain BaseChatModel that implements the browser-use BaseChatModel protocol.

  This class allows you to use any LangChain-compatible model with browser-use.
  """

  # The LangChain model to wrap
  chat: 'LangChainBaseChatModel'

  @property
  def model(self) -> str:
    return self.name

  @property
  def provider(self) -> str:
    """Return the provider name based on the LangChain model class."""
    model_class_name = self.chat.__class__.__name__.lower()
    if 'openai' in model_class_name:
      return 'openai'
    elif 'anthropic' in model_class_name or 'claude' in model_class_name:
      return 'anthropic'
    elif 'google' in model_class_name or 'gemini' in model_class_name:
      return 'google'
    elif 'groq' in model_class_name:
      return 'groq'
    elif 'ollama' in model_class_name:
      return 'ollama'
    elif 'deepseek' in model_class_name:
      return 'deepseek'
    else:
      return 'langchain'

  @property
  def name(self) -> str:
    """Return the model name."""
    # Try to get model name from the LangChain model using getattr to avoid type errors
    model_name = getattr(self.chat, 'model_name', None)
    if model_name:
      return str(model_name)

    model_attr = getattr(self.chat, 'model', None)
    if model_attr:
      return str(model_attr)

    return self.chat.__class__.__name__

  def _get_usage(self, response: 'LangChainAIMessage') -> ChatInvokeUsage | None:
    usage = response.usage_metadata
    if usage is None:
      return None

    prompt_tokens = usage['input_tokens'] or 0
    completion_tokens = usage['output_tokens'] or 0
    total_tokens = usage['total_tokens'] or 0

    input_token_details = usage.get('input_token_details', None)

    if input_token_details is not None:
      prompt_cached_tokens = input_token_details.get('cache_read', None)
      prompt_cache_creation_tokens = input_token_details.get('cache_creation', None)
    else:
      prompt_cached_tokens = None
      prompt_cache_creation_tokens = None

    return ChatInvokeUsage(
      prompt_tokens=prompt_tokens,
      prompt_cached_tokens=prompt_cached_tokens,
      prompt_cache_creation_tokens=prompt_cache_creation_tokens,
      prompt_image_tokens=None,
      completion_tokens=completion_tokens,
      total_tokens=total_tokens,
    )

  @overload
  async def ainvoke(self, messages: list[BaseMessage], output_format: None = None) -> ChatInvokeCompletion[str]: ...

  @overload
  async def ainvoke(self, messages: list[BaseMessage], output_format: type[T]) -> ChatInvokeCompletion[T]: ...

  async def ainvoke(
    self, messages: list[BaseMessage], output_format: type[T] | None = None
  ) -> ChatInvokeCompletion[T] | ChatInvokeCompletion[str]:
    """
    Invoke the LangChain model with the given messages.

    Args:
      messages: List of browser-use chat messages
      output_format: Optional Pydantic model class for structured output (not supported in basic LangChain integration)

    Returns:
      Either a string response or an instance of output_format
    """

    # Convert browser-use messages to LangChain messages
    langchain_messages = LangChainMessageSerializer.serialize_messages(messages)

    try:
      if output_format is None:
        # Return string response
        response = await self.chat.ainvoke(langchain_messages)  # type: ignore

        # Import at runtime for isinstance check
        from langchain_core.messages import AIMessage as LangChainAIMessage  # type: ignore

        if not isinstance(response, LangChainAIMessage):
          raise ModelProviderError(
            message=f'Response is not an AIMessage: {type(response)}',
            model=self.name,
          )

        # Extract content from LangChain response
        content = response.content if hasattr(response, 'content') else str(response)

        usage = self._get_usage(response)
        return ChatInvokeCompletion(
          completion=str(content),
          usage=usage,
        )

      else:
        # Use LangChain's structured output capability
        try:
          structured_chat = self.chat.with_structured_output(output_format)
          parsed_object = await structured_chat.ainvoke(langchain_messages)

          # For structured output, usage metadata is typically not available
          # in the parsed object since it's a Pydantic model, not an AIMessage
          usage = None

          # Type cast since LangChain's with_structured_output returns the correct type
          return ChatInvokeCompletion(
            completion=parsed_object,  # type: ignore
            usage=usage,
          )
        except AttributeError:
          # Fall back to manual parsing if with_structured_output is not available
          response = await self.chat.ainvoke(langchain_messages)  # type: ignore

          if not isinstance(response, 'LangChainAIMessage'):
            raise ModelProviderError(
              message=f'Response is not an AIMessage: {type(response)}',
              model=self.name,
            )

          content = response.content if hasattr(response, 'content') else str(response)

          try:
            if isinstance(content, str):
              import json

              parsed_data = json.loads(content)
              if isinstance(parsed_data, dict):
                parsed_object = output_format(**parsed_data)
              else:
                raise ValueError('Parsed JSON is not a dictionary')
            else:
              raise ValueError('Content is not a string and structured output not supported')
          except Exception as e:
            raise ModelProviderError(
              message=f'Failed to parse response as {output_format.__name__}: {e}',
              model=self.name,
            ) from e

          usage = self._get_usage(response)
          return ChatInvokeCompletion(
            completion=parsed_object,
            usage=usage,
          )

    except Exception as e:
      # Convert any LangChain errors to browser-use ModelProviderError
      raise ModelProviderError(
        message=f'LangChain model error: {str(e)}',
        model=self.name,
      ) from e


class BrowseruseV1(XmppAgent):
  '''
  BrowseruseV1 provides agent that uses browser with LLM chat
  '''
  def __init__(self, *args, **kwargs):
    super().__init__(*args, **kwargs)

  async def start(self):
    await super().start()
    try:
      # logger.debug(f"self.config.options: {self.config.options}")
      # logger.debug(f"self.config.options.chat: {self.config.options.chat}")
      self.model = init_model(
        model_provider=self.config.options.browseruse.model.provider,
        model_name=self.config.options.browseruse.model.name,
        api_key=self.config.options.browseruse.model.apiKey or None,
      )
      logger.debug(f"Model initialized: {self.model}")
      await self.slog('debug', 'Agent started')

    except Exception as e:
      await self.slog('error', f"Error initializing model: {e}")
      logger.error(f"Error initializing model: {e}")

  async def chat(self, *, prompt, reply_func=None):
    try:
      logger.debug(f"Received prompt: {prompt}")

      self.browser = Browser(
        headless=True,  # Show browser window
        window_size={'width': 1000, 'height': 700},  # Set window size
      )
      # llm = ChatGoogle(model="gemini-flash-latest")
      # langchain_model = ChatOpenAI(
      #   # model='gpt-4.1-mini',
      #   # model='gpt-4o-mini',
      #   # model='gpt-5-nano',
      #   model='gpt-5',
      #   temperature=0.1,
      #   api_key=os.environ["OPENAI_API_KEY_123"],
      # )
      self.llm = ChatLangchain(chat=self.model)
      agent = Agent(
        task=prompt,
        browser=self.browser,
        llm=self.llm
      )
      history = await agent.run()
      logger.debug(f"History: {history.history}")

      final_step = history.history[-1]
      if final_step.result and len(final_step.result) > 0:
        final_result = final_step.result[0].extracted_content
      else:
        final_result = None
      logger.debug(f"Browser-Use> Final Result: {final_result}")

      # return json.dumps(history.history)
      return final_result

    except Exception as e:
      await self.slog('error', f"Chat error: {e}")
      logger.error(f"Chat error: {e}")
      return f"Error: {str(e)}"
