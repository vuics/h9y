# Synthetic UI

The synthetic UI allows to create a user experience uniquely tailored to the user's needs.


## Synthetic UI commands

To use Synthetic UI, open communication app and add `synethetic-ui@x.h9y.ai` or `synethetic-ui-executor@x.h9y.ai` agent, then you can send the following commands to the agent:

- `/show flow`, `/hide flow` - building agentic workflows with LLMs, APIs and databases.

- `/show node`, `/hide node` - workflow automation.

- `/show train`, `/hide train` - Broswer in browser for training computer use agents.

- `/show note`, `/hide note` - notebooks for codding in Pyhton and JavaScript.

- `/show code`, `/hide code` - code editor with coder, architect and coding expert agents.

- `/show open`, `/hide open` - chat app for open-source LLMs.

- `/show sell`, `/hide sell` - CRM & ERP.

- `/show ecommerce`, `/hide ecommerce` - ecommerce app.

- `/show storefront`, `/hide storefront` - storefront for ecommerce app.

- `/show bank`, `/hide bank` - banking app.

- `/show blockchain`, `/hide blockchain` - blockchain app.

- `/show contract`, `/hide contract` - sandbox app for smart contracts and messages.

- `/show docs`, `/hide docs` - documents.


There are 2 panes in the layout, you can send: `/show flow`, then send `/show node` to open both at the same time. Then you can hide all panes with the command:

- `/hide all`

## Required Agents

The synthetic UI depends on the agent that will translate commands. The agent can be created in severla ways.

### Chat Agent

```json
{
  "name": "synthetic-ui",
  "description": "Synthetic-UI command translator.",
  "systemMessage": "You are a synthetic UI executor. The users will pass you commands to show the UI component or hide it. Your role is to translate user commands to commands that synthetic ui will understand.\nIf you receive a command `/hide all`, you output: `[[synthetic-ui:hide('all')]]` without back ticks.\nWhen you receive a command `/hide ${component}`, you output: `[[synthetic-ui:hide('${component}')]]`.\nWhen you receive a command `/show ${component}`, you output: `[[synthetic-ui:show('${component}')]]`.\n\nExamples of components are: chat,meet,hive,flow,node,code,build,open,note,sell,train,docs and others.\n\nOutput only a command for synthetic ui and do not output anything else.\n",
  "joinRooms": [
    "synthetic-ui"
  ],
  "model": {
    "provider": "openai",
    "name": "gpt-4o-mini"
  },
  "loaders": []
}
```

### Nodered Agent

Hive agent:
```json
{
  "name": "synthetic-ui",
  "description": "Synthetic-UI command translator.",
  "joinRooms": [
    "synthetic-ui"
  ],
  "chat": {
    "systemMessage": "You are a synthetic UI executor. The users will pass you commands to show the UI component or hide it. Your role is to translate user commands to commands that synthetic ui will understand.\nIf you receive a command `/hide all`, you output: `[[synthetic-ui:hide('all')]]` without back ticks.\nWhen you receive a command `/hide ${component}`, you output: `[[synthetic-ui:hide('${component}')]]`.\nWhen you receive a command `/show ${component}`, you output: `[[synthetic-ui:show('${component}')]]`.\n\nExamples of components are: chat,meet,hive,flow,node,code,build,open,note,sell,train,docs and others.\n\nOutput only a command for synthetic ui and do not output anything else.\n",
    "model": {
      "provider": "openai",
      "name": "gpt-4o-mini",
      "apiKey": {
        "valueFromVault": "OPENAI_API_KEY"
      }
    },
    "session": ""
  }
}
```

Node workflow:

1. Node-RED http in "Receive Webhook": POST /synthetic-ui-webhook

2. Node-RED http out "Send HTTP Response"

3. Node-RED function "Process Data": On Message:

```javascript
const prompt = msg.payload.prompt
msg.payload = ""
const arr = (str) => str ? str.split(',') : []
const components = arr('chat,meet,hive,flow,node,code,build,open,note,sell,train,docs')
if (prompt.includes('/hide all')) {
   msg.payload += "[[synthetic-ui:hide('all')]]"
} else {
   for (const component of components) {
       if (prompt.includes(`/hide ${component}`)) {
           msg.payload += `[[synthetic-ui:hide('${component}')]]`
       } else if (prompt.includes(`/show ${component}`)) {
           msg.payload += `[[synthetic-ui:show('${component}')]]`
       }
   }
}
return msg;
```
