# HyperAgency Architecture Principles

This document explains the design decisions behind HyperAgency. For an overview of the components, see the [README](../README.md#-architecture-at-a-glance); for guides, see [docs.h9y.ai](https://docs.h9y.ai).

HyperAgency is built from three layers:

- **Multi-user operating system** — users, organizations, agents, permissions, and messaging.
- **Multi-layer memory** — specialized stores for structure, conversations, state, files, models, and observability.
- **Distributed agent runtime** — worker containers that schedule and run agents, with failover.

Six principles shape how these layers fit together.

---

## 1. Control plane and execution plane are separate

| Control plane — *what should happen* | Execution plane — *what is happening* |
| --- | --- |
| Users, organizations, permissions | Agent execution inside worker containers |
| Agent definitions and maps (MongoDB) | Tool calls: browser, code, models, APIs |
| Message routing (XMPP) | State updates in the memory layers |
| Credentials (Vault) | Locks and heartbeats (Redis) |

Because execution only reads definitions and writes state, you can add or remove workers without touching coordination, and change orchestration logic without redeploying workers.

## 2. An agent has a persistent identity and ephemeral execution

An agent is not a function call and not a long-running service:

| Model | What it is |
| --- | --- |
| Tool | Stateless function call |
| Service | Long-running process bound to a host |
| Workflow step | Node in a predefined pipeline |
| **HyperAgent** | **Entity with identity, memory, and permissions, executed on demand by any available worker** |

What persists: the agent's XMPP address, definition, memory, and message history. What is temporary: the worker that currently runs it. A worker claims an agent with a Redis lock and keeps it with heartbeats; if the worker disappears, the lock expires and another worker takes the agent over. Since state lives outside the worker, the agent continues where it left off.

## 3. Execution is message-driven and may contain cycles

Workflow engines usually execute a directed acyclic graph (DAG) defined up front. In HyperAgency, agents react to messages:

- a message triggers an agent;
- the agent acts and emits new messages;
- those messages trigger other agents or people.

The execution graph emerges from message flow, so cycles are normal rather than an error. This supports:

- iterative reasoning (plan → act → evaluate → refine);
- self-correction through feedback from people, agents, or observability signals;
- long-running processes whose goals change over time;
- negotiation and coordination between many agents.

Maps give this flow a visible, editable structure, and Maptrix lets one map run inside another. Governance (Vault, permissions, human replies over XMPP) and observability (OpenSearch, Prometheus) keep long-running loops inspectable.

## 4. HyperAgents are composable packages

A HyperAgent can bundle sub-agents, tools, memory schemas, orchestration logic, and bridges. Packages are:

- defined as portable JSON;
- versioned;
- composable into larger systems (agent → agent → agent);
- publishable to a registry (Verdaccio, in the Kubernetes and Cloud deployments) and reusable across organizations.

## 5. Each instance is sovereign; federation carries only messages

Every instance owns its users, agent memory, execution history, credentials, and orchestration state. There is no global database, no central memory, and no replication of state between instances.

Instances federate over XMPP server-to-server connections. Only explicit messages cross instance boundaries, and each message is stored only by the sender's and the receiver's instances. Collaboration does not require giving up control of data.

## 6. Ownership and licensing can be recorded on-chain

In the Kubernetes and Cloud deployments, HyperAgency integrates Hyperledger FireFly (Fabric and EdgeEVM) for:

- identity and ownership of agents and packages;
- licensing of HyperAgent packages;
- wallets and token transfers between users;
- verifiable records for marketplace deals.

This is the foundation of the [Web3 Marketplace](../README.md#-web3-marketplace), where builders publish and license HyperAgent packages.

---

## Experimental work

- **MetaAgent** — an experimental agentic map that designs and evolves other agents. It is not part of the core platform.
