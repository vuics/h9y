import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { defineConfig, loadEnv, } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import svgr from '@svgr/rollup'

const arr = (str) => str ? str.split(',') : []

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  console.log('defineConfig mode:', mode)
  const {
    HOST, PORT, HTTPS, SSL_CRT_FILE, SSL_KEY_FILE, ALLOWED_HOSTS,
    BUILD_SOURCEMAP
  } = loadEnv(mode, ".", [
    "HOST", "PORT", "HTTPS", "SSL_CRT_FILE", "SSL_KEY_FILE", "ALLOWED_HOSTS",
    "BUILD_SOURCEMAP"
  ]);
  const https = HTTPS === "true";
  const port = parseInt(PORT || "3690", 10)

  return {
    base: '/',
    resolve: {
      alias: {
        '@': resolve('./src'),
      },
    },
    plugins: [
      react(),
      tailwindcss(),
      svgr(),
    ],
    build: {
      sourcemap: BUILD_SOURCEMAP === "true",
    },
    server: {
      host: HOST || "0.0.0.0",
      port,
      open: false,
      ...(https && SSL_CRT_FILE && SSL_KEY_FILE && {
        https: {
          cert: readFileSync(resolve(SSL_CRT_FILE)),
          key: readFileSync(resolve(SSL_KEY_FILE)),
        },
      }),
      allowedHosts: arr(ALLOWED_HOSTS),
    },
  }
});
