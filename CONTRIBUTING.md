# Contributing to Leave My Data Alone (LMDA)

## Getting Started

1. Fork the repository and clone it locally.
2. Install dependencies: `npm install`
3. Create a feature branch from `main` following the branch conventions below.
4. Make your changes, write tests, and verify everything passes locally.
5. Open a pull request against `main`.

## Branch Naming

| Prefix | Use |
|--------|-----|
| `feature/<name>` | New features |
| `fix/<name>` | Bug fixes |
| `docs/<name>` | Documentation changes |
| `provider/<name>` | New framework provider |
| `adapter/<name>` | New external prompt source adapter |
| `detection/<name>` | New detection type |
| `test-suite/<name>` | New adversarial test suite |

## Local Development

```bash
npm install        # Install dependencies
npm run build      # Compile TypeScript
npm test           # Run test suite (Vitest)
npm run lint       # Lint
npm run typecheck  # Type check
```

All four checks must pass before opening a PR. The CI pipeline runs the same set.

## Code Standards

Follow the principles in [CLAUDE.md](./CLAUDE.md). The short version:

- SOLID principles. One responsibility per module.
- Test-first. Write tests alongside or before implementation.
- Self-documenting code. Clear names. Comments explain why, not what.
- Zero failing tests. No exceptions.
- Small, focused diffs. One concern per PR.

## How to Contribute

### New Test Suite

Test suites are YAML files in `test-suites/builtin/`. Each file defines a suite
using the schema documented in [ARCHITECTURE.md](./ARCHITECTURE.md).

1. Create your YAML file in `test-suites/builtin/`.
2. Write unit tests that confirm the suite loads and validates correctly.
3. Open a PR describing what attack vectors the suite covers and why.

### New Framework Provider

Providers integrate LMDA with a target agent framework. They implement the
`AgentProvider` interface defined in `src/types/`.

1. Create `src/providers/<framework>.ts`.
2. Implement `AgentProvider`. See the Provider Contract section in ARCHITECTURE.md.
3. Write tests in `tests/providers/<framework>.test.ts`.
4. Export the provider from `src/index.ts`.
5. Document any framework-specific setup requirements in your PR.

### New Detection Type

Detection types are pluggable components in the detection engine.

1. Create `src/core/detection/<type>.ts`.
2. Implement the `Detector` interface.
3. Register the detector in the detection engine index.
4. Write tests covering match and no-match cases.
5. Add the new type to the Detection Types table in ARCHITECTURE.md.

### New External Source Adapter

Adapters pull adversarial prompts from third-party repositories and normalize
them into LMDA YAML.

1. Create `src/refresh/adapters/<source>.ts`.
2. Implement the source adapter interface.
3. Write tests that validate correct parsing against a sample of the source format.
4. Register the adapter in the refresh configuration.
5. Add the source to the Registered Sources table in ARCHITECTURE.md.

## Pull Request Checklist

- [ ] Changes are scoped to a single concern.
- [ ] Tests cover the new or changed code.
- [ ] All CI checks pass locally before submitting.
- [ ] ARCHITECTURE.md is updated if public interfaces or extension points changed.
- [ ] Related issues are referenced in the PR description.

## CI Pipeline

Every PR runs the full pipeline:

| Check | Command | Passes if |
|-------|---------|-----------|
| Lint | `npm run lint` | Zero warnings |
| Type check | `npm run typecheck` | Zero errors |
| Tests | `npm test` | All pass |
| Build | `npm run build` | Clean compile |

No PR is merged until every check is green.
