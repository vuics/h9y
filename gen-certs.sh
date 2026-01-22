#!/bin/sh

# Import .env
set -a
source .env
set +a

# Install mkcert. For more info about how to install on your OS, see:
#   https://github.com/FiloSottile/mkcert
brew install mkcert
mkcert -install

# Make sure DOMAIN is set
if [ -z "$DOMAIN" ]; then
  echo "DOMAIN is not set. Please export DOMAIN=yourdomain.com"
  exit 1
fi

generate_cert() {
  local dir="./certs/$1"
  local host="$1"

  if [ ! -d "$dir" ]; then
    echo "Creating directory: $dir"
    mkdir -p "$dir"
    echo "Generating certificate for $host"
    mkcert -key-file "$dir/tls.key" -cert-file "$dir/tls.crt" "$host" "*.$host"
  else
    echo "Directory already exists: $dir — skipping"
  fi
}

# List of hostnames to generate certificates for
generate_cert "${DOMAIN}"
generate_cert "localhost"

# NOTE: Another way to generate cert
#
# openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
#   -keyout certs/traefik/local.key -out certs/traefik/local.crt \
#   -subj "/CN=*.h9y.localhost,h9y.localhost"
