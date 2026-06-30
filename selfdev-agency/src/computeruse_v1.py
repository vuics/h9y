import logging
import asyncio

from xmpp_agent import XmppAgent
from command_v1 import AsyncShellExecutor

logger = logging.getLogger("ComputeruseV1")


class ComputeruseV1(XmppAgent):
  '''
  ComputeruseV1 is a command executor that attaches input and output
  (stdin, stdout, stderr) so that a user can input programmatically by typing
  and it can see the shell output. It is possible to change a command
  and execute another command or script.
  '''
  async def start(self):
    await super().start()
    self.executor = AsyncShellExecutor(
      execute=self.config.options.computeruse.execute,
      shell=self.config.options.computeruse.shell,
    )
    await self.slog('debug', 'Agent started')

  async def chat(self, *, prompt, reply_func=None):
    try:
      logger.debug(f"prompt: {prompt}")
      logger.debug(f'self.config.options: {self.config.options}')
      logger.debug(f"self.config.options.computeruse: {self.config.options.computeruse}")

      edited_prompt = prompt.replace(self.config.options.name, "").strip()
      output = await self.executor.run_prompt(edited_prompt, reply_func)

      logger.debug(f"output: {output}")
      return output
    except Exception as e:
      logger.error(f"Chat error: {e}")
      await self.slog('error', f"Chat error: {e}")
      return f'Error: {str(e)}'
