FROM debian:bookworm-slim

MAINTAINER Artem Arakcheev <artarakcheev@gmail.com>

ARG PROSODY_PACKAGE=prosody-0.12
ARG LUA_PACKAGE=lua5.4
ARG BUILD_ID=

# Install dependencies
RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        extrepo tini \
    && extrepo enable prosody \
    && apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        ${PROSODY_PACKAGE} \
        ${LUA_PACKAGE} \
        lua-unbound \
        lua-sec \
        lua-readline \
        lua-dbi-sqlite3 \
        lua-dbi-postgresql \
        lua-dbi-mysql \
        luarocks \
        lib${LUA_PACKAGE}-dev \
    && update-alternatives --set lua-interpreter /usr/bin/${LUA_PACKAGE} \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /etc/prosody/conf.d /var/run/prosody \
 && chown prosody:prosody /etc/prosody/conf.d /var/run/prosody

COPY ./entrypoint.sh /entrypoint.sh
RUN chmod 755 /entrypoint.sh
ENTRYPOINT ["/usr/bin/tini", "--", "/entrypoint.sh"]

RUN prosodyctl install --server=https://modules.prosody.im/rocks/ mod_conversejs
RUN prosodyctl install --server=https://modules.prosody.im/rocks/ mod_auth_any

COPY prosody.cfg.lua /etc/prosody/

RUN prosodyctl register alice localhost 123
RUN prosodyctl register bob localhost 123
RUN prosodyctl register art localhost 123

RUN prosodyctl register alice selfdev-prosody.dev.local 123
RUN prosodyctl register bob selfdev-prosody.dev.local 123
RUN prosodyctl register art selfdev-prosody.dev.local 123

EXPOSE 80 443 5222 5269 5347 5280 5281
ENV __FLUSH_LOG yes
CMD ["prosody", "-F"]

