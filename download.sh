#!/bin/sh

echo "Waiting for server to be ready: $SPEACHES_BASE_URL..."
until curl -sf $SPEACHES_BASE_URL ; do
  sleep 1
done
echo "Server is up. Downloading models..."

# Download all desired models on the first run of the container.
# The speaches-cli downloads the models only once and later reports that the
#  > Model '<model>' already exists
#
speaches-cli model download Systran/faster-distil-whisper-small.en
speaches-cli model download speaches-ai/Kokoro-82M-v1.0-ONNX

echo "Downloaded models."
