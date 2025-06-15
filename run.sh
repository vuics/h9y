#!/bin/sh

uvicorn --factory speaches.main:create_app &
APP_PID=$!
echo "Uvicorn running in background with PID $APP_PID"
sleep 10

chown -R ubuntu:ubuntu /home/ubuntu/.cache/huggingface/hub/
chmod -R +rw /home/ubuntu/.cache/huggingface/hub/

# Download all desired models on the first run of the container.
# The speaches-cli downloads the models only once and later reports that the
#  > Model '<model>' already exists
#
speaches-cli model download Systran/faster-distil-whisper-small.en
speaches-cli model download speaches-ai/Kokoro-82M-v1.0-ONNX

wait "$APP_PID" # Waits for uvicorn to finish

