import express from "express"
import fs, { readFileSync } from 'fs'
import path from "path"
import jwt from "jsonwebtoken"
import https from 'https'
import http from 'http'
import cors from 'cors'
import { inspect } from 'util'

import { log, warn, error, Verbose } from '../services.js'
import conf, { revealConf } from '../conf.js'

const verbose = Verbose('sd:files/index'); verbose('')
log('public conf:', inspect(revealConf(), { colors: true, depth: null }))

const app = express();

if (conf.cors.enabled) {
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || conf.cors.whitelist.includes(origin)) {
        return callback(null, true)
      }
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
  }))
}

// Raw body for PUT uploads
app.use("/upload", express.raw({ type: "*/*", limit: "500mb" }));

// ---- PUT UPLOAD HANDLER ----
app.put("/upload/:slot/:filename", async (req, res) => {
  try {
    log('put upload')
    const token = getToken(req);
    const payload = jwt.verify(token, conf.files.uploadSecret);
    log('token:', token)
    log('payload:', payload)

    // Validate slot + filename
    if (payload.slot !== req.params.slot)
      return res.status(400).send("Slot mismatch");

    if (payload.filename !== req.params.filename)
      return res.status(400).send("Filename mismatch");

    if (payload.filesize !== req.body.length)
      return res.status(400).send("Filesize mismatch");

    if (Date.now() / 1000 > payload.exp)
      return res.status(403).send("Token expired");

    // Write file
    const dir = path.join(conf.files.storageDir, payload.slot);
    // mkdirp.sync(dir);
    await fs.promises.mkdir(dir, { recursive: true });

    const fullPath = path.join(dir, payload.filename);
    fs.writeFileSync(fullPath, req.body);

    log("Uploaded:", fullPath);

    res.status(201).send("Uploaded");
  } catch (e) {
    error(e);
    res.status(400).send("Invalid token or upload failed");
  }
});

// ---- GET DOWNLOAD HANDLER ----
app.get("/upload/:slot/:filename", (req, res) => {
  const filePath = path.join(conf.files.storageDir, req.params.slot, req.params.filename);

  if (!fs.existsSync(filePath)) return res.status(404).send("Not found");

  res.sendFile(filePath);
});

app.get("/", (req, res) => {
  res.send('Selfdev-Files Server');
});

function getToken(req) {
  const header = req.headers["authorization"];
  if (!header) throw new Error("Missing authorization");
  if (!header.startsWith("Bearer ")) throw new Error("Invalid header");
  return header.substring("Bearer ".length);
}

let server
if (conf.files.secure) {
  server = https.createServer({
    key: readFileSync(conf.ssl.keyFile),
    cert: readFileSync(conf.ssl.certFile)
  }, app)
} else {
  server = http.createServer(app)
}

server.listen(conf.files.port, () =>
  log(`Upload service running on http${conf.files.secure ? 's' : ''}://0.0.0.0:${conf.files.port}`)
);
