import jp from 'jsonpath';
import _ from 'lodash'
import { spawn } from 'node:child_process';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';

import { log, warn, error, Verbose } from '../services.js'

const verbose = Verbose('sd:utils/helper'); verbose('')


export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Parses JSON from a string that may contain extra symbols before or after it.
 * Example: "some text {'key1': 'value1', 'key2': 'value2'} more text"
 */
export function extractAndParseJson(inputString) {
  // Look for content between curly braces (including the braces)
  const jsonPattern = /(\{.*?\})/s; // 's' flag = dot matches newlines
  const match = inputString.match(jsonPattern);

  if (match) {
    let jsonStr = match[1];

    // Convert Python-style single quotes to JSON-compatible double quotes
    jsonStr = jsonStr.replace(/'/g, '"');

    try {
      const parsedJson = JSON.parse(jsonStr);
      return parsedJson;
    } catch (e) {
      throw new Error(`Error parsing JSON: ${e.message}`);
    }
  } else {
    throw new Error('No JSON object found in the string');
  }
}

// --- Dot-path (Lodash) backend ---
// processJsonDot({
//   op: 'set',
//   syntax: 'dot',
//   path: 'a.b.c',
//   value: 42,
//   data: {}
// });
// // → { a: { b: { c: 42 } } }
//
// 🔹 Batch
// processJsonDot({
//   syntax: 'dot',
//   op: 'batch',
//   data: { a: 1 },
//   operations: [
//     { op: 'set', path: 'b.c', value: 2 },
//     { op: 'get', path: 'a' },
//   ]
// });
// // → [true, 1]
export function processJsonDot(cmd) {
  const {
    op,
    path,
    value,
    default: def,
    data,
  } = cmd;

  switch (op) {
    case 'get':
      return _.get(data, path, def);

    case 'set':
      _.set(data, path, value);
      return data

    case 'delete':
      _.unset(data, path);
      return data

    case 'batch':
      cmd.operations.map(o =>
        processJsonDot({ ...o, data })
      );
      return data

    default:
      throw new Error(`Unknown op: ${op}`);
  }
}

// --- JSONPath backend ---
// processJsonPath({
//   op: 'get',
//   path: '$.store.book[?(@.price < 10)].title',
//   data: {
//     store: { book: [{ title: '1984', price: 8 }, { title: 'Dune', price: 15 }] }
//   },
//   multi: true,
// });
// // → ['1984']
export function processJsonPath(cmd) {
  const {
    op,
    path,
    value,
    default: def,
    data,
    multi = true,
  } = cmd;
  verbose('cmd:', cmd)

  switch (op) {
    case 'get': {
      const results = jp.query(data, path);
      if (multi) return results;
      return results.length ? results[0] : def;
    }

    case 'set': {
      const results = jp.paths(data, path);
      if (results.length === 0) {
        // Path doesn’t exist — create or set directly
        jp.value(data, path, value);
      } else {
        // Update all matched paths
        results.forEach(p => jp.value(data, jp.stringify(p), value));
      }
      return data
    }

    case 'delete': {
      // Replace matched values with undefined
      jp.apply(data, path, () => undefined);
      return data
    }

    case 'query': {
      const results = jp.query(data, path);
      return multi ? results : results[0];
    }

    case 'batch': {
      cmd.operations.map(o =>
        processJsonPath({ ...o, data })
      );
      return data
    }

    default:
      throw new Error(`Unknown op: ${op}`);
  }
}

export function joinUrl(base, path) {
  // Ensure base ends with "/"
  const normalized = base.endsWith('/') ? base : base + '/';
  // Remove leading slash from path
  const relative = path.replace(/^\//, '');
  return new URL(relative, normalized).toString();
}

export const execFile = promisify(execFileCb);

export async function run(cmd, args, options = {}) {
  await log(`Running: ${cmd} ${args.join(' ')}`);

  try {
    const { stdout, stderr } = await execFile(cmd, args, {
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
      ...options,
    });

    if (stdout?.trim()) {
      await log(`[${cmd} stdout] ${stdout}`);
    }

    if (stderr?.trim()) {
      await log(`[${cmd} stderr] ${stderr}`);
    }

    return { stdout, stderr };
  } catch (err) {
    if (err.stdout?.trim()) {
      await log(`[${cmd} stdout] ${err.stdout}`);
    }

    if (err.stderr?.trim()) {
      await log(`[${cmd} stderr] ${err.stderr}`);
    }

    await log(`Command failed: ${err.message}`);
    throw err;
  }
}

export function spawnLogged(cmd, args, options = {}) {
  const child = spawn(cmd, args, {
    ...options,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (data) => {
    log(`[${cmd} stdout] ${data.toString()}`);
  });

  child.stderr.on('data', (data) => {
    log(`[${cmd} stderr] ${data.toString()}`);
  });

  child.on('exit', (code, signal) => {
    log(`[${cmd}] exited code=${code} signal=${signal}`);
  });

  child.on('error', (err) => {
    log(`[${cmd}] error: ${err.stack || err.message}`);
  });

  return child;
}
