# AgentHub

AgentHub is a local TypeScript terminal app that stays open 24/7 and syncs shared AI-agent memory, skills, and MCP server configuration into provider-specific targets for Claude Code, OpenAI Codex, and OpenCode.

The source of truth lives in `~/.agenthub`. AgentHub renders that source into files such as workspace-level `CLAUDE.md`, workspace-level `AGENTS.md`, Codex `~/.codex/config.toml`, and OpenCode `~/.config/opencode/opencode.json`.

## Installation

```bash
pnpm install
pnpm setup:global
```

This builds the project and registers the `agenthub` command globally for your local machine. It uses the package `bin` entry in `package.json`, so every teammate can clone the repo and run the same setup command.

To remove the global command:

```bash
pnpm remove:global
```

## Quickstart

```bash
agenthub
```

`agenthub` opens the live terminal app. On first run, open Settings to create the AgentHub config, source folders, workspace targets, and MCP defaults. Leave that terminal open to see folders, memory, skills, MCPs, generated outputs, and auto-sync events.

Example workflow:

1. Run `agenthub`.
2. Open Settings and save the workspace/config defaults.
3. Edit `~/.agenthub/memory/global.md`.
4. AgentHub renders `/Users/lucionigro/Repository/CLAUDE.md`.
5. AgentHub renders `/Users/lucionigro/Repository/AGENTS.md`.
6. Claude Code, Codex, and OpenCode share the same memory.

## Provider-Created Skills

AgentHub can also import skills created from a provider app. For Claude Code, it watches and imports:

- `~/.claude/skills/<skill>/SKILL.md`
- `<workspace>/.claude/skills/<skill>/SKILL.md`

When the dashboard is running, a new Claude Code skill is copied into `~/.agenthub/skills`, cleaned of provider-only frontmatter/markers, and then rendered into the configured instruction targets such as `/Users/lucionigro/Repository/AGENTS.md`.

Manual path:

```bash
agenthub push
```

That performs the same import-and-sync cycle without keeping the dashboard open.

## Terminal App

AgentHub opens as a simple local control surface. The first screen answers the practical questions directly: which folders are configured, which memory files exist, which skills are shared, which MCPs are enabled, and which provider files are being generated.

The app shows:

- `Dashboard`: readiness, workspace/source paths, synced outputs, memory, skills, and recent activity.
- `Skills` and `Base Memory`: every Markdown source file AgentHub renders into provider instructions.
- `Workspace`: generated files such as `CLAUDE.md`, `AGENTS.md`, Codex TOML, and OpenCode JSON.
- `Settings`: workspace, providers, instruction write mode, source paths, and MCP server toggles.
- `Recent Activity`: sync, import, reload, backup, and error activity.

Readiness states:

- `Ready`: system is in policy
- `Needs Materialization`: outputs are missing and can be created with `p`
- `Drift Detected`: targets exist but differ from AgentHub output
- `Attention Required`: an operational error needs review

Shortcuts:

- `q`: quit
- `1`: dashboard
- `2`: skills
- `3`: base memory
- `4`: workspace
- `5`: recent activity
- `6`: settings
- `p`: sync/import now
- `d`: drift scan
- `r`: reload config
- `?`: help

CLI commands remain available for scripting:

```bash
agenthub status
agenthub push
agenthub diff
agenthub watch
agenthub tui
```

## Example Config

```yaml
version: 1
profile: default
source:
  root: "~/.agenthub"
  memoryDir: "~/.agenthub/memory"
  skillsDir: "~/.agenthub/skills"
  mcpFile: "~/.agenthub/mcp/servers.yml"
workspaces:
  - name: main
    path: "/Users/lucionigro/Repository"
    mode: workspace-root
providers:
  claude:
    enabled: true
  codex:
    enabled: true
  opencode:
    enabled: true
targets:
  - id: claude-workspace-instructions
    provider: claude
    type: instructions
    scope: workspace
    workspace: main
    path: "/Users/lucionigro/Repository/CLAUDE.md"
    writeMode: managed
    includes:
      - memory/global.md
      - memory/coding-style.md
      - memory/workflow.md
      - skills/backend.md
```

## Scopes

- `global`: provider-wide files such as `~/.codex/config.toml`.
- `workspace`: one parent folder that contains many repositories.
- `project`: files inside a single repository.
- `mixed`: shared workspace targets plus project-level overrides.

AgentHub syncs targets, not repositories.

## Write Modes

- `managed`: AgentHub owns the full file and writes a managed header.
- `append-block`: AgentHub only replaces content between `agenthub:start` and `agenthub:end`.

JSON targets use structural merge instead of comment markers because JSON does not support comments safely.

## Safety And Backups

Before overwriting an existing target, AgentHub creates a timestamped backup under `~/.agenthub/backups`. Append-block mode never deletes manual content outside AgentHub markers.

## Providers

- Claude Code: workspace/project `CLAUDE.md`.
- Codex: global/workspace/project `AGENTS.md` and `~/.codex/config.toml` MCP config.
- OpenCode: `opencode.json` with `instructions` and `mcp`.

## Roadmap

- Conflict resolution.
- Additional provider-specific skill importers.
- Cloud sync.
- Desktop GUI.
