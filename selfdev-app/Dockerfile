# FROM node:18.17.1-slim
# FROM node:22.17.0-bullseye
# FROM node:22.17.0-bullseye-slim
FROM node:24.3.0-bookworm-slim

WORKDIR /opt/app/
COPY package*.json ./
RUN npm install
COPY . .

RUN npm run build

# RUN mkdir -p /opt/ssl/ && openssl req -x509 -newkey rsa:4096 -keyout /opt/ssl/tls.key -out /opt/ssl/tls.crt -days 9999 -nodes -subj "/CN=localhost"
# RUN mkdir -p /opt/ssl/ && openssl req -x509 -newkey rsa:4096 -keyout /opt/ssl/tls.key -out /opt/ssl/tls.crt -days 9999 -nodes -subj "/CN=selfdev-web.dev.local"

EXPOSE 9099
# ARG BUILD_VERSION=0.0.1
# RUN npx json -I -f package.json -e "this.version='$BUILD_VERSION'"
# CMD ["npm", "start"]
CMD ["npm", "run", "serve"]
# CMD ["npm", "run", "serve:ssl"]
