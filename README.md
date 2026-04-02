# n8n-nodes-claudecode-cli

n8n community node for executing **Claude Code** via the Agent SDK. Designed for **Max plan** subscribers — no API key required.

## Features

- **Max Plan Support** — Uses Claude Code subscription auth (OAuth token or host session)
- **Execute & Continue** — Start new conversations or resume existing sessions
- **All Permission Modes** — Plan (read-only), Default, Accept Edits, Bypass Permissions
- **MCP Servers** — Connect external tools via Model Context Protocol
- **Plugins** — Load Claude Code plugins
- **Custom Agents** — Define specialized subagents for complex workflows
- **Structured Output** — Enforce JSON Schema on responses
- **Cost Control** — Set budget limits and turn caps

## Installation

### In n8n

1. Go to **Settings > Community Nodes**
2. Enter `n8n-nodes-claudecode-cli`
3. Click **Install**

### Manual

```bash
cd ~/.n8n
npm install n8n-nodes-claudecode-cli
```

## Prerequisites

Claude Code CLI must be installed and authenticated on the n8n host:

```bash
# Install Claude Code
npm install -g @anthropic-ai/claude-code

# Login with your Max plan account
claude login
```

### Authentication Options

| Method | Setup | Best For |
|--------|-------|----------|
| **Host Session** | Run `claude login` on n8n host | Self-hosted n8n |
| **OAuth Token** | Run `claude setup-token`, paste into credentials | Docker / remote n8n |

## Node Parameters

### Core

| Parameter | Description | Default |
|-----------|-------------|---------|
| Operation | Execute (new) or Continue (resume) | Execute |
| Prompt | The instruction to send | — |
| Model | sonnet / opus / haiku | sonnet |
| Permission Mode | plan / default / acceptEdits / bypassPermissions | plan |
| Project Path | Working directory | n8n default |

### Continue Operation

| Parameter | Description |
|-----------|-------------|
| Session ID | Specific session to resume. Empty = most recent. |

### Advanced Options

| Parameter | Description | Default |
|-----------|-------------|---------|
| Output Format | json / text / messages | json |
| JSON Schema | Enforce structured output | — |
| Effort | low / medium / high / max | high |
| Max Turns | Turn limit | 25 |
| Max Budget (USD) | Cost cap | 0 (unlimited) |
| Timeout | Seconds | 600 |
| Allowed Tools | Auto-approve these tools | — |
| Disallowed Tools | Block these tools | — |
| System Prompt | Append to default prompt | — |
| Bare Mode | Skip hooks/plugins/skills | false |

### Extended

| Parameter | Description |
|-----------|-------------|
| MCP Servers | JSON config for MCP servers |
| Plugins | JSON array of plugin paths |
| Agents | JSON object defining custom subagents |

## Output

Every execution returns:

```json
{
  "sessionId": "uuid",
  "result": "...",
  "isError": false,
  "durationMs": 12345,
  "costUsd": 0.05,
  "numTurns": 3,
  "usage": {},
  "modelUsage": {},
  "structuredOutput": null
}
```

Use `sessionId` in downstream nodes to continue conversations.

## Examples

### Simple Analysis (Plan Mode)

1. Set **Operation** = Execute
2. Set **Prompt** = "Analyze the code quality of this project"
3. Set **Permission Mode** = Plan
4. Set **Project Path** = /path/to/project

### Multi-step Workflow

1. First node: Execute with prompt, capture `sessionId`
2. Second node: Continue with `{{ $json.sessionId }}`

### With MCP Server

Set **MCP Servers** to:
```json
{
  "filesystem": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-filesystem", "/data"]
  }
}
```

Set **Allowed Tools** to: `mcp__filesystem__*`

## License

MIT
