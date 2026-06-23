# Selfdev Agency

Self-developing microservices for Agentic host and set of agents.

## Install

Activate virtual env for Python:
```
source ./activate.sh
```

Install dependencies:
```bash
pip install .
```

## Run

Run individual agents:
```
./exec-dev.sh
./exec-prod.sh
```

Run the XMPP agency (manages multiple agents from MongoDB):
```bash
python -m src.xmpp_agency
```

## Configuration

The XMPP agency reads agent configurations from MongoDB. The following environment variables can be set:

- `DB_URL`: MongoDB connection URL (default: "mongodb://mongo.dev.local:27017/selfdev")
- `XMPP_HOST`: XMPP server hostname (default: "selfdev-prosody.dev.local")
- `XMPP_PASSWORD`: Password for XMPP authentication (default: "123")
- `XMPP_MUC_HOST`: XMPP MUC (Multi-User Chat) host (default: "conference.{XMPP_HOST}")
- `XMPP_JOIN_ROOMS`: Default rooms to join (JSON array, default: ["team", "a-suite", "agents"])

## Security

You can check vulnerabilities with:
```
safety check
```
