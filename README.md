# Selfdev-Speech

This repo provides backend for Speech-to-text and Text-to-speech services.

The project is based on Speaches.

[Speaches](https://speaches.ai/) is an OpenAI API-compatible server supporting streaming transcription, translation, and speech generation. Speach-to-Text is powered by [faster-whisper](https://github.com/SYSTRAN/faster-whisper) and for Text-to-Speech [piper](https://github.com/rhasspy/piper) and [Kokoro](https://huggingface.co/hexgrad/Kokoro-82M) are used. Speaches project aims to be Ollama, but for TTS/STT models.

## Run stack

```bash
docker compose build
docker compose up
```

You can open the web ui at: [http://localhost:8372](http://localhost:8372).

## Download Models

The script [./download.sh](./download.sh) can download models upon container start.

You can also download models manually:

```bash
# STT:
docker-compose exec selfdev-speech speaches-cli registry ls --task automatic-speech-recognition
docker-compose exec selfdev-speech speaches-cli model download Systran/faster-distil-whisper-small.en
docker-compose exec selfdev-speech speaches-cli model ls --task text-to-speech

# TTS:
docker-compose exec selfdev-speech uvx speaches-cli registry ls --task text-to-speech
docker-compose exec selfdev-speech uvx speaches-cli model download speaches-ai/Kokoro-82M-v1.0-ONNX
docker-compose exec selfdev-speech uvx speaches-cli model ls --task text-to-speech
```

## Use

```bash
export SPEACHES_BASE_URL="http://localhost:8372"

# STT:
export MODEL_ID="Systran/faster-distil-whisper-small.en"
curl -s "$SPEACHES_BASE_URL/v1/audio/transcriptions" -F "file=@audio.webm" -F "model=$MODEL_ID"

# TTS:
export MODEL_ID="speaches-ai/Kokoro-82M-v1.0-ONNX"
export VOICE_ID="af_heart"
curl "$SPEACHES_BASE_URL/v1/audio/speech" -s -H "Content-Type: application/json" \
  --output audio.mp3 \
  --data @- << EOF
{
  "input": "Hello World!",
  "model": "$MODEL_ID",
  "voice": "$VOICE_ID"
}
EOF
```
