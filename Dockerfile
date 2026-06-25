# ============================================================
# BUILD STAGE: API
# ============================================================

FROM node:26.3.0-bookworm-slim AS api-builder

ARG COMPOSE_PROFILES=standalone
ENV COMPOSE_PROFILES=$COMPOSE_PROFILES

WORKDIR /build/api

COPY selfdev-api/package*.json ./
RUN npm ci

COPY selfdev-api/ .
RUN npm prune --omit=dev \
 && npm cache clean --force


# ============================================================
# BUILD STAGE: APP
# ============================================================

FROM node:26.3.0-bookworm-slim AS app-builder

ARG COMPOSE_PROFILES=standalone
ENV VITE_COMPOSE_PROFILES=$COMPOSE_PROFILES

WORKDIR /build/app

COPY selfdev-app/package*.json ./
# RUN npm ci
RUN npm i   # FIXME: use: `npm ci` to minimize image size

COPY selfdev-app/ .
RUN npm run build

# FIXME: uncomment to minimize image size:
# # Keep only runtime deps if serve requires them
# RUN npm prune --omit=dev \
#  && npm cache clean --force

# ============================================================
# BUILD STAGE: PYTHON (CLEAN SELFDEV-AGENCY)
# ============================================================

# FROM python:3.11-slim-bookworm AS python-builder

# WORKDIR /build/python

# ENV PYTHONUNBUFFERED=1 \
#     PYTHONDONTWRITEBYTECODE=1

# # Minimal build deps only (NO chromium, libreoffice, rust, etc.)
# RUN apt-get update && \
#     apt-get install -y --no-install-recommends \
#         gcc \
#         g++ \
#         make \
#         curl \
#         ca-certificates \
#         libmagic1 \
#         libzmq3-dev \
#     && rm -rf /var/lib/apt/lists/*

# # Upgrade pip tooling only
# RUN pip install --no-cache-dir --upgrade pip setuptools wheel

# # Install python deps first (cached layer)
# COPY selfdev-agency/requirements.txt ./
# RUN pip install --no-cache-dir -r requirements.txt

# # Install package itself (your setup.py project)
# COPY selfdev-agency/setup.py ./
# COPY selfdev-agency/src ./src
# COPY selfdev-agency/input ./input
# COPY selfdev-agency/README.md ./

# RUN pip install --no-cache-dir .








# FROM python:3.11-slim-bookworm AS python-builder

# WORKDIR /build/python

# RUN python -m venv /opt/venv

# ENV PATH="/opt/venv/bin:$PATH"

# COPY selfdev-agency/requirements.txt .
# RUN pip install --no-cache-dir -r requirements.txt

# COPY selfdev-agency/ .
# RUN pip install --no-cache-dir .



# ============================================================
# FINAL IMAGE
# ============================================================

FROM node:26.3.0-bookworm-slim

LABEL maintainer="Artem Arakcheev <artarakcheev@gmail.com>"

ARG TARGETARCH
ENV S6_OVERLAY_VERSION=v3.2.0.0
ENV S6_KEEP_ENV=1
ENV __FLUSH_LOG=yes

ARG COMPOSE_PROFILES=standalone
ENV COMPOSE_PROFILES=$COMPOSE_PROFILES
ENV VITE_COMPOSE_PROFILES=$COMPOSE_PROFILES

# ------------------------------------------------------------
# Base packages
# ------------------------------------------------------------

RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget tar jq xz-utils \
        ca-certificates gnupg gpg \
        lsb-release extrepo \
        tini unzip \
        lua5.4 lua-unbound lua-sec lua-readline \
        lua-dbi-sqlite3 lua-dbi-postgresql lua-dbi-mysql \
        luarocks liblua5.4-dev \
        redis libcap2-bin \
        python3 python3-pip python3-venv python3-dev \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /var/cache/apt/*

# ------------------------------------------------------------
# S6 Overlay
# ------------------------------------------------------------

RUN set -eux; \
    case "$TARGETARCH" in \
        amd64) S6_ARCH="x86_64" ;; \
        arm64) S6_ARCH="aarch64" ;; \
        *) echo "Unsupported arch: $TARGETARCH"; exit 1 ;; \
    esac; \
    curl -fsSL -o /tmp/s6-overlay-noarch.tar.xz \
      https://github.com/just-containers/s6-overlay/releases/download/${S6_OVERLAY_VERSION}/s6-overlay-noarch.tar.xz; \
    curl -fsSL -o /tmp/s6-overlay-arch.tar.xz \
      https://github.com/just-containers/s6-overlay/releases/download/${S6_OVERLAY_VERSION}/s6-overlay-${S6_ARCH}.tar.xz; \
    tar -C / -Jxpf /tmp/s6-overlay-noarch.tar.xz; \
    tar -C / -Jxpf /tmp/s6-overlay-arch.tar.xz; \
    rm -f /tmp/s6-overlay-*.tar.xz

# ------------------------------------------------------------
# MongoDB
# ------------------------------------------------------------

WORKDIR /tmp

RUN set -eux; \
    case "$TARGETARCH" in \
        amd64) MONGO_ARCH="amd64" ;; \
        arm64) MONGO_ARCH="arm64" ;; \
        *) echo "Unsupported architecture"; exit 1 ;; \
    esac; \
    wget -q -O mongodb.deb \
      https://repo.mongodb.org/apt/ubuntu/dists/jammy/mongodb-org/8.3/multiverse/binary-${MONGO_ARCH}/mongodb-org-server_8.3.4_${MONGO_ARCH}.deb; \
    dpkg -i mongodb.deb || true; \
    apt-get update; \
    apt-get install -y -f; \
    rm -f mongodb.deb; \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /data/db

RUN mkdir -p /etc/services.d/mongodb && \
    cat <<'EOF' > /etc/services.d/mongodb/run
#!/bin/sh
exec mongod --bind_ip_all --dbpath /data/db --quiet  > /dev/null 2>&1
EOF

RUN chmod +x /etc/services.d/mongodb/run

# ------------------------------------------------------------
# Redis
# ------------------------------------------------------------

RUN mkdir -p /etc/services.d/redis && \
    cat <<'EOF' > /etc/services.d/redis/run
#!/bin/sh
exec redis-server --bind 0.0.0.0 --protected-mode yes
EOF

RUN chmod +x /etc/services.d/redis/run

# ------------------------------------------------------------
# Prosody
# ------------------------------------------------------------

ARG PROSODY_PACKAGE=prosody-0.12

RUN extrepo enable prosody && \
    apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        ${PROSODY_PACKAGE} && \
    update-alternatives --set lua-interpreter /usr/bin/lua5.4 && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /etc/prosody/conf.d /var/run/prosody && \
    chown prosody:prosody /etc/prosody/conf.d /var/run/prosody

WORKDIR /opt/prosody

COPY selfdev-prosody/entrypoint.sh .
COPY selfdev-prosody/commander.sh .
COPY selfdev-prosody/prosody.cfg.lua /etc/prosody/

RUN chmod 755 /opt/prosody/entrypoint.sh

RUN prosodyctl install \
      --server=https://modules.prosody.im/rocks/ \
      mod_conversejs

RUN set -eux; \
    case "$TARGETARCH" in \
        amd64) ARCH="amd64" ;; \
        arm64) ARCH="arm64" ;; \
        *) exit 1 ;; \
    esac; \
    wget -q -O shell2http.tar.gz \
      https://github.com/msoap/shell2http/releases/download/v1.17.0/shell2http_1.17.0_linux_${ARCH}.tar.gz; \
    tar -xzf shell2http.tar.gz -C /usr/local/bin/; \
    rm -f shell2http.tar.gz

RUN mkdir -p /etc/services.d/prosody && \
    cat <<'EOF' > /etc/services.d/prosody/run
#!/bin/bash -e
set -e

/opt/prosody/commander.sh &

data_dir_owner="$(stat -c %u "/var/lib/prosody/")"

if [[ "$(id -u prosody)" != "$data_dir_owner" ]]; then
    usermod -u "$data_dir_owner" prosody
fi

if [[ "$(stat -c %u /var/run/prosody/)" != "$data_dir_owner" ]]; then
    chown "$data_dir_owner" /var/run/prosody/
fi

if [[ "$1" != "prosody" ]]; then
    exec prosodyctl "$@"  > /dev/null 2>&1
fi

if [[ "$LOCAL" && "$PASSWORD" && "$DOMAIN" ]]; then
    prosodyctl register "$LOCAL" "$DOMAIN" "$PASSWORD"
fi

exec runuser -u prosody -- "$@"  > /dev/null 2>&1
EOF

RUN chmod +x /etc/services.d/prosody/run

# ------------------------------------------------------------
# Nodemon
# ------------------------------------------------------------

RUN npm install -g nodemon

# ------------------------------------------------------------
# API
# ------------------------------------------------------------

WORKDIR /opt/api

COPY --from=api-builder /build/api ./

RUN mkdir -p /etc/services.d/api && \
    cat <<'EOF' > /etc/services.d/api/run
#!/bin/sh
cd /opt/api
# exec npm run prod
exec npm start  # FIXME: use `npm run prod` for prod
EOF

RUN chmod +x /etc/services.d/api/run

# ------------------------------------------------------------
# SWARM
# ------------------------------------------------------------

RUN mkdir -p /etc/services.d/swarm && \
    cat <<'EOF' > /etc/services.d/swarm/run
#!/bin/sh
cd /opt/api
# exec npm run swarm:prod
exec npm run swarm  # FIXME: use `npm run swarm:prod` for prod
EOF

RUN chmod +x /etc/services.d/swarm/run

# ------------------------------------------------------------
# BRIDGE
# ------------------------------------------------------------

RUN mkdir -p /etc/services.d/bridge && \
    cat <<'EOF' > /etc/services.d/bridge/run
#!/bin/sh
cd /opt/api
# exec npm run bridge:prod
exec npm run bridge  # FIXME: use `npm run bridge:prod` for prod
EOF

RUN chmod +x /etc/services.d/bridge/run

# ------------------------------------------------------------
# APP
# ------------------------------------------------------------

WORKDIR /opt/app

COPY --from=app-builder /build/app ./

RUN mkdir -p /etc/services.d/app && \
    cat <<'EOF' > /etc/services.d/app/run
#!/bin/sh
export PORT=3990
cd /opt/app
# exec npm run serve
exec sh -c "rm -rf node_modules/.vite && npm start"  # FIXME: use `npm run serve` to minimize image size
EOF

RUN chmod +x /etc/services.d/app/run

# ------------------------------------------------------------
# AGENCY
# ------------------------------------------------------------

WORKDIR /opt/agency

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        git build-essential libmagic1 \
        python3-venv python3-pip \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY selfdev-agency/requirements_standalone.txt ./
RUN pip install --no-cache-dir -r requirements_standalone.txt

COPY selfdev-agency/ .

RUN pip install --no-cache-dir .

RUN mkdir -p /etc/services.d/selfdev && \
    cat <<'EOF' > /etc/services.d/selfdev/run
#!/bin/sh
cd /opt/agency
# exec python src/swarm_standalone.py
exec nodemon --exec python src/swarm_standalone.py
EOF
RUN chmod +x /etc/services.d/selfdev/run




# ------------------------------------------------------------
# Startup
# ------------------------------------------------------------

ENTRYPOINT ["/init"]
