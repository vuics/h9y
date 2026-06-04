#!/bin/sh

# npm run ocean &
# exec node openclaw.mjs gateway

cd /app/
node /app/openclaw.mjs setup
node /app/openclaw.mjs config set gateway.http.endpoints.chatCompletions.enabled true

node /app/openclaw.mjs onboard --non-interactive \
  --auth-choice ollama \
  --gateway-auth token \
  --gateway-token 123 \
  --custom-base-url "http://ollama:11436" \
  --custom-model-id "qwen2.5:0.5b" \
  --accept-risk

# openclaw onboard --non-interactive \
#   --auth-choice custom-api-key \
#   --custom-base-url "https://llm.example.com/v1" \
#   --custom-model-id "foo-large" \
#   --custom-api-key "$CUSTOM_API_KEY" \
#   --secret-input-mode plaintext \
#   --custom-compatibility openai \
#   --custom-image-input


node /app/openclaw.mjs gateway --token 123 &

cd /opt/app/
npm run ocean

