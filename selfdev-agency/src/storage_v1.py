'''
StorageV1 Agent Archetype
'''
import os
import logging
import re
import io
from urllib.parse import urlparse
from datetime import datetime

from dotenv import load_dotenv
from pymongo import AsyncMongoClient
from bson import ObjectId

from xmpp_agent import XmppAgent
from file_manager import FileManager

logger = logging.getLogger("StorageV1")

# Load environment variables
load_dotenv()

# MongoDB connection settings
DB_URL = os.getenv("DB_URL", "mongodb://mongo.dev.local:27017/selfdev")


class StorageV1(XmppAgent):
  '''
  StorageV1 provides storage with a database
  '''
  def __init__(self, *args, **kwargs):
    super().__init__(*args, **kwargs)
    self.file_manager = FileManager()

  async def start(self):
    await super().start()
    try:
      # logger.debug(f'self.config: {self.config}')
      self.storage = self.config.options.storage
      # logger.debug(f'self.storage: {self.storage}')

      self.regex_list = re.compile(self.storage.commands.get("list", '^//LIST$'))
      self.regex_get = re.compile(self.storage.commands.get("get", '^//GET\\s+(?P<key>\\S+)(?:\\s+(?P<default>.+))?$'))
      self.regex_set = re.compile(self.storage.commands.get("set", '^//SET\\s+(?P<key>\\S+)\\s+(?P<value>.+)$'))
      self.regex_append = re.compile(self.storage.commands.get("append", '^//APPEND\\s+(?P<key>\\S+)\\s+(?P<value>.+)$'))
      self.regex_delete = re.compile(self.storage.commands.get("delete", '^//DELETE\\s+(?P<key>\\S+)$'))
      self.regex_load = re.compile(self.storage.commands.get("load", '^//LOAD\\s+(?P<key>\\S+)$'))
      self.regex_save = re.compile(self.storage.commands.get("save", '^//SAVE\\s+(?P<key>\\S+)(?:\\s+(?P<filename>\\S+))?(?:\\s+(?P<default>.*))?$'))

      # logger.debug(f'regex_list: {self.regex_list}')
      # logger.debug(f'regex_get: {self.regex_get}')
      # logger.debug(f'regex_set: {self.regex_set}')
      # logger.debug(f'regex_append: {self.regex_append}')
      # logger.debug(f'regex_delete: {self.regex_delete}')
      # logger.debug(f'regex_load: {self.regex_load}')
      # logger.debug(f'regex_save: {self.regex_save}')

      if self.storage.driver == "mongodb":
        self.client = AsyncMongoClient(DB_URL)
        # self.client = await AsyncMongoClient(DB_URL).aconnect()
        parsed_db_url = urlparse(DB_URL)
        database_name = parsed_db_url.path.lstrip('/')
        logger.info(f"database_name: {database_name}")
        self.db = self.client[database_name]
        self.storages = self.db["storages"]
      else:
        raise Exception('Unknown storage driver')
        await self.slog('error', 'Unknown storage driver')

      logger.debug(f"self.client: {self.client}")
      await self.slog('debug', 'Agent started')

    except Exception as e:
      logger.error(f"Error initializing: {e}")
      await self.slog('error', f"Error initializing: {e}")

  async def chat(self, *, prompt, reply_func=None):
    try:
      logger.debug(f"prompt: {prompt}")
      # logger.debug(f'self.config.options: {self.config.options}')
      content = ''

      if self.file_manager.is_shared_file_url(prompt):
        return self.file_manager.add_file_url(prompt)

      if re.match(self.regex_list, prompt):
        logger.debug("LIST command")
        cursor = self.storages.find({
          "userId": ObjectId(self.config.userId),
          "namespace": self.storage.namespace,
        })
        items = await cursor.to_list(length=None)
        keys = [item["key"] for item in items]
        if self.storage.verbose == 2:
          content = "Keys: " + ", ".join(keys) if keys else "No keys found."
        elif self.storage.verbose == 1:
          content = "\n".join(keys) if keys else "NOT_FOUND"
        else:
          content = "\n".join(keys) if keys else " "

      elif match := re.match(self.regex_get, prompt):
        key = match.group("key")
        default = match.groupdict().get("default")
        logger.debug(f"GET command with key: {key}, default: {default}")
        doc = await self.storages.find_one({
          "userId": ObjectId(self.config.userId),
          "namespace": self.storage.namespace,
          "key": key,
        })
        if doc:
          content = doc["value"]
        elif default is not None:
          content = default
        else:
          if self.storage.verbose == 2:
            content = f"No entry found for key '{key}'."
          elif self.storage.verbose == 1:
            content = "NOT_FOUND"
          else:
            content = " "

      elif match := re.match(self.regex_set, prompt):
        key = match.group("key")
        value = match.group("value")
        logger.debug(f"SET command with key: {key}, value: {value}")
        now = datetime.utcnow()
        await self.storages.update_one({
          "userId": ObjectId(self.config.userId),
          "namespace": self.storage.namespace,
          "key": key,
        }, {
          "$set": {
            "value": value,
            "updatedAt": now,          # update every time
          },
          "$setOnInsert": {
            "createdAt": now           # only set on insert
          }
        }, upsert=True)
        if self.storage.verbose == 2:
          content = f"Set key '{key}' to value '{value}'."
        elif self.storage.verbose == 1:
          content = value
        else:
          content = " "

      elif match := re.match(self.regex_append, prompt):
        key = match.group("key")
        value = match.group("value")
        logger.debug(f"APPEND command with key: {key}, value: {value}")
        now = datetime.utcnow()

        # Try to find existing document
        doc = await self.storages.find_one({
          "userId": ObjectId(self.config.userId),
          "namespace": self.storage.namespace,
          "key": key,
        })

        if doc:
          new_value = str(doc.get("value", "")) + str(value)
          result = await self.storages.update_one(
            {
              "userId": ObjectId(self.config.userId),
              "namespace": self.storage.namespace,
              "key": key,
            },
            {
              "$set": {
                "value": new_value,
                "updatedAt": now
              }
            }
          )
        else:
          # If key does not exist, create it
          new_value = value
          await self.storages.update_one(
            {
              "userId": ObjectId(self.config.userId),
              "namespace": self.storage.namespace,
              "key": key,
            },
            {
              "$set": {
                "value": new_value,
                "updatedAt": now
              },
              "$setOnInsert": {
                "createdAt": now
              }
            },
            upsert=True
          )

        if self.storage.verbose == 2:
          content = f"Appended value to key '{key}'. New value: '{new_value}'."
        elif self.storage.verbose == 1:
          content = new_value
        else:
          content = " "

      elif match := re.match(self.regex_delete, prompt):
        key = match.group("key")
        logger.debug(f"DELETE command with key: {key}")
        result = await self.storages.delete_one({
          "userId": ObjectId(self.config.userId),
          "namespace": self.storage.namespace,
          "key": key,
        })
        if result.deleted_count > 0:
          if self.storage.verbose == 2:
            content = f"Deleted key '{key}'."
          elif self.storage.verbose == 1:
            content = "OK"
          else:
            content = " "
        else:
          if self.storage.verbose == 2:
            content = f"No entry found for key '{key}'."
          elif self.storage.verbose == 1:
            content = "NOT_FOUND"
          else:
            content = " "

      elif match := re.match(self.regex_load, prompt):
        key = match.group("key")
        logger.debug(f"LOAD command with key: {key}, reading files...")

        value = ''
        file_urls = self.file_manager.get_file_urls()
        logger.debug(f"file_urls: {file_urls}")
        files_iobytes = self.file_manager.get_files_iobytes()
        # logger.debug(f"files_iobytes: {files_iobytes}")

        for file_iobytes, url in zip(files_iobytes, file_urls):
          logger.debug(f"file_iobytes: {file_iobytes}")
          logger.debug(f"url: {url}")
          filename = self.file_manager.get_filename_from_url(url)
          logger.debug(f"filename: {filename}")
          file_iobytes.name = filename
          file_iobytes.seek(0)
          value += file_iobytes.read().decode('utf-8')

        logger.debug(f"LOAD command with key: {key}, value: {value}")
        now = datetime.utcnow()
        await self.storages.update_one({
          "userId": ObjectId(self.config.userId),
          "namespace": self.storage.namespace,
          "key": key,
        }, {
          "$set": {
            "value": value,
            "updatedAt": now,          # update every time
          },
          "$setOnInsert": {
            "createdAt": now           # only set on insert
          }
        }, upsert=True)
        if self.storage.verbose == 2:
          content = f"Loaded key '{key}'"  # " to value '{value}'."
        elif self.storage.verbose == 1:
          content = "OK"
        else:
          content = " "

      elif match := re.match(self.regex_save, prompt):
        key = match.group("key")
        filename = match.groupdict().get("filename")
        # logger.debug(f"filename: {filename}")
        if not filename:
          filename = f"{key}.txt"
        default = match.groupdict().get("default")
        logger.debug(f"SAVE command with key: {key}, filename: {filename}, default: {default}")
        doc = await self.storages.find_one({
          "userId": ObjectId(self.config.userId),
          "namespace": self.storage.namespace,
          "key": key,
        })
        if doc:
          file_bytes = doc["value"].encode('utf-8')
        elif default is not None:
          file_bytes = default.encode('utf-8')

        if file_bytes:
          get_url = await self.upload_file(
            file_bytes=file_bytes,
            filename=filename,
            content_type='text/plain; charset=utf-8',
          )
          logger.info(f"get_url: {get_url}")
          if reply_func:
            reply_func(get_url)

        if doc:
          content = f"Saved value to {get_url}"
        elif default is not None:
          content = f"Saved default value to {get_url}"
        else:
          if self.storage.verbose == 2:
            content = f"No entry found for key '{key}'."
          elif self.storage.verbose == 1:
            content = "NOT_FOUND"
          else:
            content = " "

      else:
        logger.warning("No valid command match")
        if self.storage.verbose == 2:
          content = 'Command not found'
        elif self.storage.verbose == 1:
          content = "UNKNOWN_COMMAND"
        else:
          content = " "

      self.file_manager.clear()

      return content
    except Exception as e:
      logger.error(f"Storage error: {e}")
      return f'Error: {str(e)}'

  async def stop(self):
    """
    Release resources
    """
    try:
      await super().stop()
      logger.debug("Disconnecting from MongoDB...")
      await self.client.close()
      logger.info("Disconnected from MongoDB")
      await self.slog('debug', "Disconnected from MongoDB")
    except Exception as e:
      logger.error(f"Disconnect error: {e}")
      await self.slog('debug', f"Disconnect error: {e}")
