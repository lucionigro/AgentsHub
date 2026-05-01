# AgentHub

AgentHub is a local TypeScript terminal app that stays open 24/7 and syncs shared AI-agent memory, skills, and MCP server configuration into provider-specific targets for Claude Code, OpenAI Codex, and OpenCode.

The source of truth lives in `~/.agenthub`. AgentHub renders that source into files such as workspace-level `CLAUDE.md`, workspace-level `AGENTS.md`, Codex `~/.codex/config.toml`, and OpenCode `~/.config/opencode/opencode.json`.

## Installation

Prerequisites:

- Node.js 20 or newer.
- pnpm 10.33.2, preferably through Corepack.

```bash
corepack enable
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

`agenthub` opens the live terminal app. On first run, AgentHub starts in a guided Settings flow to create the config, source folders, workspace targets, and MCP defaults. Leave that terminal open to see folders, memory, skills, MCPs, generated outputs, and auto-sync events.

Example workflow:

1. Run `agenthub`.
2. Complete the guided first-run Settings flow and use `Save & Sync`.
3. Open `Settings` -> `Global Memory`, edit the shared Markdown memory, and save with `F2` or `Ctrl+S`.
4. AgentHub renders `<workspace>/CLAUDE.md`.
5. AgentHub renders `<workspace>/AGENTS.md`.
6. Claude Code, Codex, and OpenCode share the same memory.

The Global Memory editor writes the same canonical file at `~/.agenthub/memory/global.md`, so direct file edits still work for scripted or external workflows.

The default workspace is portable: AgentHub uses `AGENTHUB_WORKSPACE` when set, otherwise the current directory where the app starts. You can edit the workspace before saving in Settings.

## Provider-Created Skills

AgentHub can also import skills created from a provider app. It watches and imports:

- `~/.claude/skills/<skill>/SKILL.md`
- `~/.codex/skills/<skill>/SKILL.md`
- `~/.config/opencode/skills/<skill>/SKILL.md`
- `~/.agents/skills/<skill>/SKILL.md`
- `<workspace>/.claude/skills/<skill>/SKILL.md`
- `<workspace>/.codex/skills/<skill>/SKILL.md`
- `<workspace>/.opencode/skills/<skill>/SKILL.md`

When the dashboard is running, a new provider skill is copied into `~/.agenthub/skills`, cleaned of provider-only frontmatter/markers, and then rendered into configured instruction targets such as `<workspace>/AGENTS.md`. `agenthub status` and `agenthub diff` preview external skills before writing them, so drift is visible before `push`.

Malformed provider skill frontmatter is skipped with a warning instead of blocking the whole sync. Package README files inside a `SKILL.md` directory are ignored.

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
- `Settings`: workspace, providers, instruction write mode, source paths, MCP server toggles, Global Memory, and Save & Sync.
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
- `F2` / `Ctrl+S`: save the Global Memory editor
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
    path: "/path/to/your/workspace"
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
    path: "/path/to/your/workspace/CLAUDE.md"
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
- OpenCode: `opencode.json` with `instructions` pointing at the shared `<workspace>/AGENTS.md`, plus `mcp`.

## Roadmap

- Conflict resolution.
- Additional provider-specific config surfaces.
- Cloud sync.
- Desktop GUI.
