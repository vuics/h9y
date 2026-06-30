import logging
import asyncio
import time
import pyautogui
import base64
import io
import re
import hashlib
import json
import os

from PIL import Image
from ollama import AsyncClient

from xmpp_agent import XmppAgent
from command_v1 import AsyncShellExecutor

logger = logging.getLogger("ComputeruseV1")

# pyautogui.FAILSAFE = True
pyautogui.FAILSAFE = False
pyautogui.PAUSE = 0.1


def take_screenshot():
  print('take_screenshot():')
  img = pyautogui.screenshot()
  return img


def image_to_base64(img):
  buffer = io.BytesIO()
  img.save(buffer, format="PNG")
  return base64.b64encode(buffer.getvalue()).decode()


def hash_image(img):
  return hashlib.md5(img.tobytes()).hexdigest()


class ComputeruseV1(XmppAgent):
  '''
  ComputeruseV1 is a Computer Use Agent
  '''
  def __init__(self, *args, **kwargs):
    super().__init__(*args, **kwargs)

    self.provider = None
    self.model = None
    self.api_key = None
    self.base_url = None

    self.max_history = 8

    self.action_history = []
    self.typed_cache = set()
    self.last_screen_hash = None  # MD5 hash of the previous screenshot
    self.last_action = None       # Previously executed action, eg: {"type": "click", "args": {"x":100,"y":200}}
    self.last_response = None     # Raw response from the model (useful for debugging)
    self.repeat_count = 0         # Number of consecutive repeated actions on an unchanged screen
    self.screenshot_num = 0

  async def start(self):
    await super().start()
    self.executor = AsyncShellExecutor(
      execute=self.config.options.computeruse.execute,
      shell=self.config.options.computeruse.shell,
    )

    self.provider = self.config.options.computeruse.model.provider
    self.model = self.config.options.computeruse.model.name
    self.api_key = self.config.options.computeruse.model.apiKey or None

    if self.provider == "ollama":
      self.base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
      logger.debug(f"base_url: {self.base_url}")
      self.client = AsyncClient(
        host=self.base_url,
        headers={'Authorization': 'Bearer ' + self.api_key}
      )
    else:
      raise ValueError(f"Unknown provider: {self.provider}")

    await self.slog('debug', 'Agent started')

  async def call_vlm(self, goal, img_b64):
    language = "en"
    history_text = "\n".join(self.action_history[-self.max_history:]) if self.action_history else "None"
    # print("--> history_text:", history_text)

    content_prompt = f"""You are a GUI agent.
You are controlling a Linux desktop (Debian Bookworm XFCE4).
You are given a task and your action history, with screenshots.
You need to perform the next action to complete the task.
You must output ONLY valid JSON.

## OUTPUT FORMAT (STRICT)
Return exactly one JSON object:
{{
  "thought": "short reasoning",
  "action": {{
    "type": "click | double_click | right_click | drag | hotkey | type_text | scroll | wait | finished",
    "args": {{}}
  }}
}}

## ACTION SPECIFICATION
{{ "type": "click", "args": {{ "x": 100, "y": 200 }} }}
{{ "type": "double_click", "args": {{ "x": 100, "y": 200 }} }}
{{ "type": "right_click", "args": {{ "x": 100, "y": 200 }} }}
{{ "type": "drag", "args": {{ "x1": 100, "y1": 200, "x2": 300, "y2": 400 }} }}
{{ "type": "hotkey", "args": {{ "keys": ["ctrl", "l"] }} }}
{{ "type": "type_text", "args": {{ "text": "echo Hello World\\n" }} }}
{{ "type": "scroll", "args": {{ "direction": "down or up or right or left", "x": 100, "y": 200 }} }}
{{ "type": "wait", "args": {{ "seconds": 2 }} }}
{{ "type": "finished", "args": {{ "message": "task complete" }} }}

## RULES
- Output ONLY JSON, no markdown, no text
- Do NOT use markdown
- Do NOT wrap output in ``` or ```json
- Output raw JSON only
- ONLY ONE action per response
- Never use normalized coordinates (0-1)
- Always use pixel coordinates from screenshot
- If nothing changed on screen, DO NOT repeat the same action, try a different approach.
- If your previous action was BLOCKED or repeated, it did NOT execute.
- If task is complete, use "finished"

## Note
- Use {language} in `thought` json field.
- Write a small plan and finally summarize your next action (with its target element) in one sentence in `thought` json field.

## Action History
{history_text}

## User Instruction
{goal}
"""
    # print("--> content_prompt:", content_prompt)
    if self.provider == "ollama":
      response = await self.client.chat(
        model=self.model,
        messages=[{
          "role": "user",
          "content": content_prompt,
          "images": [img_b64]
        }]
      )
      return response.message.content
    else:
      raise ValueError(f"Unknown provider: {self.provider}")

    return None

  def parse_vlm_output(self, text: str):
    if not text:
      return None
    text = text.replace("```json", "")
    text = text.replace("```", "")
    text = text.strip()

    try:
      return json.loads(text)
    except Exception:
      pass

    # fallback: extract first JSON object
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
      try:
        return json.loads(match.group(0))
      except Exception as e:
        print("❌ JSON extract failed:", e)
        print("RAW:", text)
        return None

    print("❌ No JSON found")
    print("RAW:", text)
    return None

  def detect_loop(self, action, response, screen_hash):
    """
    LOOP DETECTION
    Prevents endless loops such as:
    click(100,200)
    click(100,200)
    click(100,200)
    while the screen never changes.
    """
    repeated_action = (
      self.last_action == action
    )
    same_screen = (
      self.last_screen_hash == screen_hash
    )
    if repeated_action and same_screen:
      self.repeat_count += 1
    else:
      self.repeat_count = 0
    self.last_action = action
    self.last_response = response
    self.last_screen_hash = screen_hash
    if self.repeat_count >= 2:
      print("🛑 LOOP DETECTED")
      return True

    return False

  def execute(self, vlm_output, screen_img):
    data = self.parse_vlm_output(vlm_output)
    if not data:
      return True

    action = data.get("action", {})
    action_type = action.get("type")
    args = action.get("args", {})

    # Detect repeated actions on identical screens.
    screen_hash = hash_image(screen_img)
    if self.detect_loop(action, vlm_output, screen_hash):
      print("⏭ Skipping repeated action.")
      self.action_history.append(json.dumps({
        "action": action,
        "result": "blocked_loop"
      }))
      return True

    print("\n🧠 ACTION:", action_type, args)
    if action_type == "click":
      x, y = args["x"], args["y"]
      pyautogui.click(x, y)
    elif action_type == "double_click":
      x, y = args["x"], args["y"]
      pyautogui.doubleClick(x, y)
    elif action_type == "right_click":
      x, y = args["x"], args["y"]
      pyautogui.click(x, y, button="right")
    elif action_type == "drag":
      x1 = args["x1"]
      y1 = args["y1"]
      x2 = args["x2"]
      y2 = args["y2"]
      pyautogui.moveTo(x1, y1)
      pyautogui.dragTo(x2, y2, duration=0.5)
    elif action_type == "hotkey":
      keys = args.get("keys", [])
      pyautogui.hotkey(*keys)
    elif action_type == "type_text":
      text = args.get("text", "")
      if text in self.typed_cache:
        print("🛑 Duplicate typing blocked")
        self.action_history.append(json.dumps({
          "action": action,
          "result": "blocked_duplicate"
        }))
        return True
      self.typed_cache.add(text)
      pyautogui.write(text.replace("\\n", "\n"), interval=0.02)
      if text.endswith("\\n"):
        pyautogui.press("enter")
    elif action_type == "scroll":
      direction = args.get("direction", "down")
      x = args.get("x")
      y = args.get("y")
      clicks = -500 if direction == "down" else 500
      if x is not None and y is not None:
        pyautogui.scroll(clicks, x=x, y=y)
      else:
        pyautogui.scroll(clicks)
    elif action_type == "wait":
      seconds = args.get("seconds", 2)
      time.sleep(seconds)
    elif action_type == "finished":
      print("✅ DONE")
      return False
    else:
      print("⚠ Unknown action:", action_type)

    self.action_history.append(json.dumps({
      "action": action,
      "result": "executed"
    }))
    if len(self.action_history) > self.max_history:
      self.action_history.pop(0)
    return True

  async def run(self, *, goal, reply_func):
    while True:
      img = take_screenshot()
      print("\n=== Take Screenshot ===\n", img)
      img_b64 = image_to_base64(img)

      # logger.debug(f"img_b64: {img_b64}")
      get_url = await self.upload_file(
        file_base64=img_b64,
        filename=f'screenshot_{self.screenshot_num}.png',
        content_type='image/png',
      )
      self.screenshot_num += 1
      logger.info(f"get_url: {get_url}")
      if reply_func:
        reply_func(get_url)

      vlm_output = await self.call_vlm(goal, img_b64)
      print("\n=== VLM OUTPUT ===\n", vlm_output)
      if reply_func:
        reply_func(vlm_output)

      cont = self.execute(vlm_output, img)
      print("\n==> cont:", cont)
      if cont is False:
        break
      time.sleep(1)

  async def chat(self, *, prompt, reply_func=None):
    self.action_history = []
    self.typed_cache = set()
    self.last_screen_hash = None
    self.last_action = None
    self.last_response = None
    self.repeat_count = 0
    self.screenshot_num = 0

    try:
      logger.debug(f"prompt: {prompt}")
      # logger.debug(f'self.config.options: {self.config.options}')
      # logger.debug(f"self.config.options.computeruse: {self.config.options.computeruse}")
      # edited_prompt = prompt.replace(self.config.options.name, "").strip()
      # output = await self.executor.run_prompt(edited_prompt, reply_func)
      # logger.debug(f"output: {output}")
      # return output

      # prompt = """
      # Open terminal and type echo Hello World, then press Enter.
      # """
      await self.run(goal=prompt, reply_func=reply_func)

      return "DONE"
    except Exception as e:
      logger.error(f"Chat error: {e}")
      await self.slog('error', f"Chat error: {e}")
      return f'Error: {str(e)}'
