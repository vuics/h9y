import os
import logging
import re
import asyncio

from dotenv import load_dotenv
from jupyter_client import KernelManager

from xmpp_agent import XmppAgent

logger = logging.getLogger("CodeV1")

load_dotenv()

# NOTE: See installed kernels with `jupyter kernelspec list`
ALLOWED_KERNELS = os.getenv("ALLOWED_KERNELS", "python3,javascript,bash").split(',')


class CodeV1(XmppAgent):
  '''
  CodeV1 provides code execution with kernels similar to a Jupyter Notebook.
  '''

  async def start(self):
    await super().start()
    try:
      self.code = self.config.options.code
      logger.debug(f'self.code: {self.code}')
      self.env = {
        "PATH": os.environ["PATH"],
        **(getattr(self.code, "env", {})),
      }
      logger.debug(f'self.env: {self.env}')

      self.regex_start = re.compile(self.code.commands["start"])
      self.regex_restart = re.compile(self.code.commands["restart"])
      self.regex_reconnect = re.compile(self.code.commands["reconnect"])
      self.regex_shutdown = re.compile(self.code.commands["shutdown"])

      self.check_kernel()

      self.km = KernelManager(kernel_name=self.code.kernel)
      self.km.start_kernel(env=self.env)
      self.kc = self.km.client()
      self.kc.start_channels()

      await self.slog('debug', 'Agent started')

    except Exception as e:
      await self.slog('error', f"Error initializing: {e}")
      logger.error(f"Error initializing: {e}")
      if hasattr(self, "kc"):
        self.kc.stop_channels()
      if hasattr(self, "km"):
        self.km.shutdown_kernel()

  async def check_kernel(self):
    if self.code.kernel not in ALLOWED_KERNELS:
      await self.slog('error', f'Unknown kernel: {self.code.kernel}')
      raise Exception(f'Unknown kernel: {self.code.kernel}')
    pass

  async def chat(self, *, prompt, reply_func=None):
    loop = asyncio.get_event_loop()
    try:
      logger.debug(f"prompt: {prompt}")
      content = ''

      await self.check_kernel()

      if re.match(self.regex_start, prompt):
        logger.debug("START command")
        self.km = KernelManager(kernel_name=self.code.kernel)
        self.km.start_kernel(env=self.env)
        self.kc = self.km.client()
        self.kc.start_channels()
        return "Started the kernel."

      if re.match(self.regex_restart, prompt):
        logger.debug("RESTART command")
        self.kc.stop_channels()
        self.km.restart_kernel(env=self.env)
        self.kc = self.km.client()
        self.kc.start_channels()
        return "Restarted the kernel."

      if re.match(self.regex_reconnect, prompt):
        logger.debug("RECONNECT command")
        self.kc.stop_channels()
        self.kc = self.km.client()
        self.kc.start_channels()
        return "Reconnected to the kernel."

      if re.match(self.regex_shutdown, prompt):
        logger.debug("SHUTDOWN command")
        self.kc.stop_channels()
        self.kc = None
        self.km.shutdown_kernel()
        self.km = None
        return "Shut down the kernel."

      if not hasattr(self, 'km') or self.km is None:
        raise Exception('Kernel is not initialized')

      if not hasattr(self, 'kc') or self.kc is None:
        raise Exception('Kernel channels are not initialized')

      msg_id = self.kc.execute(prompt)
      logger.debug(f"msg_id: {msg_id}")
      while True:
        msg = await loop.run_in_executor(None, self.kc.get_iopub_msg)
        logger.debug(f"msg: {msg}")

        msg_type = msg.get('msg_type')
        content_obj = msg.get('content', {})

        if msg_type == 'stream':
          text = content_obj.get('text', '')
          content += text
          logger.debug(f"STDOUT: {text}")

        elif msg_type == 'execute_result':
          data = content_obj.get('data', {}).get('text/plain', '')
          content += data
          logger.debug(f"RESULT: {data}")

        elif msg_type == 'display_data':
          text_data = content_obj.get('data', {}).get('text/plain')
          image_data = content_obj.get('data', {}).get('image/png')
          if image_data:
            # img_tag = f'<img src="data:image/png;base64,{image_data}" alt="Plot Image"/>'
            # content += "\n" + img_tag
            # logger.debug("DISPLAY IMAGE embedded as base64 data URI.")
            markdown_img = f'![Plot Image](data:image/png;base64,{image_data})'
            content += "\n" + markdown_img
            logger.debug("DISPLAY IMAGE received (PNG).")
          if text_data:
            content += "\n" + text_data
            logger.debug(f"DISPLAY TEXT: {text_data}")

        elif msg_type == 'error':
          error = content_obj.get('evalue', '')
          content += f"\nError: {error}"
          logger.debug(f"ERROR: {error}")

        elif msg_type == 'status' and content_obj.get('execution_state') == 'idle':
          logger.debug(f"execution_state: {content_obj.get('execution_state')}")
          break

      if content == '':
        content = ' '

      return content

    except Exception as e:
      logger.error(f"Code error: {e}")
      await self.slog('error', f"Code error: {e}")
      return f'Error: {str(e)}'

  async def stop(self):
    """
    Release resources
    """
    try:
      await super().stop()
      self.kc.stop_channels()
      self.km.shutdown_kernel()
      await self.slog('info', 'Disconnected')
    except Exception as e:
      await self.slog('error', f"Disconnect error: {e}")
      logger.error(f"Disconnect error: {e}")
