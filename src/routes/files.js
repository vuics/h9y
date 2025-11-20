import express, { Router } from 'express';
import { inspect } from 'util'
import fs, { readFileSync } from 'fs'
import path from "path"
import jwt from "jsonwebtoken"

import User from '../models/user.js'
import File from '../models/file.js'
import { sleep } from '../utils/helper.js'
import { checkAuth } from '../middleware/check-auth.js';
import { Verbose, log, warn, error } from '../services.js';
import conf from '../conf.js'

const verbose = Verbose('sd:routes/files'); verbose('');
const router = Router();

// NOTE:  The /v1/files is excluded from global express middleware in ../index.js

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


    try {
      const xmppUser = payload.sub.split('@')[0]
      // verbose('xmppUser:', xmppUser)
      const user = await User.findOne({ "xmpp.user": xmppUser })
      // verbose('By sub:', payload.sub, 'found user:', user)

      const file = new File({
        userId: user._id,
        slot: payload.slot,
        contentType: req.headers['content-type'],
        filename: payload.filename,
        filesize: payload.filesize,
        exp: payload.exp,
        path: '/',
      })
      await file.save()
    } catch (err) {
      error('Error saving file document to database:', err)
    }
  } catch (err) {
    error('Error uploading file:', err);
    res.status(400).send("Invalid token or upload failed");
  }
});

// FIXME: Getting files is not secure
//        This is because we use Prosody XMPP file uploading mechanism
//
// ---- GET DOWNLOAD HANDLER ----
router.get("/:slot/:filename", (req, res) => {
  const filePath = path.join(conf.files.storageDir, req.params.slot, req.params.filename);
  verbose('Accessing file filePath:', filePath)

  if (!fs.existsSync(filePath)) {
    error('Not found')
    return res.status(404).send("Not found");
  }

  res.sendFile(filePath);
});

function getToken(req) {
  const header = req.headers["authorization"];
  if (!header) throw new Error("Missing authorization");
  if (!header.startsWith("Bearer ")) throw new Error("Invalid header");
  return header.substring("Bearer ".length);
}

export async function deleteFile({ fileId }) {
  const file = await File.findById(fileId)
  if (!file) {
    throw new Error('File document not found')
  }
  const slot = file.slot;
  const filename = file.filename;
  log('Deleting file:', filename, 'from slot:', slot, ', fileId:', fileId)

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
    log('File deleted:', filePath)
  } catch (err) {
    if (err.code === 'ENOENT') {
      return "Not found"
    }
    console.error("Delete error:", err);
    throw new Error(`Delete Error: ${err.toString()}`);
  }
}

export default router;
