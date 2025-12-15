#!/bin/sh

# Import .env
set -a
source .env
set +a

echo "Configuring /etc/hosts..."

sudo tee -a /etc/hosts << EOF

# HyperAgency Local Services
127.0.0.1 ${DOMAIN}
127.0.0.1 api.${DOMAIN}
127.0.0.1 bridge.${DOMAIN}
127.0.0.1 x.${DOMAIN}
127.0.0.1 g.${DOMAIN}
127.0.0.1 f.${DOMAIN}
127.0.0.1 vault.${DOMAIN}
127.0.0.1 langflow.${DOMAIN}
127.0.0.1 nodered.${DOMAIN}

EOF

echo "Done"
