# 🐙 HyperAgency (h9y)

![HyperAgency Text Logo](./hyperagency.png)


[![Contribute](https://img.shields.io/badge/contribute-here-brightgreen)]


[**HyperAgency**](https://h9y.ai/) is an **open-source agentic AI operating system** for building, orchestrating, and deploying collaborative systems of AI agents and humans. It has self-developing tools for building fully autonomous software companies. The agents can be generated in semi-automatic mode. It includes web3 marketplace for selling and buying hyper agents. The hyper agents can make deals with each other and with people on behalf of their users.

We envision a future where software companies can operate with minimal human intervention — composed of agents that code, plan, manage, and evolve. HyperAgency provides the **framework and infrastructure** to explore and build toward that future.

> 🧠 Think of it as your operating system for autonomous workflows — distributed, flexible, and customizable.

---

## 📢 Pre-Public Release Notice

HyperAgency is currently in a pre-public release phase. The repository you are viewing contains the core project structure along with links to several internal Git submodules. These submodule repositories are presently private while we complete stabilization, security reviews, and licensing preparations.
When the platform officially launches, we will open the source code of all associated submodules under the same multi-license model that governs this main repository (Apache-2.0-NC for non-commercial use, AGPL-3.0 for commercial open-source use, and a Commercial License for closed-source enterprise deployments).
Until then, this repository serves as the central public entry point for documentation, roadmap previews, and integration guidelines.

---

## 🧠 Why HyperAgency?

With HyperAgency, you can:

* ✅ **Create, deploy, and manage agents** — quickly iterate and improve.
* 💬 **Communicate across agents and humans** — all in one unified interface.
* 🧩 **Assemble smart, collaborative AI-human teams** — for coding, design, planning, or operations.
* 🗺️ **Coordinate visually** — with an intuitive Map view.
* 🧪 **Use an interactive playground** — test flows step-by-step in real time.
* 🔀 **Orchestrate conversations** — with multi-agent dialog and memory.
* 🔐 **Stay in control** — enterprise-ready with secure APIs, self-hosting, and customizable source code.
* 🌍 **Scale across distributed nodes** — federated and connectable infrastructure.

> ✨ Build your own autonomous AI-first organization — or enhance your existing one.

While still in active development, HyperAgency already includes many of the core components required to experiment with **autonomous system coordination**.

📘 See the [Docs](https://docs.h9y.ai) for full capabilities, architecture, and usage examples.

---

## ⚙️ Installation Guide

> You can **self-host HyperAgency locally** in just a few steps —
> or skip the setup entirely and **use our cloud environment** for a faster start.

### 🧰 Prerequisites (for local setup)

To run HyperAgency locally, install the following:

* [Docker](https://www.docker.com/)

---

### ☁️ Prefer Not to Self-Host?

If you don’t want to manage infrastructure yourself, you can request access to our hosted **HyperAgency Cloud**, where everything is pre-configured and ready to use.

👉 [Get Cloud Access](https://h9y.ai/signup)

> The cloud environment is perfect for early testing, team collaboration, or demoing agentic flows without running Docker or Vault locally.


---

### 📦 1. Clone the Repository with Submodules

```bash
git clone git@github.com:vuics/hyag.git
cd hyag
git submodule update --init --recursive
```

---

### 🌐 2. Configure Local DNS

Set up `/etc/hosts` entries:

```bash
export $(xargs < .env) && \
sudo tee -a /etc/hosts << EOF

# HyperAgency Local Services
127.0.0.1 ${DOMAIN}
127.0.0.1 mongo.${DOMAIN}
127.0.0.1 redis.${DOMAIN}
127.0.0.1 vault.${DOMAIN}
127.0.0.1 postgres.${DOMAIN}
127.0.0.1 chroma.${DOMAIN}
127.0.0.1 selfdev-prosody.${DOMAIN}
127.0.0.1 conference.selfdev-prosody.${DOMAIN}
127.0.0.1 share.selfdev-prosody.${DOMAIN}
127.0.0.1 ollama.${DOMAIN}
127.0.0.1 selfdev-speech.${DOMAIN}
127.0.0.1 selfdev-avatar.${DOMAIN}
127.0.0.1 selfdev-api.${DOMAIN}
127.0.0.1 selfdev-web.${DOMAIN}
127.0.0.1 docs.${DOMAIN}

EOF
```
---

### 🤝 Optional: Setup DNS for Multi-Node Communication

To enable server-to-server messaging between multiple HyperAgency instances:

```bash
export $(xargs < .env)
export IP=$(ping -c 1 ${REMOTE_DOMAIN} | awk -F '[()]' '/PING/ { print $2 }')
sudo tee -a /etc/hosts << EOF

# Remote HyperAgency Node
${IP} ${REMOTE_DOMAIN}
${IP} selfdev-api.${REMOTE_DOMAIN}
${IP} selfdev-web.${REMOTE_DOMAIN}
${IP} conference.${REMOTE_DOMAIN}
${IP} selfdev-prosody.${REMOTE_DOMAIN}
${IP} conference.selfdev-prosody.${REMOTE_DOMAIN}

EOF
```

---

### ⚙️ 3. Configure `.env` Files

Copy and customize `.env` files for the main platform and submodules:

```bash
cp env.example .env
cp selfdev-api/env.example selfdev-api/.env
cp selfdev-agency/env.example selfdev-agency/.env
```

Edit the `.env` files to define:

* `DOMAIN`
* `REMOTE_DOMAIN` (optional)
* `VAULT_TOKEN`, `VAULT_UNSEAL_KEYS` (after vault init)
* Keys and service-specific values for each component.

---

### 🔐 4. Generate TLS Certificates (Local Dev)

```bash
./gen-certs.sh
```

On macOS, double-click each `.crt` file in `./certs/` to trust them in **Keychain Access**.

---

### 🧱 5. Start the Stack

Use Docker Compose to start all services:

```bash
docker-compose up
```

> The `COMPOSE_PROFILES` env var defines the sepecific set of services to run.
> 🧪 Alternatively, you can use `--profile <name>` to run a specific set of services.

**Available profiles:**

| Profile    | Purpose                        |
| ---------- | ------------------------------ |
| `all`      | All services                   |
| `main`     | Frontend (web) + backend (API) |
| `prosody`  | XMPP messaging infrastructure  |
| `agents`   | Agent orchestration            |
| `docs`     | Run documentation interface    |
| `postgres` | PostgreSQL database            |
| `vault`    | Secrets manager (Vault)        |
| `ollama`   | Ollama LLM service             |
| `chroma`   | Chroma vector DB               |

📜 Full list in [`docker-compose.yml`](https://github.com/vuics/hyag/blob/main/docker-compose.yml)

---

### 🔑 6. Initialize Vault

```bash
export VAULT_ADDR='http://127.0.0.1:8200'
vault operator init -key-shares=5 -key-threshold=3
```

Then **unseal Vault**:

```bash
vault operator unseal
# Repeat 3x with 3 unique keys
```

Check Vault is unsealed:

```bash
vault status
```

Login:

```bash
export VAULT_TOKEN='<your-root-token>'
vault login $VAULT_TOKEN
```

Enable secret storage:

```bash
vault secrets enable -path=secret kv-v2
```

Then update:

* `.env`
* `selfdev-api/.env`
* `selfdev-agency/.env`

> 💡 Restart Docker after setting Vault secrets.

---

### 🌐 7. Open in Browser

Replace `dev.local` with your `${DOMAIN}`.

| App           | URL                                                                       |
| ------------- | ------------------------------------------------------------------------- |
| Web Interface | [https://selfdev-web.dev.local:3690](https://selfdev-web.dev.local:3690)  |
| API Backend   | [https://selfdev-api.dev.local:6369](https://selfdev-api.dev.local:6369)  |

> 🛡️ You may need to accept self-signed certificates the first time you visit.

---

### 🛑 Stop the Stack

```bash
docker-compose down
```

---

## 🎯 Conclusion

**HyperAgency is an evolving framework for building agentic, autonomous systems — and eventually, fully autonomous software companies.**

It already offers powerful capabilities for orchestrating agents, coordinating distributed systems, and integrating LLMs and humans in real-time workflows. By joining early, you can contribute to defining what autonomous organizations of the future look like.

> 🔍 Explore. 🤝 Collaborate. 🚀 Build.
> Start building your own **agentic stack** with [HyperAgency](https://h9y.ai/) today.

---

## 🙏 Acknowledgements

Special thanks to **Hal Casteel** and **William McKinley** for their early ideas, feedback, and discussions. Their insights into intelligent systems and automation inspired much of what became [HyperAgency](https://h9y.ai/).

---

## 📜 Licensing

HyperAgency is available under a [multi-license](./LICENSE) model:

| Use Case | License |
|---------|---------|
| Personal, educational, non-commercial | Apache-2.0-NC |
| Commercial projects that remain open-source | AGPL-3.0 |
| Commercial closed-source applications | Commercial License |

Choose the license that matches your use:

- [**Apache-2.0-NC**](./LICENSE-Apache-2.0-NC) – free for non-commercial usage  
- [**AGPL-3.0**](./LICENSE-AGPL-3.0) – free for commercial use if modifications remain open  
- [**Commercial License**](./LICENSE-COMMERCIAL) – required for closed-source or proprietary use  

Answers on the most frequent licensing questions are listed in [Licensing FAQ](./Licensing-FAQ.md).

For commercial licensing inquiries, contact **admin@vuics.com**.
