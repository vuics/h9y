'''
FileManager

The file manager downloads file from urls every time it receives it in prompt method.
If the prompt contains only url, then the file manager would download the file
and store it in the memory together with other downloaded files.
If there is a message in prompt and not the url, then the chat would send all
the files in human message from the file manager memory and clear the memory.
So next time the user will send new downloaded files with the new message.
'''
import logging
import re
import os
import base64
# import json
from io import BytesIO
from urllib.parse import urlparse

from dotenv import load_dotenv
import httpx
import magic

from helpers import str_to_bool

logger = logging.getLogger("FileManager")

load_dotenv()

XMPP_SHARE_URL_PREFIX = os.getenv("XMPP_SHARE_URL_PREFIX", "https://selfdev-prosody.dev.local:5281/file_share/")
XMPP_SHARE_URL_REGEX = re.compile(f"^{re.escape(XMPP_SHARE_URL_PREFIX)}")
API_FILES_URL = os.getenv("API_FILES_URL", "https://selfdev-prosody.dev.local:5281/file_share/")

# FIXME: Set verify=True to check the certificates
SSL_VERIFY = str_to_bool(os.getenv("SSL_VERIFY", "true"))


class FileManager:
  '''
  Manages files downloaded from URLs in memory
  '''
  def __init__(self):
    self.file_urls = []

  def is_shared_file_url(self, prompt):
    try:
      if re.match(XMPP_SHARE_URL_REGEX, prompt):
        # logger.debug("Prompt is a file URL.")
        return True
      return False
    except Exception as e:
      logger.error(f"Error checking prompt {prompt} to match url pattern: {e}")

  def add_file_url(self, url):
    try:
      # logger.debug(f"Adding file url: {url}")
      self.file_urls.append(url)

      # NOTE: the agent should return empty string to be compatible with Map.
      #
      # Do not use this:
      #   return f"Files are attached from URLs: {json.dumps(self.file_urls)}"
      #
      return ""
    except Exception as e:
      logger.error(f"Error downloading file from {url}: {e}")

  def get_file_urls(self):
    return self.file_urls

  def fetch_bytes_from_url(self, url):
    try:
      logger.debug(f"Downloading file from {url}")

      # TODO: Develop support for TLS certifictes for verify=True
      logger.debug(f"SSL_VERIFY: {SSL_VERIFY}")
      url1 = url.replace(XMPP_SHARE_URL_PREFIX, API_FILES_URL)
      logger.debug(f'Replace url: {url} with url1: {url1}')
      response = httpx.get(url1, verify=SSL_VERIFY)
      # logger.debug(f"response: {response}")
      response.raise_for_status()
      file_bytes = response.content
      # logger.debug(f"file_bytes: {file_bytes}")
      return file_bytes
    except Exception as e:
      logger.error(f"Error downloading file from {url}: {e}")
      raise e

  def get_files_bytes(self):
    files_bytes = list(map(self.fetch_bytes_from_url, self.file_urls))
    # logger.debug(f"files_bytes: {files_bytes}")
    return files_bytes

  def get_files_iobytes(self):
    files_bytes = self.get_files_bytes()
    # logger.debug(f"files_bytes: {files_bytes}")
    files_iobytes = list(map(BytesIO, files_bytes))
    # logger.debug(f"files_iobytes: {files_iobytes}")
    return files_iobytes

  def get_filename_from_url(self, url):
    path = urlparse(url).path
    return os.path.basename(path)

  def get_type_from_iobytes(self, file_iobytes):
    try:
      if isinstance(file_iobytes, BytesIO):
        file_bytes = file_iobytes.getvalue()
      elif isinstance(file_iobytes, bytes):
        file_bytes = file_iobytes
      else:
        raise TypeError("Expected BytesIO or bytes")
      mime = magic.Magic(mime=True)
      mime_type = mime.from_buffer(file_bytes)
      type_part = mime_type.split("/")[0]
      return mime_type, type_part
    except Exception as e:
      logger.error(f"Error getting file type from iobytes: {e}")
      return None, None

  def get_file_info_from_bytes(self, file_bytes):
    try:
      mime = magic.Magic(mime=True)
      mime_type = mime.from_buffer(file_bytes)
      type_part = mime_type.split("/")[0]
      if type_part in ["image", "audio", "text"]:
        type = type_part
      else:
        type = "file"

      if type == "text":
        file_info = {
          "type": type,
          "mime_type": mime_type,
          "text": file_bytes.decode("utf-8"),
        }
      else:
        file_base64 = base64.b64encode(file_bytes).decode("utf-8")
        file_info = {
          "type": type,
          "source_type": "base64",
          "data": file_base64,
          "mime_type": mime_type,
        }
      return file_info
    except Exception as e:
      logger.error(f"Error getting file info from bytes: {e}")

  def get_files_info(self):
    try:
      files_bytes = self.get_files_bytes()
      # logger.debug(f"files_bytes: {files_bytes}")
      files_info = list(map(self.get_file_info_from_bytes, files_bytes))
      return files_info
    except Exception as e:
      logger.error(f"Error getting files info: {e}")

  def clear(self):
    self.file_urls = []
