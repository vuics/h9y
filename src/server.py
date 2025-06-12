import os
import logging
import shutil
import subprocess
import re

import uuid
from dotenv import load_dotenv
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import FileResponse

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger("server")  # match this with logger in the handler

# Load environment variables
load_dotenv()

UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", "/tmp/uploads")
RESULT_FOLDER = os.getenv("RESULT_FOLDER", "/opt/app/data")
SADTALKER_DIR = os.getenv("SADTALKER_DIR", "/opt/app/sadtalker")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(RESULT_FOLDER, exist_ok=True)

app = FastAPI()

def run_command(command, cwd=None):
  output_lines = []

  process = subprocess.Popen(
    command,
    shell=True,
    cwd=cwd,
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    universal_newlines=True,
    bufsize=1
  )

  for line in process.stdout:
    stripped = line.strip()
    output_lines.append(stripped)
    logger.info(stripped)

  process.stdout.close()
  return_code = process.wait()

  if return_code != 0:
    raise subprocess.CalledProcessError(return_code, command)

  return "\n".join(output_lines)


@app.post("/process")
async def process_files(image: UploadFile = File(...), audio: UploadFile = File(...)):
  try:
    logger.debug('/process started...')

    # Extract filename and content type from HTTP headers
    image_filename = image.filename or "input_image.jpg"
    image_mime = image.content_type or "application/octet-stream"

    audio_filename = audio.filename or "input_audio.wav"
    audio_mime = audio.content_type or "application/octet-stream"

    # Log for debug
    logger.info(f"Received image: {image_filename} ({image_mime})")
    logger.info(f"Received audio: {audio_filename} ({audio_mime})")

    # Save uploaded files
    image_path = os.path.join(UPLOAD_FOLDER, image_filename)
    audio_path = os.path.join(UPLOAD_FOLDER, audio_filename)

    with open(image_path, "wb") as buffer:
      shutil.copyfileobj(image.file, buffer)
    with open(audio_path, "wb") as buffer:
      shutil.copyfileobj(audio.file, buffer)

    # Convert audio to .wav (mono, 16kHz)
    converted_audio_path = os.path.join(UPLOAD_FOLDER, f"{uuid.uuid4().hex}_converted.wav")
    try:
      subprocess.run([
        "ffmpeg", "-y", "-i", audio_path,
        "-ar", "16000", "-ac", "1", "-vn",
        converted_audio_path
      ], check=True)
    except subprocess.CalledProcessError as e:
      logger.error(f"Audio conversion failed: {e}")
      raise HTTPException(status_code=500, detail="Audio format conversion failed") from e
    logger.debug(f"converted_audio_path: {converted_audio_path}")

    # Run SadTalker
    command = [
      "python", "inference.py",
      "--driven_audio", converted_audio_path,
      "--source_image", image_path,
      "--enhancer", "gfpgan",
      "--batch_size", "1",
      "--cpu",
      "--still",
      "--preprocess", "crop",
      "--size", "256",
      "--result_dir", RESULT_FOLDER,
    ]

    # Example: run inside `sadtalker` directory
    try:
      stdout = run_command(" ".join(command), cwd="sadtalker")
      logger.info(f"command stdout: {stdout}")
    except subprocess.CalledProcessError as e:
      logger.error(f"SadTalker failed: {e}")
      raise HTTPException(status_code=500, detail="SadTalker processing failed") from e

    # stdout = f'''
# using safetensor as default
# 3DMM Extraction for source image


# landmark Det::   0%|          | 0/1 [00:00<?, ?it/s]
# landmark Det:: 100%|██████████| 1/1 [00:22<00:00, 22.37s/it]
# landmark Det:: 100%|██████████| 1/1 [00:22<00:00, 22.37s/it]


# 3DMM Extraction In Video::   0%|          | 0/1 [00:00<?, ?it/s]
# 3DMM Extraction In Video:: 100%|██████████| 1/1 [00:03<00:00,  3.66s/it]
# 3DMM Extraction In Video:: 100%|██████████| 1/1 [00:03<00:00,  3.66s/it]


# mel::   0%|          | 0/10 [00:00<?, ?it/s]
# mel:: 100%|██████████| 10/10 [00:00<00:00, 40291.10it/s]


# audio2exp::   0%|          | 0/1 [00:00<?, ?it/s]
# audio2exp:: 100%|██████████| 1/1 [00:00<00:00,  7.89it/s]
# audio2exp:: 100%|██████████| 1/1 [00:00<00:00,  7.88it/s]


