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
      },
      embeddings: {
        provider: String,
        name: String,
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
        filesIds: [ String ],
        documentIds: [ String ],
      }, ],

      notebook: {
        filePath: String,
        kernelName: String,
        parameters: Mixed,
        parseJson: Boolean,
        promptKey: String,
      },

      // other options will be defined here
    },
  })
    .plugin(mongooseTimestamp)
)
