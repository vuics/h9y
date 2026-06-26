# FROM node:18.17.1-slim
FROM node:18.17.1

WORKDIR /opt/app/
COPY package*.json ./
RUN npm install
COPY . .

RUN mkdir -p /var/lib/data/api

# RUN mkdir -p /opt/ssl/ && openssl req -x509 -newkey rsa:4096 -keyout /opt/ssl/tls.key -out /opt/ssl/tls.crt -days 9999 -nodes -subj "/CN=localhost"
# RUN mkdir -p /opt/ssl/ && openssl req -x509 -newkey rsa:4096 -keyout /opt/ssl/tls.key -out /opt/ssl/tls.crt -days 9999 -nodes -subj "/CN=selfdev-api.dev.local"

EXPOSE 6369
# ARG BUILD_VERSION=0.0.1
# RUN npx json -I -f package.json -e "this.version='$BUILD_VERSION'"
# CMD ["npm", "run", "serve"]
CMD ["npm", "start"]