# Face Renderer::   0%|          | 0/10 [00:00<?, ?it/s]
# Face Renderer::  10%|█         | 1/10 [00:52<07:48, 52.04s/it]
# Face Renderer::  20%|██        | 2/10 [01:42<06:48, 51.01s/it]
# Face Renderer::  30%|███       | 3/10 [02:31<05:51, 50.27s/it]
# Face Renderer::  40%|████      | 4/10 [03:20<04:59, 49.86s/it]
# Face Renderer::  50%|█████     | 5/10 [04:10<04:08, 49.64s/it]
# Face Renderer::  60%|██████    | 6/10 [04:59<03:17, 49.44s/it]
# Face Renderer::  70%|███████   | 7/10 [05:50<02:29, 49.92s/it]
# Face Renderer::  80%|████████  | 8/10 [06:40<01:40, 50.10s/it]
# Face Renderer::  90%|█████████ | 9/10 [07:31<00:50, 50.29s/it]
# Face Renderer:: 100%|██████████| 10/10 [08:21<00:00, 50.30s/it]
# Face Renderer:: 100%|██████████| 10/10 [08:21<00:00, 50.17s/it]
# IMAGEIO FFMPEG_WRITER WARNING: input image is not divisible by macro_block_size=16, resizing from (256, 236) to (256, 240) to ensure video compatibility with most codecs and players. To prevent resizing, make your input image divisible by the macro_block_size or set the macro_block_size to 1 (risking incompatibility).
# The generated video is named /opt/app/data/2025_06_12_00.55.17/test##0a2a54a021004bdf87745d21d436e960_converted.mp4
# face enhancer....


# Face Enhancer::   0%|          | 0/10 [00:00<?, ?it/s]
# Face Enhancer::  10%|█         | 1/10 [00:41<06:09, 41.04s/it]
# Face Enhancer::  20%|██        | 2/10 [01:21<05:26, 40.83s/it]
# Face Enhancer::  30%|███       | 3/10 [02:02<04:46, 40.90s/it]
# Face Enhancer::  40%|████      | 4/10 [02:43<04:06, 41.04s/it]
# Face Enhancer::  50%|█████     | 5/10 [03:24<03:23, 40.74s/it]
# Face Enhancer::  60%|██████    | 6/10 [04:05<02:43, 40.86s/it]
# Face Enhancer::  70%|███████   | 7/10 [04:45<02:02, 40.79s/it]
# Face Enhancer::  80%|████████  | 8/10 [05:26<01:21, 40.59s/it]
# Face Enhancer::  90%|█████████ | 9/10 [06:06<00:40, 40.67s/it]
# Face Enhancer:: 100%|██████████| 10/10 [06:47<00:00, 40.60s/it]
# Face Enhancer:: 100%|██████████| 10/10 [06:47<00:00, 40.74s/it]
# The generated video is named /opt/app/data/2025_06_12_00.55.17/test##0a2a54a021004bdf87745d21d436e960_converted_enhanced.mp4
# The generated video is named: /opt/app/data/2025_06_12_00.55.17.mp4
# '''

    # Parse the generated video file path from stdout
    match = re.search(r"The generated video is named: (.+\.mp4)", stdout)
    if not match:
      logger.error("Failed to parse output video path from SadTalker output.")
      raise HTTPException(status_code=500, detail="Could not locate generated video.")

    video_path = match.group(1).strip()

    # Debug video:
    # video_path = "/opt/app/data/2025_06_11_02.08.43.mp4"

    if not os.path.isfile(video_path):
      logger.error(f"Output video not found: {video_path}")
      raise HTTPException(status_code=500, detail="Output video missing after processing.")

    filename = os.path.basename(video_path)
    media_type = "video/mp4"
    logger.debug(f"video_path: {video_path}")
    logger.debug(f"filename: {filename}")
    logger.debug(f"media_type: {media_type}")
    return FileResponse(video_path, media_type=media_type, filename=filename)

  except Exception as e:
    logger.error(f"Avatar error: {e}")
    # return f"Error: {str(e)}"
    # return {"error": f"{str(e)}"}
    raise e

  finally:
    # TODO: cleanup video_path too:
    #
    # for file_path in [image_path, audio_path, converted_audio_path, video_path]:
    for file_path in [image_path, audio_path, converted_audio_path]:
      if file_path and os.path.exists(file_path):
        try:
          os.remove(file_path)
          logger.debug(f"Deleted temporary file: {file_path}")
        except Exception as cleanup_error:
          logger.warning(f"Failed to delete {file_path}: {cleanup_error}")

if __name__ == "__main__":
  import uvicorn
  uvicorn.run(app, host="0.0.0.0", port=8533)
