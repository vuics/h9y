import logging
import asyncio

from xmpp_agent import XmppAgent

logger = logging.getLogger("CommandV1")


class AsyncShellExecutor:
  def __init__(self, *, execute='/bin/sh', shell=False):
    self.execute = execute
    self.shell = shell
    self.process = None
    self.reading_tasks = []  # Track reading tasks to cancel them before new command

  async def start_shell(self):
    """Starts an interactive shell session."""
    if self.process is None:
      logger.debug(f"start_execute execute: {self.execute}")
      if self.shell:
        self.process = await asyncio.create_subprocess_shell(
          self.execute,
          stdin=asyncio.subprocess.PIPE,
          stdout=asyncio.subprocess.PIPE,
          stderr=asyncio.subprocess.PIPE
        )
      else:
        self.process = await asyncio.create_subprocess_exec(
          self.execute,
          stdin=asyncio.subprocess.PIPE,
          stdout=asyncio.subprocess.PIPE,
          stderr=asyncio.subprocess.PIPE
        )
      # logger.debug(f'process: {self.process}')

  async def send_command(self, command):
    """Sends a command to the shell process."""
    if self.process and self.process.stdin:
      logger.debug(f"send_command: {command}")

      # Cancel any previous reading tasks before running new command
      for task in self.reading_tasks:
        task.cancel()

      self.reading_tasks.clear()  # Reset task tracking

      self.process.stdin.write(command.encode() + b'\n')
      await self.process.stdin.drain()
    else:
      logger.error("Shell is not running.")

  async def read_continuous_output(self, stream, reply_func):
    """Continuously reads and sends output until no more data arrives."""
    buffer = ''
    while True:
      try:
        # Try reading output with a short timeout to avoid blocking indefinitely
        line = await asyncio.wait_for(stream.readline(), timeout=1)
        if not line:
          break  # No more data, exit the loop

        # decoded_line = line.decode().strip()
        decoded_line = line.decode()
        logger.debug(f'read_output: {decoded_line}')
        buffer += decoded_line

      except asyncio.TimeoutError:
        if reply_func and buffer:
          logger.debug(f'buffer: {buffer}')
          reply_func(buffer)  # Send real-time output to XMPP
          buffer = ''
        continue  # No output received yet, keep checking
      except asyncio.CancelledError:
        break  # Exit the loop if task is cancelled

    logger.debug(f'exit buffer: {buffer}')
    if reply_func and buffer:
      reply_func(buffer)  # Send real-time output to XMPP
      buffer = ''

  async def run_prompt(self, prompt, reply_func):
    """Executes a command and continuously streams stdout & stderr."""
    if self.process and self.process.returncode is not None:
      logger.warning(f"Shell process exited with code: {self.process.returncode}, restarting...")
      self.process = None

    if not self.process:
      await self.start_shell()  # Ensure the shell is running

    logger.debug(f"run_prompt> send_command: {prompt}")
    await self.send_command(prompt)

    # Start continuous reading loops for both stdout and stderr
    stdout_task = asyncio.create_task(self.read_continuous_output(self.process.stdout, reply_func))
    stderr_task = asyncio.create_task(self.read_continuous_output(self.process.stderr, reply_func))

    # Track these tasks so they can be canceled if a new command arrives
    self.reading_tasks.extend([stdout_task, stderr_task])

    await asyncio.gather(stdout_task, stderr_task, return_exceptions=True)  # Avoid exceptions stopping execution


class CommandV1(XmppAgent):
  '''
  CommandV1 is a command executor that attaches input and output
  (stdin, stdout, stderr) so that a user can input programmatically by typing
  and it can see the shell output. It is possible to change a command
  and execute another command or script.
  '''
  async def start(self):
    await super().start()
    self.executor = AsyncShellExecutor(
      execute=self.config.options.command.execute,
      shell=self.config.options.command.shell,
    )
    await self.slog('debug', 'Agent started')

  async def chat(self, *, prompt, reply_func=None):
    try:
      logger.debug(f"prompt: {prompt}")
      logger.debug(f'self.config.options: {self.config.options}')
      logger.debug(f"self.config.options.command: {self.config.options.command}")

      edited_prompt = prompt.replace(self.config.options.name, "").strip()
      output = await self.executor.run_prompt(edited_prompt, reply_func)

      logger.debug(f"output: {output}")
      return output
    except Exception as e:
      logger.error(f"Chat error: {e}")
      await self.slog('error', f"Chat error: {e}")
      return f'Error: {str(e)}'
