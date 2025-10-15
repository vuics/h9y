import { randomUUID, createHash } from 'crypto';
import { nanoid } from 'nanoid'
import mustache from 'mustache';
import slugify from 'slugify';
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
import { extractAndParseJson } from '../utils/helper.js'

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
  }

  async stop () {
    super.stop()
    verbose('TransformV1 stopped')
  }

  async chat({ prompt, replyFunc=()=>{}} = {}) {
    try {

      verbose(`prompt: ${prompt}`);
      // verbose(`this.agent.options: ${JSON.stringify(this.agent.options)}`);
      const { transform } = this.agent.options;
      verbose('transform:', transform)

      switch (transform.type) {
        case 'echo':
          return prompt;

        case 'const':
          return transform.const;

        case 'repeat':
          return prompt.repeat(transform.repeat ?? 2);

        case 'regexp':
          // return prompt.replace(new RegExp(transform.regexp.pattern, 'g'), transform.regexp.replace);
          const match = transform.regexp.match(/^s(.)(.*?)\1(.*?)\1([gimsuy]*)$/);
          if (!match) return "Error: Invalid sed regexp format"
          const [, , pattern, replacement, flags] = match;
          return prompt.replace(new RegExp(pattern, flags), replacement);

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

        case 'template':
          // use Mustache templating
          let obj = {}
          try { obj = JSON.parse(prompt.trim()); } catch (err) { obj = {}  }
          return mustache.render(transform.template ?? '', obj);

        case 'slugify':
          return slugify(prompt, { lower: transform.slugify ?? true });

        default:
          return prompt;
      }

      verbose('TransformV1 output:', output)
      return ' '
    } catch (err) {
      error('Error chatting TransformV1:', err)
    }
  }
}

