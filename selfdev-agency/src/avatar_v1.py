'''
AvatarV1 Agent Archetype
'''
import os
import logging

from dotenv import load_dotenv
from openai import OpenAI
import httpx
from io import BytesIO

from xmpp_agent import XmppAgent
from file_manager import FileManager

logger = logging.getLogger("AvatarV1")

load_dotenv()

AVATAR_URL = os.getenv("AVATAR_URL", "http://localhost:8533")
AVATAR_TIMEOUT = int(os.getenv("AVATAR_TIMEOUT", "86400"))  # default to 86400 seconds (24 hours)


class AvatarV1(XmppAgent):
  '''
  AvatarV1 provides speech recogniton to text
  '''
  def __init__(self, *args, **kwargs):
    super().__init__(*args, **kwargs)
    self.file_manager = FileManager()

  async def start(self):
    await super().start()
    try:
      # logger.debug(f"self.config.options.avatar: {self.config.options.avatar}")
      # logger.debug(f"self.config.options.avatar.model: {self.config.options.avatar.model}")
      if self.config.options.avatar.model.provider == 'sadtalker':
        pass
      else:
        await self.slog('error', f"Unknown model provider: {self.config.options.avatar.model.provider}")
        raise Exception(f"Unknown model provider: {self.config.options.avatar.model.provider}")

      await self.slog('debug', 'Agent started')

    except Exception as e:
      await self.slog('error', f"Error initializing model: {e}")
      logger.error(f"Error initializing model: {e}")

  async def chat(self, *, prompt, reply_func=None):
    try:
      logger.debug(f"Received prompt: {prompt}")

      if self.file_manager.is_shared_file_url(prompt):
        return self.file_manager.add_file_url(prompt)

      logger.debug(f'prompt for processing: {prompt}')

      files = {
        'image': None,
        'audio': None,
      }
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
        mime_type, type_part = self.file_manager.get_type_from_iobytes(file_iobytes)
        print(f"MIME: {mime_type}, Type: {type_part}")
        if type_part == "image" and (not files['image']):
          files['image'] = (filename, file_iobytes, mime_type)
        if type_part == "audio" and (not files['audio']):
          files['audio'] = (filename, file_iobytes, mime_type)
        if type_part == "video" and (not files['audio']):
          files['audio'] = (filename, file_iobytes, mime_type)

      if (not files['image']) and (not files['audio']):
        raise Exception("Image and audio are missing.")
      if not files['image']:
        raise Exception("Image is missing.")
      if not files['audio']:
        raise Exception("Audio is missing.")

      logger.debug(f'files: {files}')

      content = ''

      if self.config.options.avatar.model.provider == 'sadtalker':

        # logger.debug(f"avatar result: {result}")
        timeout = httpx.Timeout(
          connect=60.0,  # allow up to 60s to establish connection
          read=AVATAR_TIMEOUT,  # wait up to 24h for a response (idle timeout)
          write=300.0,   # allow up to 5min to upload files
          pool=300.0     # connection pool timeout
        )
        async with httpx.AsyncClient(timeout=timeout) as client:
          logger.debug(f'Sending files to {AVATAR_URL}/process')
          result = await client.post(f"{AVATAR_URL}/process", files=files)
          logger.debug(f"Process result: {result}")
          result.raise_for_status()

          # Extract Content-Disposition header for filename
          content_disposition = result.headers.get("content-disposition", "")
          filename = "output_video.mp4"  # default fallback
          if "filename=" in content_disposition:
            filename = content_disposition.split("filename=")[-1].strip().strip('"')
          # Extract Content-Type header
          content_type = result.headers.get("content-type", "application/octet-stream")

          # Upload file
          get_url = await self.upload_file(
            file_bytes=result.content,
            filename=filename,
            content_type=content_type,
          )
          logger.info(f"get_url: {get_url}")

          if reply_func:
            reply_func(get_url)

          content = f'<video width="640" height="360" controls><source src="{get_url}" type="{content_type}" />Your browser does not support the video tag.</video>'
          logger.debug(f"content: {content}")

      else:
        await self.slog('error', f"Unknown model provider: {self.config.options.avatar.model.provider}")
        raise Exception(f"Unknown model provider: {self.config.options.avatar.model.provider}")

      self.file_manager.clear()
      # logger.debug(f"return content: {content}")
      return content
    except Exception as e:
      self.file_manager.clear()
      logger.error(f"Avatar error: {e}")
      await self.slog('error', f"Avatar error: {e}")
      return f"Error: {str(e)}"
