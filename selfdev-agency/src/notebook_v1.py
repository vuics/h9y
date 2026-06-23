import os
import logging
import uuid
import sys
import asyncio
import copy

import papermill as pm
import tempfile
import nbconvert
import nbformat
import io
import concurrent.futures

from xmpp_agent import XmppAgent
from helpers import extract_and_parse_json

logger = logging.getLogger("NotebookV1")


class NotebookV1(XmppAgent):
  '''
  NotebookV1 provides exectution of Jupyter Notebooks and their outputs
  '''
  async def start(self):
    await super().start()
    await self.slog('debug', 'Agent started')

  async def run_papermill(self, *, notebook_path, parameters=None,
                          kernel_name='python3', reply_func=None):
    """
    Runs a Jupyter notebook with papermill and nbconvert Python APIs
    asynchronously and captures print outputs

    Args:
      notebook_path: Path to the .ipynb file
      parameters: Dictionary of parameters to pass to the notebook
    """
    if parameters is None:
      parameters = {}
    logger.debug(f'parameters: {parameters}')

    # Create temporary file for the executed notebook
    # temp_output = os.path.join(tempfile.gettempdir(), "output.ipynb")
    temp_output = os.path.join(tempfile.gettempdir(), f"temp_output_{str(uuid.uuid4())}.ipynb")
    logger.debug(f'temp_output: {temp_output}')

    # Execute papermill in a thread pool to avoid blocking
    loop = asyncio.get_event_loop()
    with concurrent.futures.ThreadPoolExecutor() as pool:
      await loop.run_in_executor(
        pool,
        lambda: pm.execute_notebook(
          notebook_path,
          temp_output,
          kernel_name=kernel_name,
          parameters=parameters
        )
      )

    # Read the notebook file in a non-blocking way
    with open(temp_output, 'r', encoding='utf-8') as f:
      notebook_content = f.read()
    logger.debug(f'notebook_content: {notebook_content}')

    notebook = nbformat.reads(notebook_content, as_version=4)
    logger.debug(f'notebook: {notebook}')

    # Create a Python exporter
    python_exporter = nbconvert.PythonExporter()

    # Convert the notebook to Python (run in thread pool)
    with concurrent.futures.ThreadPoolExecutor() as pool:
      python_code, _ = await loop.run_in_executor(
        pool,
        lambda: python_exporter.from_notebook_node(notebook)
      )

    class StreamingOutput(io.StringIO):
      def __init__(self, send_update, loop):
        super().__init__()
        self.send_update = send_update
        self.loop = loop
        self.buffer = ""

      def write(self, s):
        self.buffer += s
        asyncio.run_coroutine_threadsafe(self.send_update(s), self.loop)
        # if "\n" in self.buffer:
        #     lines = self.buffer.split("\n")
        #     for line in lines[:-1]:
        #         # Schedule update for every complete line (update the chat with new output)
        #         asyncio.run_coroutine_threadsafe(self.send_update(line), self.loop)
        #     self.buffer = lines[-1]
        return len(s)

    async def send_update(content):
      # Adjust this method if you have a specific method to send chat updates.
      # For example, if there's a self.send_message method, you could call: await self.send_message(content)
      # logger.debug(f"!!!!!!!!    Update: {content}")
      if reply_func:
        reply_func(content)

    def execute_and_capture():
      old_stdout = sys.stdout
      new_stdout = StreamingOutput(send_update, loop)
      sys.stdout = new_stdout
      logger.debug(f'python_code: {python_code}')
      try:
        exec(python_code)
        # Flush any remaining output in the buffer as one final update:
        # if new_stdout.buffer:
        #   asyncio.run_coroutine_threadsafe(send_update(new_stdout.buffer), loop)
        # return new_stdout.getvalue() + new_stdout.buffer
      finally:
        sys.stdout = old_stdout

    with concurrent.futures.ThreadPoolExecutor() as pool:
      output = await loop.run_in_executor(pool, execute_and_capture)
    logger.debug(f'output: {output}')

    # Clean up the temporary file
    try:
      os.remove(temp_output)
    except Exception as e:
      await self.slog('warn', f'Clean up the temporary file {temp_output} error: {e}')
      logger.warning(f'Clean up the temporary file {temp_output} error: {e}')

    # NOTE: output contains all the text
    #       It can be an option: return the whole text at the end
    # return output
    return ""

  async def chat(self, *, prompt, reply_func=None):
    try:
      logger.debug(f"prompt: {prompt}")
      logger.debug(f'self.config.options: {self.config.options}')
      logger.debug(f"self.config.options.notebook: {self.config.options.notebook}")
      parameters = {}
      if hasattr(self.config.options.notebook, 'parameters'):
        parameters = copy.deepcopy(self.config.options.notebook.parameters)
      if hasattr(self.config.options.notebook, 'parseJson') and self.config.options.notebook.parseJson:
        try:
          parsed_json = extract_and_parse_json(prompt)
          logger.debug(f'parsed_json: {parsed_json}')
          parameters.update(parsed_json)
        except Exception:
          pass
      if hasattr(self.config.options.notebook, 'promptKey'):
        parameters.update({self.config.options.notebook.promptKey: prompt})
      output = await self.run_papermill(
        notebook_path=self.config.options.notebook.filePath,
        parameters=parameters,
        kernel_name=self.config.options.notebook.kernelName if hasattr(self.config.options.notebook, 'kernelName') else None,
        reply_func=reply_func,
      )

      # TODO: Integrate with Scrapbook?
      # https://pypi.org/project/scrapbook/

      logger.debug(f"output: {output}")
      return output
    except Exception as e:
      await self.slog('error', f"Notebook error: {e}")
      logger.error(f"Notebook error: {e}")
      return f'Error: {str(e)}'
