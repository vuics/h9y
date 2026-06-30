import time
import pyautogui
import base64
import io
import re
import hashlib
import asyncio
import json

from PIL import Image
from ollama import AsyncClient

# pyautogui.FAILSAFE = True
pyautogui.FAILSAFE = False
pyautogui.PAUSE = 0.1


client = AsyncClient(
    host="http://ollama:11436",
)
MODEL = "gemma4"

ACTION_HISTORY = []
MAX_HISTORY = 8
# FIXME: we lost usage of the following variables. Should we fix or remove them completelly?
# last_vlm_output = None
# last_action_signature = None
# repeat_counter = 0
# last_screen_hash = None
typed_cache = set()

# Keeps track of previous execution to detect loops.
STATE = {
    # MD5 hash of the previous screenshot
    "last_screen_hash": None,

    # Previously executed action
    # Example:
    # {"type": "click", "args": {"x":100,"y":200}}
    "last_action": None,

    # Raw response from the model (useful for debugging)
    "last_response": None,

    # Number of consecutive repeated actions on an unchanged screen
    "repeat_count": 0,
}


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


async def call_vlm(goal, image):
    img_b64 = image_to_base64(image)
    language = "en"
    history_text = "\n".join(ACTION_HISTORY[-MAX_HISTORY:]) if ACTION_HISTORY else "None"
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

    response = await client.chat(
        model=MODEL,
        messages=[
            {
                "role": "user",
                "content": content_prompt,
                "images": [img_b64]
            }
        ]
    )
    return response.message.content


def parse_vlm_output(text: str):
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

# ==========================================================
# LOOP DETECTION
# Prevents endless loops such as:
# click(100,200)
# click(100,200)
# click(100,200)
# while the screen never changes.
# ==========================================================
def detect_loop(action, response, screen_hash):
    repeated_action = (
        STATE["last_action"] == action
    )
    same_screen = (
        STATE["last_screen_hash"] == screen_hash
    )
    if repeated_action and same_screen:
        STATE["repeat_count"] += 1
    else:
        STATE["repeat_count"] = 0
    STATE["last_action"] = action
    STATE["last_response"] = response
    STATE["last_screen_hash"] = screen_hash
    if STATE["repeat_count"] >= 2:
        print("🛑 LOOP DETECTED")
        return True

    return False


def execute(vlm_output, screen_img):
    global typed_cache

    data = parse_vlm_output(vlm_output)
    if not data:
        return True

    action = data.get("action", {})
    action_type = action.get("type")
    args = action.get("args", {})

    # Detect repeated actions on identical screens.
    screen_hash = hash_image(screen_img)
    if detect_loop(action, vlm_output, screen_hash):
        print("⏭ Skipping repeated action.")
        ACTION_HISTORY.append(json.dumps({
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
        if text in typed_cache:
            print("🛑 Duplicate typing blocked")
            ACTION_HISTORY.append(json.dumps({
                "action": action,
                "result": "blocked_duplicate"
            }))
            return True
        typed_cache.add(text)
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

    # ACTION_HISTORY.append(json.dumps(data))
    ACTION_HISTORY.append(json.dumps({
        "action": action,
        "result": "executed"
    }))
    if len(ACTION_HISTORY) > MAX_HISTORY:
        ACTION_HISTORY.pop(0)
    return True


async def run(goal):
    while True:
        img = take_screenshot()
        print("\n=== Take Screenshot ===\n", img)

        vlm_output = await call_vlm(goal, img)
        print("\n=== VLM OUTPUT ===\n", vlm_output)

        cont = execute(vlm_output, img)
        print("\n==> cont:", cont)
        if cont is False:
            break
        time.sleep(1)


if __name__ == "__main__":
    goal = """
Open terminal and type echo Hello World, then press Enter.
"""
    asyncio.run(run(goal))
