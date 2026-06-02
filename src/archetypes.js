import { faker } from '@faker-js/faker'
import i18next from 'i18next'

import conf, { hasProfile } from './conf'
import i18n from './i18n'

const t = (key) => i18next.t(`archetypes:${key}`)
const getDocUrl = (path) => `${conf.docs.url}${conf.docs.i18n[i18n.language]}/docs/agent-archetypes/${path}`

const archetypes = {
  'chat-v1.0': {
    key: 'chat-v1.0',
    value: 'chat-v1.0',
    enable: hasProfile(['all', 'h9y', 'try', 'agency']),
    category: 'LLM',
    icon: 'chat',
    text: 'Chat v1.0',
    description: t('chat.description'),
    docUrl: getDocUrl('chat'),
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', title: 'Name', default: faker.internet.username().toLowerCase() },
        description: { type: 'string', title: 'Description', format: 'textarea', default: '' },
        joinRooms: { type: 'array', items: { type: 'string' }, title: 'Join Rooms', default: [], },
        expire: { type: 'string', enum: ['', '1m', '1h', '12h', '1d', '1w', '1mo'], title: 'Expire Deployment', default: '' },
        // expire: { type: 'string', enum: ['1m', '1h', '12h', '1d', '1w', '1mo', ''], title: 'Expire Deployment', default: '1h' },
        chat: {
          type: 'object',
          title: 'Chat Configuration',
          properties: {
            systemMessage: { type: 'string', format: 'textarea', default: '' },
            model: {
              type: 'object',
              title: 'Large Language Model (LLM)',
              properties: {
                provider: { type: 'string', title: 'LLM Provider', default: 'openai' },
                name: { type: 'string', title: 'LLM Name', default: 'gpt-5-nano' },
                apiKey: {
                  type: 'object',
                  title: 'API Key',
                  properties: {
                    valueFromVault: { type: 'string', title: 'Value From Vault Key', default: 'OPENAI_API_KEY' },
                  },
                },
              }
            },
            session: { type: 'string', title: 'Session', default: '' },
          }
        },
      }
    },
  },

  'maptrix-v1.0': {
    key: 'maptrix-v1.0',
    value: 'maptrix-v1.0',
    enable: hasProfile(['all', 'h9y', 'swarm']),
    category: 'System',
    icon: 'sitemap',
    text: 'Maptrix v1.0',
    description: t('maptrix.description'),
    docUrl: getDocUrl('maptrix'),
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', title: 'Name', default: faker.internet.username().toLowerCase() },
        description: { type: 'string', title: 'Description', format: 'textarea', default: '' },
        joinRooms: { type: 'array', items: { type: 'string' }, title: 'Join Rooms', default: [], },
        expire: { type: 'string', enum: ['', '1m', '1h', '12h', '1d', '1w', '1mo'], title: 'Expire Deployment', default: '' },
        maptrix: {
          type: 'object',
          title: 'Maptrix Configuration',
          properties: {
            mapId: { type: 'string', title: 'Map ID' },
            input: {
              type: 'object',
              title: 'Input',
              additionalProperties: true,
              default: {
                // prompt: '',
                // input1: 'hello',
                // input2: 'world',
              },
            },
            output: {
              type: 'array',
              title: 'Output',
              items: { type: 'string' },
              default: [
                'output1',
                'output2',
              ],
            },
            parseJson: { type: 'boolean', title: 'Parse JSON', default: true },
            promptKey: { type: 'string', title: 'Prompt Key', default: 'prompt' },
            sendStatus: { type: 'boolean', title: 'Send Status', default: false },
          },
        },
      }
    },
    uiSchema: {
      maptrix: {
        input: {
          "ui:field": "JsonEditorField"
        }
      }
    },
  },

  'mcp-v1.0': {
    key: 'mcp-v1.0',
    value: 'mcp-v1.0',
    enable: hasProfile(['all', 'h9y', 'swarm']),
    category: 'Protocols',
    icon: 'dot circle outline',
    text: 'MCP Client v1.0',
    description: t('mcp.description'),
    docUrl: getDocUrl('mcp'),
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', title: 'Name', default: faker.internet.username().toLowerCase() },
        description: { type: 'string', title: 'Description', format: 'textarea', default: '' },
        joinRooms: { type: 'array', items: { type: 'string' }, title: 'Join Rooms', default: [] },
        expire: { type: 'string', enum: ['', '1m', '1h', '12h', '1d', '1w', '1mo'], title: 'Expire Deployment', default: '' },
        mcp: {
          type: 'object',
          title: 'Model Context Protocol (MCP)',
          properties: {
            transport: { type: 'string', enum: ['streamable-http', 'sse', 'stdio'], title: 'Transport', default: 'streamable-http-then-sse' },
            url: { type: 'string', title: 'URL', default: 'http://localhost:6370/mcp/679b3c9a6e26f022ca69515b/mcp-server' },
            command: { type: 'string', title: 'Command', default: 'node' },
            args: { type: 'array', items: { type: 'string' }, title: 'Arguments', default: ['server.js'] },
          },
        },
      },
    },
  },

  'a2a-v1.0': {
    key: 'a2a-v1.0',
    value: 'a2a-v1.0',
    enable: hasProfile(['all', 'h9y', 'swarm']),
    category: 'Protocols',
    icon: 'chess pawn',
    text: 'A2A Client v1.0',
    description: t('a2a.description'),
    docUrl: getDocUrl('a2a'),
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', title: 'Name', default: faker.internet.username().toLowerCase() },
        description: { type: 'string', title: 'Description', format: 'textarea', default: '' },
        joinRooms: { type: 'array', items: { type: 'string' }, title: 'Join Rooms', default: [] },
        expire: { type: 'string', enum: ['', '1m', '1h', '12h', '1d', '1w', '1mo'], title: 'Expire Deployment', default: '' },
        a2a: {
          type: 'object',
          title: 'Agent2Agent (A2A) Protocol',
          properties: {
            url: { type: 'string', title: 'URL', default: 'http://localhost:6370/a2a/679b3c9a6e26f022ca69515b/server' },
            textOnly: { type: 'boolean', title: 'Send text only (else, A2A JSON message)', default: false },
          },
        },
      },
    },
  },

  'system-v1.0': {
    key: 'system-v1.0',
    value: 'system-v1.0',
    enable: hasProfile(['all', 'h9y', 'swarm']),
    category: 'System',
    icon: 'cog',
    text: 'System v1.0',
    description: t('system.description'),
    docUrl: getDocUrl('system'),
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', title: 'Name', default: faker.internet.username().toLowerCase() },
        description: { type: 'string', title: 'Description', format: 'textarea', default: '' },
        joinRooms: { type: 'array', items: { type: 'string' }, title: 'Join Rooms', default: [] },
        expire: { type: 'string', enum: ['', '1m', '1h', '12h', '1d', '1w', '1mo'], title: 'Expire Deployment', default: '' },
        system: {
          type: 'object',
          title: 'System',
          properties: {
            operation: { type: 'string', enum: ['', 'create', 'get', 'transfer', 'collect', 'account'], title: 'Operation', default: '' },
            model: { type: 'string', enum: ['', 'map', 'agent'], title: 'Model', default: '' },
          },
        },
      },
    }
  },

  'transform-v1.0': {
    key: 'transform-v1.0',
    value: 'transform-v1.0',
    enable: hasProfile(['all', 'h9y', 'swarm']),
    category: 'System',
    icon: 'edit',
    text: 'Transform v1.0',
    description: t('transform.description'),
    docUrl: getDocUrl('transform'),
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', title: 'Name', default: faker.internet.username().toLowerCase() },
        description: { type: 'string', title: 'Description', format: 'textarea', default: '' },
        joinRooms: { type: 'array', items: { type: 'string' }, title: 'Join Rooms', default: [] },
        expire: { type: 'string', enum: ['', '1m', '1h', '12h', '1d', '1w', '1mo'], title: 'Expire Deployment', default: '' },
        transform: {
          type: 'object',
          title: 'Transform',
          properties: {
            type: {
              type: 'string',
              enum: [
                'echo',       // Returns the original input string unchanged.
                'const',      // Always returns the string provided in `const`.
                'repeat',     // Repeats the input string `repeat` times.
                'regexp',     // Applies a sed/vim-style regex transformation (s/pattern/replacement/flags).
                'uuid',       // Generates a UUID v4 string; no parameters.
                'nanoid',     // Generates a NanoID string of length specified in `nanoid`.
                'case',       // Changes letter casing of input; options: 'upper','lower','camel','snake','kebab'.
                'hash',       // Returns a hash of input using algorithm specified in `hash` ('md5','sha256','sha512').
                'trim',       // Removes leading and trailing whitespace from input string.
                'truncate',   // Truncates input to a maximum length specified in `truncate`.
                'prefix',     // Adds the string specified in `prefix` to the beginning of input.
                'suffix',     // Adds the string specified in `suffix` to the end of input.
                'template',   // Uses Mustache templating to render input with variables from JSON-parsed input string.
                'slugify',    // Converts input into a URL-friendly slug; lowercase if `slugify` is true.
                'jsondot',    // Handles simple dot-path operations using Lodash. Accepts a JSON command object:
                              // {
                              //   "op": "get" | "set" | "delete" | "batch",            // operation type
                              //   "path": "store.book.title",                          // Lodash-style dot notation path
                              //   "value": 99,                                         // value to set (only for "set")
                              //   "default": null,                                     // default value if path does not exist (only for "get")
                              //   "data": {},                                          // target JSON object
                              // }
                'jsonpath',   // Handles advanced JSONPath operations with full support for arrays, wildcards, filters, etc.
                              // Accepts a JSON command object:
                              // {
                              //   "op": "get" | "set" | "delete" | "query" | "batch", // operation type
                              //   "path": "$.store.book[?(@.price < 10)].title",      // JSONPath expression
                              //   "value": 99,                                        // value to set (only for 'set')
                              //   "default": null,                                    // default value if path does not exist (only for 'get')
                              //   "multi": true,                                      // if true (default), return all matches as an array (for 'get'/'query'), if false returns only the [0] value
                              //   "data": {},                                         // target JSON object
                              // }
                'batch',      // Handles batch transformations:
                              // {
                              //   "type": "batch",
                              //   "batch": [
                              //     { "type": "echo" },
                              //     { "type": "suffix", "suffix": " " },
                              //     { "type": "repeat", "repeat": 2 },
                              //     { "type": "case", "case": "upper" },
                              //     { "type": "truncate", "truncate": 19 },
                              //     { "type": "prefix", "prefix": "   pre-" },
                              //     { "type": "suffix", "suffix": "-post    " },
                              //     { "type": "trim" }
                              //   ],
                              //   "data": "[[demo-data]]"
                              // }
              ],
              title: 'Type',
              default: 'echo',
            },

            // echo -- no params
            const: { type: 'string', title: 'Const', default: 'constant-text' },
            repeat: { type: 'number', title: 'Repeat', default: 3 },
            regexp: { type: 'string', title: 'Regexp', default: 's/original/replacement/g' },
            // uuid -- no params
            nanoid: { type: 'number', title: 'Nanoid', default: 9 },
            case: { type: 'string', enum: ['upper','lower','camel','snake','kebab'], title: 'Case', default: 'upper' },
            hash: { type: 'string', enum: ['md5','sha256','sha512'], title: 'Hash', default: 'md5' },
            // trim -- no params
            truncate: { type: 'number', title: 'Truncate', default: 30 },
            prefix: { type: 'string', title: 'Prefix', default: 'prefix-' },
            suffix: { type: 'string', title: 'Suffix', default: '-suffix' },
            template: { type: 'string', title: 'Template', default: 'Hello, {{name}}!' },
            slugify: { type: 'boolean', title: 'Slugify', default: true }, // if true, lowercase slug
            // jsondot -- no params
            // jsonpath -- no params
            // batch -- no params
          },
        },
      },
    },
  },

  'proxy-v1.0': {
    key: 'proxy-v1.0',
    value: 'proxy-v1.0',
    enable: hasProfile(['all', 'h9y', 'swarm']),
    category: 'System',
    icon: 'exchange',
    text: 'Proxy v1.0',
    description: t('proxy.description'),
    docUrl: getDocUrl('proxy'),
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', title: 'Name', default: faker.internet.username().toLowerCase() },
        description: { type: 'string', title: 'Description', format: 'textarea', default: '' },
        joinRooms: { type: 'array', items: { type: 'string' }, title: 'Join Rooms', default: [] },
        expire: { type: 'string', enum: ['', '1m', '1h', '12h', '1d', '1w', '1mo'], title: 'Expire Deployment', default: '' },
        proxy: {
          type: 'object',
          title: 'Proxy',
          properties: {
            controlKey: { type: 'string', title: 'Control Key', default: 'Please, do it! :-)' },
          },
        },
      },
    },
  },

  'rag-v1.0': {
    key: 'rag-v1.0',
    value: 'rag-v1.0',
    enable: hasProfile(['all', 'h9y', 'rag']),
    category: 'LLM',
    icon: 'archive',
    text: 'RAG v1.0',
    description: t('rag.description'),
    docUrl: getDocUrl('rag'),
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', title: 'Name', default: faker.internet.username().toLowerCase(), },
        description: { type: 'string', title: 'Description', format: 'textarea', default: '', },
        joinRooms: { type: 'array', items: { type: 'string' }, title: 'Join Rooms', default: [], },
        expire: { type: 'string', enum: ['', '1m', '1h', '12h', '1d', '1w', '1mo'], title: 'Expire Deployment', default: '' },
        rag: {
          type: 'object',
          title: 'RAG',
          properties: {
            systemMessage: { type: 'string', title: 'System Message', default: `You are an assistant for question-answering tasks. Use the following pieces of retrieved context to answer the question. If you don't know the answer, just say that you don't know. Use three sentences maximum and keep the answer concise.\nQuestion: {question}\nContext: {context}\nAnswer:`, },
            model: {
              type: 'object',
              title: 'Model',
              properties: {
                provider: { type: 'string', title: 'Provider', default: 'openai', },
                name: { type: 'string', title: 'Name', default: 'gpt-4o-mini', },
                apiKey: {
                  type: 'object',
                  title: 'API Key',
                  properties: {
                    valueFromVault: { type: 'string', title: 'Value From Vault', default: 'OPENAI_API_KEY', },
                  },
                },
              },
            },
            embeddings: {
              type: 'object',
              title: 'Embeddings',
              properties: {
                provider: { type: 'string', title: 'Provider', default: 'openai', },
                name: { type: 'string', title: 'Name', default: 'text-embedding-3-large', },
                apiKey: {
                  type: 'object',
                  title: 'API Key',
                  properties: {
                    valueFromVault: { type: 'string', title: 'Value From Vault', default: 'OPENAI_API_KEY', },
                  },
                },
              },
            },
            vectorStore: { type: 'string', title: 'Vector Store', default: 'chroma', },
            commands: {
              type: 'object',
              title: 'Commands',
              properties: {
                get: { type: 'string', title: 'Get', default: '^//GET$', },
                count: { type: 'string', title: 'Count', default: '^//COUNT$', },
                loadText: { type: 'string', title: 'Load Text', default: '^//LOAD_TEXT\\s+([\\s\\S]*)', },
                loadURL: { type: 'string', title: 'Load URL', default: '^//LOAD_URL\\s+([\\s\\S]*)', },
                loadAttachment: { type: 'string', title: 'Load Attachment', default: '^//LOAD_ATTACHMENT$', },
                // loadGDrive: { type: 'string', title: 'Load GDrive', default: "^//LOAD_URL\\s+((https?:\\/\\/[^\\s,]+)(,\\s*https?:\\/\\/[^\\s,]+)*)$", },
                delete: { type: 'string', title: 'Delete', default: '^//DELETE$', },
              },
            },
            loaders: {
              type: 'array',
              title: 'Loaders',
              items: {
                type: 'object',
                properties: {
                  enable: { type: 'boolean', title: 'Enable', default: false, },
                  kind: { type: 'string', enum: ['text', 'directory', 'web', 'google-drive'], title: 'Kind', default: 'text', },

                  // file loader
                  files: { type: 'array', title: 'Files', items: { type: 'string' }, default: [/* "/opt/app/README.md" */], },

                  // directory loader
                  path: { type: 'string', title: 'Path', default: '', },
                  glob: { type: 'string', title: 'Glob', default: '**/*.*', },

                  // web loader
                  urls: { type: 'array', title: 'URLs', items: { type: 'string' }, default: [/* "https://h9y.ai" */], },

                  // google-drive loader
                  folderId: { type: 'string', title: 'Folder ID', default: '', },
                  recursive: { type: 'boolean', title: 'Recursive', default: true, },
                  unstructured: { type: 'boolean', title: 'Unstructured', default: false, },
                  filesIds: { type: 'array', title: 'Files IDs', items: { type: 'string' }, default: [/* "" */], },
                  documentIds: { type: 'array', title: 'Document IDs', items: { type: 'string' }, default: [/* "1pi95Wc03l8poJoIJpRXniILIPNGIbDn9VMBfmZPdgZY", ... */], },
                },
              },
            },
          },
        },
      },
    },
  },

  'stt-v1.0': {
    key: 'stt-v1.0',
    value: 'stt-v1.0',
    enable: hasProfile(['all', 'h9y', 'speech']),
    category: 'Speech',
    icon: 'headphones',
    text: 'Speech-to-Text v1.0',
    description: t('stt.description'),
    docUrl: getDocUrl('stt'),
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', title: 'Name', default: faker.internet.username().toLowerCase(), },
        description: { type: 'string', title: 'Description', format: 'textarea', default: '', },
        joinRooms: { type: 'array', items: { type: 'string' }, title: 'Join Rooms', default: [], },
        expire: { type: 'string', enum: ['', '1m', '1h', '12h', '1d', '1w', '1mo'], title: 'Expire Deployment', default: '' },
        stt: {
          type: 'object',
          title: 'Stt',
          properties: {
            model: {
              type: 'object',
              title: 'Model',
              properties: {
                provider: { type: 'string', title: 'Provider', default: 'openai', },
                name: { type: 'string', title: 'Name', default: 'whisper-1', },
                apiKey: {
                  type: 'object',
                  title: 'Api Key',
                  properties: {
                    valueFromVault: { type: 'string', title: 'Value From Vault', default: 'OPENAI_API_KEY', },
                  },
                },
              },
            },
            language: { type: 'string', title: 'Language', default: 'en', },
          },
        },
      },
    },
  },

  'tts-v1.0': {
    key: 'tts-v1.0',
    value: 'tts-v1.0',
    enable: hasProfile(['all', 'h9y', 'speech']),
    category: 'Speech',
    icon: 'file audio',
    text: 'Text-to-Speech v1.0',
    description: t('tts.description'),
    docUrl: getDocUrl('tts'),
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', title: 'Name', default: faker.internet.username().toLowerCase(), },
        description: { type: 'string', title: 'Description', format: 'textarea', default: '', },
        joinRooms: { type: 'array', items: { type: 'string' }, title: 'Join Rooms', default: [], },
        expire: { type: 'string', enum: ['', '1m', '1h', '12h', '1d', '1w', '1mo'], title: 'Expire Deployment', default: '' },
        tts: {
          type: 'object',
          title: 'TTS',
          properties: {
            model: {
              type: 'object',
              title: 'Model',
              properties: {
                provider: { type: 'string', title: 'Provider', default: 'openai', },
                name: { type: 'string', title: 'Name', default: 'tts-1', },
                voice: { type: 'string', title: 'Voice', default: 'nova', },
                apiKey: {
                  type: 'object',
                  title: 'API Key',
                  properties: {
                    valueFromVault: { type: 'string', title: 'Value From Vault', default: 'OPENAI_API_KEY', },
                  },
                },
                format: { type: 'string', enum: ['mp3', 'flac', 'wav', 'pcm'], title: 'Format', default: 'mp3', },
                speed: { type: 'number', title: 'Speed', default: 1, },
              },
            },
          },
        },
      },
    },
  },

  'imagegen-v1.0': {
    key: 'imagegen-v1.0',
    value: 'imagegen-v1.0',
    enable: hasProfile(['all', 'h9y', 'try', 'agency']),
    category: 'Image',
    icon: 'images',
    text: 'ImageGen v1.0',
    description: t('imagegen.description'),
    docUrl: getDocUrl('imagegen'),
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', title: 'Name', default: faker.internet.username().toLowerCase(), },
        description: { type: 'string', title: 'Description', format: 'textarea', default: '', },
        joinRooms: { type: 'array', items: { type: 'string' }, title: 'Join Rooms', default: [], },
        expire: { type: 'string', enum: ['', '1m', '1h', '12h', '1d', '1w', '1mo'], title: 'Expire Deployment', default: '' },
        imagegen: {
          type: 'object',
          title: 'Imagegen',
          properties: {
            model: {
              type: 'object',
              title: 'Model',
              properties: {
                provider: { type: 'string', title: 'Provider', default: 'openai', },
                name: { type: 'string', title: 'Name', default: 'dall-e-2', }, // "dall-e-2", "dall-e-3", "gpt-image-1"
                apiKey: {
                  type: 'object',
                  title: 'Api Key',
                  properties: {
                    valueFromVault: { type: 'string', title: 'Value From Vault', default: 'OPENAI_API_KEY', },
                  },
                },
              },
            },
            size: { type: 'string', title: 'Size', enum: [ "256x256", "512x512", "1024x1024" ], default: '256x256', },      // "256x256", "512x512", "1024x1024"; DALL·E 3 only supports "1024x1024"
            quality: { type: 'string', title: 'Quality', enum: ['standard', 'hq'], default: 'standard', }, // "standard" (default) or "hd" (for high detail)
            style: { type: 'string', title: 'Style', enum: ['vivid', 'natural'], default: 'natural', },     // "vivid" (default) or "natural" — affects artistic style
            n: { type: 'number', title: 'Number of Images', default: 1, },                     // OpenAI limits you to n=1
          },
        },
      },
    },
  },

  'code-v1.0': {
    key: 'code-v1.0',
    value: 'code-v1.0',
    enable: hasProfile(['all', 'h9y', 'try', 'agency']),
    category: 'Code',
    icon: 'code',
    text: 'Code v1.0',
    description: t('code.description'),
    docUrl: getDocUrl('code'),
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', title: 'Name', default: faker.internet.username().toLowerCase(), },
        description: { type: 'string', title: 'Description', format: 'textarea', default: '', },
        joinRooms: { type: 'array', items: { type: 'string' }, title: 'Join Rooms', default: [], },
        expire: { type: 'string', enum: ['', '1m', '1h', '12h', '1d', '1w', '1mo'], title: 'Expire Deployment', default: '' },
        code: {
          type: 'object',
          title: 'Code',
          properties: {
            kernel: { type: 'string', title: 'Kernel (Programming Language)', enum: ['python3', 'javascript', 'bash'], default: 'python3', },
            env: {
              type: 'object',
              title: 'Environment Variables (key:value)',
              additionalProperties: true,
              default: {
                // 'MY_ENV_VAR': 'my-value',
                // 'MY_SECOND_ENV_VAR': 'some value',
              },
            },
            commands: {
              type: 'object',
              title: 'Commands',
              properties: {
                start: { type: 'string', title: 'Start', default: '^//START$', },
                restart: { type: 'string', title: 'Restart', default: '^//RESTART$', },
                reconnect: { type: 'string', title: 'Reconnect', default: '^//RECONNECT$', },
                shutdown: { type: 'string', title: 'Shutdown', default: '^//SHUTDOWN$', },
              },
            },
          },
        },
      },
    },
    uiSchema: {
      code: {
        env: {
          "ui:field": "JsonEditorField"
        }
      }
    },
  },

  'quantum-v1.0': {
    key: 'quantum-v1.0',
    value: 'quantum-v1.0',
    enable: hasProfile(['all', 'h9y', 'try', 'agency']),
    category: 'Code',
    icon: 'react',
    text: 'Quantum v1.0',
    description: t('quantum.description'),
    docUrl: getDocUrl('quantum'),
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', title: 'Name', default: faker.internet.username().toLowerCase(), },
        description: { type: 'string', title: 'Description', format: 'textarea', default: '', },
        joinRooms: { type: 'array', items: { type: 'string' }, title: 'Join Rooms', default: [], },
        expire: { type: 'string', enum: ['', '1m', '1h', '12h', '1d', '1w', '1mo'], title: 'Expire Deployment', default: '' },
        quantum: {
          type: 'object',
          title: 'Quantum',
          properties: {
            // provider: { type: 'string', title: 'Provider', default: 'ibm', },
            backend: { type: 'string', title: 'Backend', default: 'fake_almaden_v2', }, // least_busy, fake_almaden_v2, ibm_torino, ibm_brisbane, ibm_sherbrooke
            minNumQubits: { type: 'number', title: 'Min Num Qubits', default: 127, }, // only for least_busy backend
            language: { type: 'string', title: 'Language', enum: ['qasm2', 'qasm3'], default: 'qasm2', }, // qasm2, qasm3
            optimizationLevel: { type: 'number', title: 'Optimization Level', default: 1, },
            draw: {
              type: 'object',
              title: 'Draw',
              properties: {
                enable: { type: 'boolean', title: 'Enable', default: true, },
                output: { type: 'string', title: 'Output', default: 'text', }, // text, mpl
                style: { type: 'string', title: 'Style', default: 'str', }, // only for text output
              },
            },
            instance: {
              type: 'object',
              title: 'Instance',
              properties: {
                valueFromVault: { type: 'string', title: 'Value From Vault', default: 'IBM_CLOUD_QISKIT_INSTANCE', },
              },
            },
            apiKey: {
              type: 'object',
              title: 'API Key',
              properties: {
                valueFromVault: { type: 'string', title: 'Value From Vault', default: 'IBM_CLOUD_API_KEY', },
              },
            },
          },
        },
      },
    },
  },

  'storage-v1.0': {
    key: 'storage-v1.0',
    value: 'storage-v1.0',
    enable: hasProfile(['all', 'h9y', 'try', 'agency']),
    category: 'Data',
    icon: 'database',
    text: 'Storage v1.0',
    description: t('storage.description'),
    docUrl: getDocUrl('storage'),
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', title: 'Name', default: faker.internet.username().toLowerCase(), },
        description: { type: 'string', title: 'Description', format: 'textarea', default: '', },
        joinRooms: { type: 'array', items: { type: 'string' }, title: 'Join Rooms', default: [], },
        expire: { type: 'string', enum: ['', '1m', '1h', '12h', '1d', '1w', '1mo'], title: 'Expire Deployment', default: '' },
        storage: {
          type: 'object',
          title: 'Storage',
          properties: {
            driver: { type: 'string', title: 'Driver', default: 'mongodb', },
            namespace: { type: 'string', title: 'Namespace', default: 'default', },
            verbose: { type: 'number', title: 'Verbose', enum: [0, 1, 2], default: 1, },
            commands: {
              type: 'object',
              title: 'Commands',
              properties: {
                list: { type: 'string', title: 'List Command RegExp', default: '^//LIST$', },

                // get: { type: 'string', title: 'Get Command RegExp', default: '^//GET\\s+(?P<key>\\S+)(?:\\s+(?P<default>.+))?$', },
                get: { type: 'string', title: 'Get Command RegExp', default: '^//GET\\s+(?P<key>\\S+)(?:\\s+(?P<default>[\\s\\S]+))?$', },

                // set: { type: 'string', title: 'Set Command RegExp', default: '^//SET\\s+(?P<key>\\S+)\\s+(?P<value>.+)$', },
                set: { type: 'string', title: 'Set Command RegExp', default: '^//SET\\s+(?P<key>\\S+)\\s+(?P<value>[\\s\\S]+)$', },

                // append: { type: 'string', title: 'Append Command RegExp', default: '^//APPEND\\s+(?P<key>\\S+)\\s+(?P<value>.+)$', },
                append: { type: 'string', title: 'Append Command RegExp', default: '^//APPEND\\s+(?P<key>\\S+)\\s+(?P<value>[\\s\\S]+)$', },

                delete: { type: 'string', title: 'Delete Command RegExp', default: '^//DELETE\\s+(?P<key>\\S+)$', },
                load: { type: 'string', title: 'Load from Files Command RegExp', default: '^//LOAD\\s+(?P<key>\\S+)$', },

                // save: { type: 'string', title: 'Save to File Command RegExp', default: '^//SAVE\\s+(?P<key>\\S+)(?:\\s+(?P<filename>\\S+))?(?:\\s+(?P<default>.*))?$', },
                save: { type: 'string', title: 'Save to File Command RegExp', default: '^//SAVE\\s+(?P<key>\\S+)(?:\\s+(?P<filename>\\S+))?(?:\\r?\\n(?P<default>[\\s\\S]+))?\\s*$', },
              },
            },
          },
        },
      },
    },
  },

  'command-v1.0': {
    key: 'command-v1.0',
    value: 'command-v1.0',
    enable: hasProfile(['all', 'h9y', 'try', 'agency']),
    category: 'Code',
    icon: 'terminal',
    text: 'Command v1.0',
    description: t('command.description'),
    docUrl: getDocUrl('command'),
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', title: 'Name', default: faker.internet.username().toLowerCase(), },
        description: { type: 'string', title: 'Description', format: 'textarea', default: '', },
        joinRooms: { type: 'array', items: { type: 'string' }, title: 'Join Rooms', default: [], },
        expire: { type: 'string', enum: ['', '1m', '1h', '12h', '1d', '1w', '1mo'], title: 'Expire Deployment', default: '' },
        command: {
          type: 'object',
          title: 'Command',
          properties: {
            // execute: { type: 'string', title: 'Execute', default: '/bin/sh', },
            execute: { type: 'string', title: 'Execute', default: '', },
            shell: { type: 'boolean', title: 'Run in Shell', default: false, },
          },
        },
      },
    },
  },

  'langflow-v1.0': {
    key: 'langflow-v1.0',
    value: 'langflow-v1.0',
    enable: hasProfile(['all', 'h9y', 'langflow']),
    category: 'Automation',
    icon: 'pallet',
    text: 'Langflow v1.0',
    description: t('langflow.description'),
    docUrl: getDocUrl('langflow'),
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', title: 'Name', default: faker.internet.username().toLowerCase(), },
        description: { type: 'string', title: 'Description', format: 'textarea', default: '', },
        joinRooms: { type: 'array', items: { type: 'string' }, title: 'Join Rooms', default: [], },
        expire: { type: 'string', enum: ['', '1m', '1h', '12h', '1d', '1w', '1mo'], title: 'Expire Deployment', default: '' },
        langflow: {
          type: 'object',
          title: 'Langflow',
          properties: {
            flowId: { type: 'string', title: 'Flow Id', default: '', },
            sessionId: { type: 'string', title: 'Session Id', default: '', },
          },
        },
      },
    },
  },

  'nodered-v1.0': {
    key: 'nodered-v1.0',
    value: 'nodered-v1.0',
    enable: hasProfile(['all', 'h9y', 'nodered']),
    category: 'Automation',
    icon: 'map signs',
    text: 'Node-RED v1.0',
    description: t('nodered.description'),
    docUrl: getDocUrl('nodered'),
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', title: 'Name', default: faker.internet.username().toLowerCase(), },
        description: { type: 'string', title: 'Description', format: 'textarea', default: '', },
        joinRooms: { type: 'array', items: { type: 'string' }, title: 'Join Rooms', default: [], },
        expire: { type: 'string', enum: ['', '1m', '1h', '12h', '1d', '1w', '1mo'], title: 'Expire Deployment', default: '' },
        nodered: {
          type: 'object',
          title: 'Nodered',
          properties: {
            method: { type: 'string', title: 'Method', default: 'POST', },
            route: { type: 'string', title: 'Route', default: '', },
            payload: {
              type: 'object',
              title: 'Payload',
              additionalProperties: true,
              default: {
                // prompt: '',
              },
            },
            parseJson: { type: 'boolean', title: 'Parse Json', default: true, },
            promptKey: { type: 'string', title: 'Prompt Key', default: 'prompt', },
          },
        },
      },
    },
    uiSchema: {
      nodered: {
        payload: {
          "ui:field": "JsonEditorField"
        }
      }
    },
  },

  'n8n-v1.0': {
    key: 'n8n-v1.0',
    value: 'n8n-v1.0',
    enable: hasProfile(['all', 'h9y', 'agency']),
    category: 'Automation',
    icon: 'code branch',
    text: 'N8n (external) v1.0',
    description: t('n8n.description'),
    docUrl: getDocUrl('n8n'),
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', title: 'Name', default: faker.internet.username().toLowerCase(), },
        description: { type: 'string', title: 'Description', format: 'textarea', default: '', },
        joinRooms: { type: 'array', items: { type: 'string' }, title: 'Join Rooms', default: [], },
        expire: { type: 'string', enum: ['', '1m', '1h', '12h', '1d', '1w', '1mo'], title: 'Expire Deployment', default: '' },
        n8n: {
          type: 'object',
          title: 'N8n',
          properties: {
            method: { type: 'string', title: 'Method', default: 'POST', },
            url: { type: 'string', title: 'URL', default: '', },
            payload: {
              type: 'object',
              title: 'Payload',
              additionalProperties: true,
              default: {
                // prompt: '',
              },
            },
            parseJson: { type: 'boolean', title: 'Parse Json', default: true, },
            promptKey: { type: 'string', title: 'Prompt Key', default: 'prompt', },
          },
        },
      },
    },
    uiSchema: {
      n8n: {
        payload: {
          "ui:field": "JsonEditorField"
        }
      }
    },
  },

  'notebook-v1.0': {
    key: 'notebook-v1.0',
    value: 'notebook-v1.0',
    enable: hasProfile(['all', 'h9y', 'try', 'agency']),
    category: 'Code',
    icon: 'file code',
    text: 'Notebook v1.0',
    description: t('notebook.description'),
    docUrl: getDocUrl('notebook'),
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', title: 'Name', default: faker.internet.username().toLowerCase(), },
        description: { type: 'string', title: 'Description', format: 'textarea', default: '', },
        joinRooms: { type: 'array', items: { type: 'string' }, title: 'Join Rooms', default: [], },
        expire: { type: 'string', enum: ['', '1m', '1h', '12h', '1d', '1w', '1mo'], title: 'Expire Deployment', default: '' },
        notebook: {
          type: 'object',
          title: 'Notebook',
          properties: {
            // filePath: { type: 'string', title: 'File Path', default: '/opt/app/input/selfdev-notebooks/papermill.ipynb', },
            filePath: { type: 'string', title: 'File Path', default: '', },
            kernelName: { type: 'string', title: 'Kernel Name', default: 'python3', },
            parameters: {
              type: 'object',
              title: 'Parameters',
              additionalProperties: true,
              default: {
                // who: 'Earth', num: 0.3,
              },
            },
            parseJson: { type: 'boolean', title: 'Parse Json', default: true, },
            promptKey: { type: 'string', title: 'Prompt Key', default: 'prompt', },
          },
        },
      },
    },
    uiSchema: {
      notebook: {
        parameters: {
          "ui:field": "JsonEditorField"
        }
      }
    },
  },

  'avatar-v1.0': {
    key: 'avatar-v1.0',
    value: 'avatar-v1.0',
    enable: hasProfile(['all', 'h9y', 'avatar']),
    category: 'Video',
    icon: 'smile outline',
    text: 'Avatar (LipSync) v1.0',
    description: t('avatar.description'),
    docUrl: getDocUrl('avatar'),
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', title: 'Name', default: faker.internet.username().toLowerCase(), },
        description: { type: 'string', title: 'Description', format: 'textarea', default: '', },
        joinRooms: { type: 'array', items: { type: 'string' }, title: 'Join Rooms', default: [], },
        expire: { type: 'string', enum: ['', '1m', '1h', '12h', '1d', '1w', '1mo'], title: 'Expire Deployment', default: '' },
        avatar: {
          type: 'object',
          title: 'Avatar',
          properties: {
            model: {
              type: 'object',
              title: 'Model',
              properties: {
                provider: { type: 'string', title: 'Provider', enum: ['sadtalker'], default: 'sadtalker', },
                // name: { type: 'string', title: 'Name', default: '', },
                // apiKey: {
                //   type: 'object',
                //   title: 'Api Key',
                //   properties: {
                //     valueFromVault: { type: 'string', title: 'Value From Vault', default: 'API_KEY', },
                //   },
                // },
              },
            },
          },
        },
      },
    },
  },

  'curl-v1.0': {
    key: 'curl-v1.0',
    value: 'curl-v1.0',
    enable: hasProfile(['all', 'h9y', 'swarm']),
    category: 'Protocols',
    icon: 'external',
    text: 'Curl (HTTPs) v1.0',
    description: t('curl.description'),
    docUrl: getDocUrl('curl'),
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', title: 'Name', default: faker.internet.username().toLowerCase(), },
        description: { type: 'string', title: 'Description', format: 'textarea', default: '', },
        joinRooms: { type: 'array', items: { type: 'string' }, title: 'Join Rooms', default: [], },
        expire: { type: 'string', enum: ['', '1m', '1h', '12h', '1d', '1w', '1mo'], title: 'Expire Deployment', default: '' },
        curl: {
          type: 'object',
          title: 'Curl',
          properties: {
            method: { type: 'string', title: 'Method', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'], default: 'GET', },
            url: { type: 'string', title: 'URL', default: 'http://localhost:80', },
            headers: { type: 'string', title: 'Headers in Stringified JSON format', default: '', },
            timeoutSec: { type: 'number', title: 'Timeout in Seconds', default: 15, },
          },
        },
      },
    },
  },

  'browseruse-v1.0': {
    key: 'browseruse-v1.0',
    value: 'browseruse-v1.0',
    enable: hasProfile(['all', 'h9y', 'fleet']),
    category: 'LLM',
    icon: 'compass',
    text: 'Browser-Use v1.0',
    description: t('browseruse.description'),
    docUrl: getDocUrl('browseruse'),
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', title: 'Name', default: faker.internet.username().toLowerCase() },
        description: { type: 'string', title: 'Description', format: 'textarea', default: '' },
        joinRooms: { type: 'array', items: { type: 'string' }, title: 'Join Rooms', default: [], },
        expire: { type: 'string', enum: ['', '1m', '1h', '12h', '1d', '1w', '1mo'], title: 'Expire Deployment', default: '' },
        browseruse: {
          type: 'object',
          title: 'Browser-Use Configuration',
          properties: {
            model: {
              type: 'object',
              title: 'Large Language Model (LLM)',
              properties: {
                provider: { type: 'string', title: 'LLM Provider', default: 'openai' },
                name: { type: 'string', title: 'LLM Name', default: 'gpt-5-nano' },
                apiKey: {
                  type: 'object',
                  title: 'API Key',
                  properties: {
                    valueFromVault: { type: 'string', title: 'Value From Vault Key', default: 'OPENAI_API_KEY' },
                  },
                },
              }
            },
          }
        },
      }
    },
  },

  'hermes-v1.0': {
    key: 'hermes-v1.0',
    value: 'hermes-v1.0',
    enable: hasProfile(['all', 'h9y', 'olympus']),
    category: 'LLM',
    icon: 'compass',
    text: 'Hermes-Agent v1.0',
    description: t('hermes.description'),
    docUrl: getDocUrl('hermes'),
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', title: 'Name', default: faker.internet.username().toLowerCase() },
        description: { type: 'string', title: 'Description', format: 'textarea', default: '' },
        joinRooms: { type: 'array', items: { type: 'string' }, title: 'Join Rooms', default: [], },
        expire: { type: 'string', enum: ['', '1m', '1h', '12h', '1d', '1w', '1mo'], title: 'Expire Deployment', default: '' },
        hermes: {
          type: 'object',
          title: 'Hermes-Agent Configuration',
          properties: {
            model: {
              type: 'object',
              title: 'Large Language Model (LLM)',
              properties: {
                provider: { type: 'string', title: 'LLM Provider', default: 'custom' },
                name: { type: 'string', title: 'LLM Name', default: 'gemma4' },
                apiKey: {
                  type: 'object',
                  title: 'API Key',
                  properties: {
                    valueFromVault: { type: 'string', title: 'Value From Vault Key', default: 'OLLAMA_API_KEY' },
                  },
                },
              }
            },
          }
        },
      }
    },
  },

}

export default archetypes

const defaultArchetype = Object.values(archetypes).find(a => a.enable)

export { defaultArchetype }
