# Agent guide

GrokRelay is a local address book and message relay. Use it when the operator wants an agent to communicate with a registered agent or existing desktop thread. It does not choose who should do the work or grant the receiving agent additional permissions.

## Before sending

### Register yourself

In an existing Codex conversation with shell access:

```powershell
node bridge.cjs register --address codex:website --name "Website developer"
```

Run from the actual thread workspace, using the installation's absolute `bridge.cjs` path when needed. `CODEX_THREAD_ID` and the current directory identify the thread; the relay verifies it against the existing desktop owner. Explicit `--thread-id` and `--cwd` are available to an operator. This is a small messaging command, not a new Codex model session.

A Grok bot without access to the user's filesystem can post this as a standalone visible message:

```text
[[bridge:register grok:writer]]
Writer
[[/bridge]]
```

The running relay checks same-account bots and groups for registration envelopes roughly once per minute. It derives the real conversation ID from the transcript, replies with the registered address, and only then forwards subsequent send envelopes. Group posts register that group, not the author's private chat. Repeat registration returns the existing address; it never replaces another contact. Wait for the registration acknowledgment, then send `[[bridge:contacts]]` and your message. Ordinary messages in unregistered conversations are not forwarded.

An operator can also use `register --address grok:writer --name "Writer"` with an exact discovered bot name, or add `--group` for a group. When names are ambiguous, supply `--bot-id`. The relay must be running. Contacts are reloaded without restarting it.

The operator installs GrokRelay, registers real contacts and starts the relay. A recipient such as `codex:website` is a local address, not a globally discoverable service. Do not derive IDs from a display name.

**Private chats and groups are separate contacts.** Registering a bot does not subscribe to the groups it belongs to. Use `node bridge.cjs discover groups --json` to identify a group, then register it under a unique `grok:` address with `kind: "group"` and its returned ID in `botId`. Envelopes posted in a registered group are routed from the group; replies return to that same group. An agent saying “sent” is not a transport receipt: check the relay's message record. First registration skips existing history, so resend a missed envelope only after checking it was not already delivered.

Run commands from the installation directory, or use an absolute path to `bridge.cjs`:

```powershell
node bridge.cjs doctor --json
node bridge.cjs contacts --query developer --json
node bridge.cjs status
```

`doctor` checks files and executables only. It does not authenticate to either app or prove connectivity. `status.routes` reports the worker's last observed connection state. A stopped worker can have stale route entries; always inspect `running`.

## Send and read a reply

The following addresses are fictional. Replace them with values returned by `contacts`.

```powershell
Set-Content -LiteralPath .\request.txt -Encoding utf8 -Value 'Please check the proposed homepage copy. Reply with the changes you recommend.'
node bridge.cjs send --from grok:writer --to codex:website --file .\request.txt
```

The response is JSON:

```json
{
  "id": "<message-id>",
  "from": "grok:writer",
  "to": "codex:website",
  "status": "queued",
  "workerRunning": true
}
```

Save the actual returned ID. Do not resend because the reply is not immediate.

```powershell
node bridge.cjs message --id <message-id> --include-text
```

This returns `message` and `replies`. Without `--include-text`, it returns delivery metadata without bodies. Reply text also appears in the sender's original conversation.

`--from` is required unless `CODEX_THREAD_ID` matches a registered Codex contact. It represents the user-authorized sending identity; do not select an unrelated thread or bot. The panel's compose action is explicitly an operator sending **on behalf of** a selected contact.

## Without shell access

Emit one complete envelope as a standalone visible message. On Codex it must be the final answer, not commentary. On Grok Bot it must be a visible message.

```text
[[bridge:send codex:website]]
Please check the proposed homepage copy and reply with your recommendation.
[[/bridge]]
```

Do not include code fences or text outside the envelope in the actual send. A quoted example, an ordinary message, or a partial envelope does not dispatch. A standalone `[[bridge:contacts]]` requests the current directory.

Registered unique aliases also work, but exact addresses are preferable. Only one recipient and one envelope per message are supported.

## Reply rules

- An incoming **Message** gets a normal response. The relay automatically returns it to the source.
- A **Reply** does not automatically trigger another reply. To continue the exchange, explicitly send a new message.
- If the agent emits a valid envelope while answering a message, the explicit recipient is used instead of echoing the envelope as a reply.
- Codex returns the final answer from the associated turn. Grok can emit multiple visible replies for one request; these may be progress updates.
- A response does not prove the underlying work succeeded. Check its content and any required evidence.

## Delivery states

| State                    | Meaning                                               | Agent action                                   |
| ------------------------ | ----------------------------------------------------- | ---------------------------------------------- |
| `queued`                 | Saved locally; recipient may be busy or disconnected  | Retain the ID and wait                         |
| `sending`                | Submission is in progress                             | Do not duplicate                               |
| `waiting_identity`       | Grok submission awaits transcript correlation         | Wait; not proof of failure                     |
| `waiting_reply`          | Request is associated with a destination turn/request | Wait for actual work                           |
| `answered`               | At least one response was captured                    | Inspect replies; not a success verdict         |
| `delivered`              | A reply/notice was delivered to its destination       | Inspect the destination conversation if needed |
| `delivery_unknown`       | Submission outcome is uncertain                       | Check the original destination before retrying |
| `failed`, `interrupted`  | Codex reported an unsuccessful/interrupted turn       | Inspect the original thread                    |
| `completed_without_text` | Turn ended without a final text response              | Inspect the original thread                    |

Grok contacts are scheduled for polling 10 seconds after each successful read; serial account reads and network waits can extend this. Failed reads back off. Active Codex conversations receive both requests and replies immediately through the desktop's steering interface. If several requests enter one active turn, its final answer can be returned to each initiating conversation; the relay does not invent separate completions. Only unavailable destinations remain queued. This tool does not automatically wake another independent assistant unless a message is actually delivered into that assistant's supported conversation.

Commands exit `0` on success and `1` on failure. Errors are JSON on stderr. `doctor` exits `1` when a prerequisite is missing while still returning its report on stdout. `stop` acknowledges a stop request; an in-flight read can take up to roughly a minute to finish.

## Installable skill

`skills/grok-relay/SKILL.md` contains the concise runtime workflow. Install that directory using your host's skill mechanism, and give the agent the actual GrokRelay installation path. The repository does not silently edit global agent instructions or install itself into another agent's configuration.
