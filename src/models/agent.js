import mongoose from 'mongoose'
import mongooseTimestamp from 'mongoose-timestamp'
import { Verbose } from '../services.js'

const verbose = Verbose('sd:models/agent'); verbose('')

const { ObjectId, Mixed } = mongoose.Schema.Types

export default mongoose.model(
  'Agent',
  mongoose.Schema({
    userId: {
      type: ObjectId,
      required: true,
      ref: 'User'
    },

    archetype: String, // chat, rag, notebook
    deployed: Boolean, // only run the agents with deployed===true

    options: {
      name: String, // unique name
      description: String,
      joinRooms: [ String ], // XMPP rooms to join,

      chat: {
        systemMessage: String, // SystemMessage(SYSTEM_MESSAGE) to pass to LLM on LangChain

        model: {
          provider: String, // Name of the LLM model provider such as 'openai' or 'anthropic'
          name: String, // Name of the LLM such as 'gpt-4o-mini' or 'claude-3-5-sonnet-20240620'
          apiKey: {
            valueFromVault: String,
          },
        },
        session: String,
      },

      system: {
      },

      transform: {
        type: {
          type: String,
          enum: [
            'echo',      // Returns the original input string unchanged.
            'const',     // Always returns the string provided in `const`.
            'repeat',    // Repeats the input string `repeat` times.
            'regexp',    // Applies a sed/vim-style regex transformation (s/pattern/replacement/flags).
            'uuid',      // Generates a UUID v4 string; no parameters.
            'nanoid',    // Generates a NanoID string of length specified in `nanoid`.
            'case',      // Changes letter casing of input; options: 'upper','lower','camel','snake','kebab'.
            'hash',      // Returns a hash of input using algorithm specified in `hash` ('md5','sha256','sha512').
            'trim',      // Removes leading and trailing whitespace from input string.
            'truncate',  // Truncates input to a maximum length specified in `truncate`.
            'prefix',    // Adds the string specified in `prefix` to the beginning of input.
            'suffix',    // Adds the string specified in `suffix` to the end of input.
            'template',  // Uses Mustache templating to render input with variables from JSON-parsed input string.
            'slugify'    // Converts input into a URL-friendly slug; lowercase if `slugify` is true.
          ]
        },

        // Parameters for specific transform types
        const: { type: String },                           // for 'const'
        repeat: { type: Number },                          // for 'repeat'
        regexp: { type: String },                          // for 'regexp'
        nanoid: { type: Number },                          // for 'nanoid'
        case: { type: String, enum: ['upper','lower','camel','snake','kebab'] }, // for 'case'
        hash: { type: String, enum: ['md5','sha256','sha512'] },                 // for 'hash'
        truncate: { type: Number },                        // for 'truncate'
        prefix: { type: String },                          // for 'prefix'
        suffix: { type: String },                          // for 'suffix'
        template: { type: String },                        // for 'template'
        slugify: { type: Boolean },                        // for 'slugify'
      },

      // architect: {
      // },

      rag: {
        systemMessage: String, // SystemMessage(SYSTEM_MESSAGE) to pass to LLM on LangChain

        model: {
          provider: String, // Name of the LLM model provider such as 'openai' or 'anthropic'
          name: String, // Name of the LLM such as 'gpt-4o-mini' or 'claude-3-5-sonnet-20240620'
          apiKey: {
            valueFromVault: String,
          },
        },
        embeddings: {
          provider: String,
          name: String,
          apiKey: {
            valueFromVault: String,
          },
        },

        vectorStore: String,

        loaders: [ {
          enable: Boolean,
          kind: String,

          // text loader
          files: [ String ],

          // directory loader
          path: String,
          glob: String,

          // web loader
          urls: [ String ],

          // google-drive loader
          folderId: String,
          recursive: Boolean,
          unstructured: Boolean,
          filesIds: [ String ],
          documentIds: [ String ],
        }, ],

        commands: {
          get: String,
          count: String,
          loadText: String,
          loadURL: String,
          loadAttachment: String,
          // loadGDrive: String,
          delete: String,
        },
      },

      stt: {
        model: {
          provider: String,
          name: String,
          apiKey: {
            valueFromVault: String,
          },
        },
        language: String,
      },

      tts: {
        model: {
          provider: String,
          name: String,
          voice: String,
          apiKey: {
            valueFromVault: String,
          },
        },
        format: String,
        speed: Number,
      },

      imagegen: {
        model: {
          provider: String,
          name: String,
          apiKey: {
            valueFromVault: String,
          },
        },
        size: String,
        quality: String,
        style: String,
        n: Number,
      },

      code: {
        kernel: String,
        env: Mixed,
        commands: {
          start: String,
          restart: String,
          reconnect: String,
          shutdown: String,
        },
      },

      quantum: {
        // provider: String,
        backend: String,
        minNumQubits: Number,
        language: String,
        optimizationLevel: Number,
        draw: {
          enable: Boolean,
          output: String,
          style: String,
        },
        instance: {
          valueFromVault: String,
        },
        apiKey: {
          valueFromVault: String,
        },
      },

      storage: {
        driver: String,
        namespace: String,
        verbose: Number,
        commands: {
          list: String,
          get: String,
          set: String,
          delete: String,
        },
      },

      command: {
        execute: String,
        shell: Boolean,
      },

      langflow: {
        flowId: String,
        sessionId: String,
      },

      nodered: {
        method: String,
        route: String,
        payload: Mixed,
        parseJson: Boolean,
        promptKey: String,
      },

      n8n: {
        method: String,
        url: String,
        payload: Mixed,
        parseJson: Boolean,
        promptKey: String,
      },

      notebook: {
        filePath: String,
        kernelName: String,
        parameters: Mixed,
        parseJson: Boolean,
        promptKey: String,
      },

      avatar: {
        model: {
          provider: String,
          // name: String,
          // apiKey: {
          //   valueFromVault: String,
          // },
        },
      },

      maptrix: {
        mapId: {
          type: ObjectId,
          required: false,
          ref: 'Map'
        },
        input: Mixed,
        output: [String],
        parseJson: Boolean,
        promptKey: String,
        sendStatus: Boolean,
      },
    },
  })
    .plugin(mongooseTimestamp)
)
