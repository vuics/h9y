import os
import uuid
import shutil

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
import subprocess
from typing import Optional
from pathlib import Path

app = FastAPI()

# Configuration
UPLOAD_DIR = "uploads"
RESULTS_DIR = "results"
ALLOWED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg"}
ALLOWED_AUDIO_EXTENSIONS = {".wav"}
PROCESS_TIMEOUT = 600  # 10 minutes timeout for processing

# Ensure directories exist
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(RESULTS_DIR, exist_ok=True)


def get_file_extension(filename: str) -> str:
  return Path(filename).suffix.lower()


def is_allowed_file(filename: str, allowed_extensions: set) -> bool:
  return get_file_extension(filename) in allowed_extensions


def clean_up_files(*file_paths):
  """Clean up temporary files"""
  for file_path in file_paths:
    try:
      if os.path.isfile(file_path):
        os.unlink(file_path)
      elif os.path.isdir(file_path):
        shutil.rmtree(file_path)
    except Exception as e:
      print(f"Error deleting {file_path}: {e}")


@app.post("/generate_video")
async def generate_video(
  image: UploadFile = File(...),
  audio: UploadFile = File(...),
  enhancer: Optional[str] = "gfpgan"
):
  # Validate file types
  if not is_allowed_file(image.filename, ALLOWED_IMAGE_EXTENSIONS):
    raise HTTPException(
      status_code=400,
      detail="Invalid image file type. Only PNG, JPG, JPEG are allowed."
    )

  if not is_allowed_file(audio.filename, ALLOWED_AUDIO_EXTENSIONS):
    raise HTTPException(
      status_code=400,
      detail="Invalid audio file type. Only WAV is allowed."
    )

  # Create unique ID for this request
  request_id = str(uuid.uuid4())
  temp_dir = os.path.join(UPLOAD_DIR, request_id)
  os.makedirs(temp_dir, exist_ok=True)

  # Save uploaded files
  image_path = os.path.join(temp_dir, f"source{get_file_extension(image.filename)}")
  audio_path = os.path.join(temp_dir, f"audio{get_file_extension(audio.filename)}")

  try:
    # Save image file
    with open(image_path, "wb") as buffer:
      shutil.copyfileobj(image.file, buffer)

    # Save audio file
    with open(audio_path, "wb") as buffer:
      shutil.copyfileobj(audio.file, buffer)

    # Prepare output directory
    output_dir = os.path.join(RESULTS_DIR, request_id)
    os.makedirs(output_dir, exist_ok=True)

    # Run the inference command
    cmd = [
      "python", "inference.py",
      "--driven_audio", audio_path,
      "--source_image", image_path,
      "--enhancer", enhancer,
      "--result_dir", output_dir
    ]

    try:
      subprocess.run(cmd, check=True, timeout=PROCESS_TIMEOUT)
    except subprocess.TimeoutExpired:
      raise HTTPException(
        status_code=504,
        detail="Processing timed out. Please try again with smaller files."
      )
    except subprocess.CalledProcessError as e:
      raise HTTPException(
        status_code=500,
        detail=f"Error during video generation: {str(e)}"
      )

    # Find the generated video file
    generated_files = list(Path(output_dir).rglob("*.mp4"))
    if not generated_files:
      raise HTTPException(
        status_code=500,
        detail="Video generation failed - no output file created."
      )

    # Return the first found video file
    video_path = generated_files[0]

    # Clean up input files (output files remain for potential caching)
    clean_up_files(image_path, audio_path, temp_dir)

    return FileResponse(
      video_path,
      media_type="video/mp4",
      filename=f"generated_{request_id}.mp4"
    )

  except Exception as e:
    # Clean up any created files on error
    clean_up_files(image_path, audio_path, temp_dir)
    raise HTTPException(
      status_code=500,
      detail=f"An error occurred: {str(e)}"
    )

if __name__ == "__main__":
  import uvicorn
  uvicorn.run(app, host="0.0.0.0", port=8533)
