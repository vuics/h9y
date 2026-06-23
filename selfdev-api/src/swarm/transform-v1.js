import { randomUUID, createHash } from 'crypto';
import { nanoid } from 'nanoid'
import mustache from 'mustache';
import slugify from 'slugify';
import jp from 'jsonpath'
import stringify from 'json-stringify-pretty-compact';
import lodash from 'lodash'
const { cloneDeep, camelCase } = lodash

import { log, warn, error, Verbose } from '../services.js'
import Map from '../models/map.js'
import User from '../models/user.js'
import Agent from '../models/agent.js'
import XmppAgent from './xmpp-agent.js'
import { XmppClient } from '../maptor.js'
import '../mongo.js'
import { deriveMap, executeMap } from '../routes/executor.js'
import conf from '../conf.js'
import { processJsonPath, processJsonDot } from '../utils/helper.js'

const verbose = Verbose('sd:swarm/transform-v1'); verbose('')

export default class TransformV1 extends XmppAgent {
  constructor (args) {
    super(args)
    // const { agent } = args
    verbose('TransformV1 constructed')
  }

  async start () {
    super.start()
    verbose('TransformV1 started')
    this.slog('debug', 'Agent started')
  }

  async stop () {
    super.stop()
    verbose('TransformV1 stopped')
    this.slog('debug', 'Agent stopped')
  }


  transformer({ transform, prompt }) {
    switch (transform.type) {
      case 'echo':
        return prompt;

      case 'const':
        return transform.const;

      case 'repeat':
        return prompt.repeat(transform.repeat ?? 2);

      case 'regexp': {
        const match = transform.regexp.match(/^s(.)(.*?)\1(.*?)\1([gimsuy]*)$/);
        if (!match) return "Error: Invalid sed regexp format";
        const [, , pattern, replacement, flags] = match;
        // Remove unsupported flags (like 'c')
        const cleanFlags = flags.replace(/[^gimsuy]/g, '');
        return prompt.replace(new RegExp(pattern, cleanFlags), replacement);
      }

      case 'uuid':
        return randomUUID();

      case 'nanoid':
        return nanoid(transform.nanoid)

      case 'case':
        switch(transform.case) {
          case 'camel': return camelCase(prompt);
          case 'upper': return prompt.toUpperCase();
          case 'lower': return prompt.toLowerCase();
          case 'snake': return prompt.replace(/\s+/g, '_').toLowerCase();
          case 'kebab': return prompt.replace(/\s+/g, '-').toLowerCase();
          default: return prompt;
        }

      case 'hash':
        return createHash(transform.hash).update(prompt).digest('hex');

      case 'trim':
        return prompt.trim();

      case 'truncate':
        const length = transform.truncate ?? 10;
        return prompt.length > length ? prompt.slice(0, length) : prompt;

      case 'prefix':
        return (transform.prefix ?? '') + prompt;

      case 'suffix':
        return prompt + (transform.suffix ?? '');

      case 'template': {
        // use Mustache templating
        let obj = {};
        try { obj = JSON.parse(prompt.trim()); } catch (err) { obj = {}  }
        return mustache.render(transform.template ?? '', obj);
      }

      case 'slugify':
        return slugify(prompt, { lower: transform.slugify ?? true });

      case 'jsondot': {
        try {
          const cmd = JSON.parse(prompt.trim());
          return stringify(processJsonDot(cmd))
        } catch (err) {
          throw new Error(`Error parsing jsondot command: ${err}`)
        }
      }

      case 'jsonpath': {
        try {
          const cmd = JSON.parse(prompt.trim());
          return stringify(processJsonPath(cmd))
        } catch (err) {
          throw new Error(`Error parsing jsonpath command: ${err}`)
        }
      }

      case 'batch': {
        try {
          const cmd = JSON.parse(prompt);
          const { batch } = cmd
          let { data } = cmd
          for (const step of batch) {
            data = this.transformer({ transform: step, prompt: data });
          }
          return data;
        } catch (err) {
          throw new Error(`Error processing batch: ${err}`);
        }
      }

      default:
        return prompt;
    }
  }

  async chat({ prompt, replyFunc=()=>{}} = {}) {
    try {
      verbose(`prompt: ${prompt}`);
      // verbose(`this.agent.options: ${JSON.stringify(this.agent.options)}`);
      const { transform } = this.agent.options;
      verbose('transform:', transform)

      const content = this.transformer({ transform, prompt })
      return content

      verbose('TransformV1 output:', output)
      return ' '
    } catch (err) {
      error('Error chatting TransformV1:', err)
      this.slog('error', 'Error chatting', {
        error: err.toString()
      })
      return err.toString()
    }
  }
}

