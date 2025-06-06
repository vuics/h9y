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
      systemMessage: String, // SystemMessage(SYSTEM_MESSAGE) to pass to LLM on LangChain
      joinRooms: [ String ], // XMPP rooms to join,

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

      rag: {
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

      notebook: {
        filePath: String,
        kernelName: String,
        parameters: Mixed,
        parseJson: Boolean,
        promptKey: String,
      },

      command: {
        execute: String,
        shell: Boolean,
      },

      flow: {
        flowId: String,
        sessionId: String,
      },

      webhook: {
        method: String,
        route: String,
        payload: Mixed,
        parseJson: Boolean,
        promptKey: String,
      },

      qiskit: {
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

      // other options will be defined here
    },
  })
    .plugin(mongooseTimestamp)
)
