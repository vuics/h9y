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
    appId: { type: ObjectId, ref: 'App' },

    archetype: String, // chat, rag, notebook
    deployed: Boolean, // only run the agents with deployed===true

    options: {
      name: { type: String, required: true }, // unique name
      description: String,
      joinRooms: [ String ], // XMPP rooms to join,
      expire: { type: String, enum: ['', '1m', '1h', '12h', '1d', '1w', '1mo'], default: '' },

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

      mcp: {
        transport: String,
        url: String,
        command: String,
        args: [String],
      },

      a2a: {
        url: String,
        textOnly: Boolean,
      },

      system: {
        operation: String,
        model: String,
      },

      transform: {
        type: { type: String, },

        // Parameters for specific transform types
        const: String,     // for 'const'
        repeat: Number,    // for 'repeat'
        regexp: String,    // for 'regexp'
        nanoid: Number,    // for 'nanoid'
        case: String,      // for 'case'
        hash: String,      // for 'hash'
        truncate: Number,  // for 'truncate'
        prefix: String,    // for 'prefix'
        suffix: String,    // for 'suffix'
        template: String,  // for 'template'
        slugify: Boolean,  // for 'slugify'
      },

      proxy: {
        controlKey: String,
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
          append: String,
          delete: String,
          load: String,
          save: String,
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

      curl: {
        method: String,
        url: String,
        headers: String,
        timeoutSec: Number,
      },

      browseruse: {
        model: {
          provider: String, // Name of the LLM model provider such as 'openai' or 'anthropic'
          name: String, // Name of the LLM such as 'gpt-4o-mini' or 'claude-3-5-sonnet-20240620'
          apiKey: {
            valueFromVault: String,
          },
        },
      },

      hermes: {
        model: {
          provider: String,
          name: String,
          apiKey: {
            valueFromVault: String,
          },
        },
      },

      openclaw: {
        model: {
          provider: String,
          name: String,
          apiKey: {
            valueFromVault: String,
          },
        },
      },

      codex: {
        model: {
          provider: String,
          name: String,
          apiKey: {
            valueFromVault: String,
          },
        },
      },

      claudecode: {
        model: {
          provider: String,
          name: String,
          apiKey: {
            valueFromVault: String,
          },
        },
      },

      computeruse: {
        // execute: String,
        // shell: Boolean,

        model: {
          provider: String,
          name: String,
          apiKey: {
            valueFromVault: String,
          },
        },
      },

    },
  })
    .plugin(mongooseTimestamp)
)
