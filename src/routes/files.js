import express, { Router } from 'express';
import { inspect } from 'util'
import fs, { readFileSync } from 'fs'
import path from "path"
import jwt from "jsonwebtoken"

import File from '../models/file.js'
import { sleep } from '../utils/helper.js'
import { checkAuth } from '../middleware/check-auth.js';
import { Verbose, log, warn, error } from '../services.js';
import conf from '../conf.js'

const verbose = Verbose('sd:routes/files'); verbose('');
const router = Router();

// FIXME: Use?
//
// Raw body for PUT uploads
router.use("/", express.raw({ type: "*/*", limit: "500mb" }));

// ---- PUT UPLOAD HANDLER ----
router.put("/:slot/:filename", async (req, res) => {
  try {
    const token = getToken(req);
    const payload = jwt.verify(token, conf.files.uploadSecret);
    log('token:', token)
    log('payload:', payload)
    log('Upload file to fs> filename:', )

    // Validate slot + filename
    if (payload.slot !== req.params.slot) {
      error('Slot mistmatch')
      return res.status(400).send("Slot mismatch");
    }

    if (payload.filename !== req.params.filename) {
      error('Filename mistmatch:', payload.filename, 'vs', req.params.filename)
      return res.status(400).send("Filename mismatch");
    }

    // if (payload.filesize !== req.body.length) {
    //   error("Filesize mismatch:", payload.filesize, 'vs', req.params.filesize)
    //   return res.status(400).send("Filesize mismatch");
    // }

    if (Date.now() / 1000 > payload.exp) {
      error("Token expired");
      return res.status(403).send("Token expired");
    }

    // Write file
    const dir = path.join(conf.files.storageDir, payload.slot);
    // mkdirp.sync(dir);
    await fs.promises.mkdir(dir, { recursive: true });

    const fullPath = path.join(dir, payload.filename);
    fs.writeFileSync(fullPath, req.body);

    log("Uploaded:", fullPath);
    res.status(201).send("Uploaded");

    // NOTE: It was made for compatibility with standard XMPP clients
    //       like Converse.js and other that use XMPP features to transfer
    //       files. Nevertheless, we store metadata in Mongo to allow
    //       users to manage their files.
    //       So when we upload file, we add the doc with metadata to Mongo
    //
    let file = await File.findOne({ slot: payload.slot })
    if (!file) {
      for (let i = 0; i < 10; i++) {
        verbose('sleep 3 sec...')
        await sleep(3_000)
        verbose('look for file')
        file = await File.findOne({ slot: payload.slot })
        if (file) { break }
      }
    }
    if (!file) {
      return error('Error: cannot find the file slot in database')
    }
    file.filename = payload.filename
    file.filesize = payload.filesize
    file.exp = payload.exp
    file.path = '/'
    file.uploaded = true
    await file.save()

  } catch (err) {
    error('Error uploading file:', err);
    res.status(400).send("Invalid token or upload failed");
  }
});

// ---- GET DOWNLOAD HANDLER ----
router.get("/:slot/:filename", (req, res) => {
  const filePath = path.join(conf.files.storageDir, req.params.slot, req.params.filename);

  if (!fs.existsSync(filePath)) {
    error('Not found')
    return res.status(404).send("Not found");
  }

  res.sendFile(filePath);
});

// TODO: check auth?
//
// ---- ASYNC DELETE HANDLER ----
router.delete("/:slot/:filename", async (req, res) => {
  const slot = req.params.slot;
  const filename = req.params.filename;

  const filePath = path.join(conf.files.storageDir, slot, filename);
  const slotDir = path.join(conf.files.storageDir, slot);

  try {
    // Check if file exists
    await fs.promises.access(filePath);

    // Delete the file
    await fs.promises.unlink(filePath);

    // Optionally remove the slot directory if empty
    const filesInSlot = await fs.promises.readdir(slotDir);
    if (filesInSlot.length === 0) {
      await fs.promises.rmdir(slotDir);
    }

    res.sendStatus(204); // No Content
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).send("Not found");
    }
    console.error("Delete error:", err);
    res.status(500).send("Internal Server Error");
  }
});

function getToken(req) {
  const header = req.headers["authorization"];
  if (!header) throw new Error("Missing authorization");
  if (!header.startsWith("Bearer ")) throw new Error("Invalid header");
  return header.substring("Bearer ".length);
}


export default router;
