'''
ImagegenV1 Agent Archetype
'''
import logging

from openai import OpenAI

from xmpp_agent import XmppAgent

logger = logging.getLogger("ImagegenV1")


class ImagegenV1(XmppAgent):
  '''
  ImagegenV1 provides image generation
  '''
  def __init__(self, *args, **kwargs):
    super().__init__(*args, **kwargs)

  async def start(self):
    await super().start()
    try:
      if self.config.options.imagegen.model.provider == 'openai':
        self.client = OpenAI(
          api_key=self.config.options.imagegen.model.apiKey or None,
        )
      else:
        await self.slog('error', f"Unknown model provider: {self.config.options.imagegen.model.provider}")
        raise Exception(f"Unknown model provider: {self.config.options.imagegen.model.provider}")

      logger.debug(f"Client initialized: {self.client}")
      await self.slog('debug', 'Agent started')

    except Exception as e:
      logger.error(f"Error initializing model: {e}")
      await self.slog('error', f"Error initializing model: {e}")

  async def chat(self, *, prompt, reply_func=None):
    try:
      logger.debug(f"Received prompt: {prompt}")

      if not self.client:
        await self.slog('error', "Client was not initialized")
        raise Exception("Client was not initialized")

      if self.config.options.imagegen.model.provider == 'openai':
        params = {
          "prompt": prompt,
          "model": self.config.options.imagegen.model.name,
          "size": self.config.options.imagegen.size,
          "n": self.config.options.imagegen.n,
          "user": f"user_{self.config.userId}",
          "response_format": "b64_json",
        }
        if self.config.options.imagegen.model.name == "dall-e-3":
          params["quality"] = self.config.options.imagegen.quality
          params["style"] = self.config.options.imagegen.style

        img = self.client.images.generate(**params)
        # logger.debug(f"img: {img}")

        content = ''
        for index, data_item in enumerate(img.data):
          image_base64 = data_item.b64_json
          # logger.debug(f"image_base64: {image_base64}")
          get_url = await self.upload_file(
            file_base64=image_base64,
            filename=f'image_{index}.png',
            content_type='image/png',
          )
          logger.info(f"get_url: {get_url}")
          if reply_func:
            reply_func(get_url)
          content += f'![Generated Image]({get_url})'
        return content

      else:
        await self.slog('error', f"Unknown model provider: {self.config.options.imagegen.model.provider}")
        raise Exception(f"Unknown model provider: {self.config.options.imagegen.model.provider}")

    except Exception as e:
      logger.error(f"Imagegen error: {e}")
      await self.slog('error', f"Imagegen error: {e}")
      return f"Error: {str(e)}"
