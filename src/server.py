from fastapi import FastAPI, File, UploadFile
from fastapi.responses import FileResponse
import os
import shutil

app = FastAPI()
UPLOAD_FOLDER = "/tmp/uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.post("/process")
async def process_files(image: UploadFile = File(...), audio: UploadFile = File(...)):
    image_path = os.path.join(UPLOAD_FOLDER, "input_image.jpg")
    audio_path = os.path.join(UPLOAD_FOLDER, "input_audio.mp3")
    video_path = os.path.join(UPLOAD_FOLDER, "output_video.mp4")

    # Save uploaded image
    with open(image_path, "wb") as buffer:
        shutil.copyfileobj(image.file, buffer)

    # Save uploaded audio
    with open(audio_path, "wb") as buffer:
        shutil.copyfileobj(audio.file, buffer)

    # Simulate video processing
    with open(video_path, "wb") as f:
        f.write(b"FakeVideoContent")

    return FileResponse(video_path, media_type="video/mp4", filename="output_video.mp4")

# CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "5000"]
if __name__ == "__main__":
  import uvicorn
  uvicorn.run(app, host="0.0.0.0", port=8533)
