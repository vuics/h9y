#!/bin/sh

curl https://raw.githubusercontent.com/vuics/h9y/refs/heads/main/docker-compose.yml --output docker-compose.yml && \
  curl https://raw.githubusercontent.com/vuics/h9y/refs/heads/main/env.example --output .env && \
  curl https://raw.githubusercontent.com/vuics/h9y/refs/heads/main/gen-certs.sh --output gen-certs.sh && \
  curl https://raw.githubusercontent.com/vuics/h9y/refs/heads/main/setup-hosts.sh --output setup-hosts.sh && \
  mkdir -p config/prometheus/ config/traefik/ config/vault/ && \
  curl https://raw.githubusercontent.com/vuics/h9y/refs/heads/main/config/prometheus/prometheus.yml --output config/prometheus/prometheus.yml && \
  curl https://raw.githubusercontent.com/vuics/h9y/refs/heads/main/config/traefik/tls.yaml --output config/traefik/tls.yaml && \
  curl https://raw.githubusercontent.com/vuics/h9y/refs/heads/main/config/vault/config.hcl --output config/vault/config.hcl && \
  chmod +x gen-certs.sh setup-hosts.sh
