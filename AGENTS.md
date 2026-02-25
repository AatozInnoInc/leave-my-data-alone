# AGENTS.md

## Cursor Cloud specific instructions

### Overview

LMDA (Leave My Data Alone) is a pnpm monorepo with two packages:

| Package | Path | Purpose |
|---------|------|---------|
| `@lmda/core` | `packages/core` | Framework-agnostic security testing engine, CLI, reporters |
| `@lmda/openclaw` | `packages/openclaw` | OpenClaw provider (standalone/plugin modes) |

No Docker, databases, or external services are required. All tests use mocks.

### Standard commands

See `README.md` "Development" section. The key commands are:

| Command | What it does |
|---------|--------------|
| `pnpm install` | Install all workspace dependencies |
| `pnpm typecheck` | TypeScript strict-mode type checking across both packages |
| `pnpm lint` | ESLint across both packages |
| `pnpm test` | Vitest unit tests across both packages (93 core + 30 openclaw) |
| `pnpm build` | Build both packages with tsup (ESM, node22 target) |
| `pnpm format` | Prettier format check (currently has pre-existing warnings) |

### Running the CLI

There is no `bin` entry in `package.json`. Run CLI commands via tsx:

```
npx tsx packages/core/src/cli/index.ts <command> [options]
```

Available commands: `list`, `validate`, `run`, `sync`, `sources`.

### Non-obvious notes

- `pnpm format` (Prettier check) currently fails with ~50 pre-existing formatting warnings. This is not a regression; it is the existing state of the repo.
- The `pnpm-workspace.yaml` includes `onlyBuiltDependencies: [esbuild]` which avoids interactive build approval prompts.
- Node.js 22+ is required (`engines` field in root `package.json`).
- `@lmda/openclaw` depends on `@lmda/core` via workspace protocol. Build order is handled automatically by pnpm.
- Coverage thresholds are set to 80% (lines, functions, branches) in vitest configs.
