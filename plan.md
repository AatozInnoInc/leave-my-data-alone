# Development Workflow

Multi-model development with clear handoffs. Each model has a defined role.

## v1 Roadmap

### Phase 1: Design [COMPLETE]
**Model**: Opus 4.6

Deliverables:
- [x] docs/ARCHITECTURE.md: System design and component interfaces
- [x] docs/CONTRIBUTING.md: Coding standards and TypeScript rules
- [x] docs/v2-ROADMAP.md: Future features and priorities
- [x] HANDOFF.md: Implementation instructions
- [x] Final design review with stakeholder

Key Decisions:
- Language: TypeScript (Node.js 22+)
- Structure: Monorepo with @lmda/core and @lmda/openclaw
- OpenClaw: Plugin mode primary, standalone for CI/advanced users
- Schema: YAML with TypeBox validation
- UI/UX: CLI plus Moltbot skill (v1), Web dashboard (v2)
- External sources: Daily auto-sync from Tier 1 repos

### Phase 2: Implementation [COMPLETE]
**Model**: GPT-5.3 Codex Extra High

Tasks:
- [x] Project scaffolding (pnpm workspace, TypeScript, ESLint, Prettier, Vitest)
- [x] @lmda/core (schema, loader, engine, invariants, canary, fixtures, telemetry, reporters, CLI)
- [x] @lmda/openclaw (standalone WebSocket, plugin middleware, Moltbot skill)
- [x] External source adapters (JailbreakBench, Awesome-Jailbreak, Jailbreak LLMs)

### Phase 3: Polish [COMPLETE]
**Model**: Sonnet 4.6

Tasks:
- [x] Bug fixes
- [x] Documentation polish

Completed during Phase 4 review (gaps caught by Opus 4.6):
- [x] Built-in scenarios (5 across indirect-injection, tool-coercion, session-leakage, encoding-exfil, smoke)
- [x] Templates for user scenarios (3 templates plus README)
- [x] CI workflow setup (.github/workflows/ci.yaml)
- [x] GitHub Actions for daily source sync (.github/workflows/sync-sources.yaml)
- [x] Build tooling (tsup for both packages)
- [x] docs/SCENARIO-AUTHORING.md and docs/PROVIDER-GUIDE.md

### Phase 4: Review [COMPLETE]
**Model**: Opus 4.6

Tasks:
- [x] Architecture review: all interfaces match spec
- [x] Code review for conceptual integrity: 123 tests pass, no `any`, good SOLID compliance
- [x] Security review: YAML bomb protection added, GitHub adapter input sanitization added, adapter owner mismatch fixed
- [x] Final documentation review: missing docs created, PROVIDER-GUIDE condensed with Mermaid diagrams

Remaining (deferred):
- [ ] ESLint config fix (Node.js globals) and 78 lint errors (hand off to cheaper model)

## v2 Roadmap

### P0: Must Have
- [ ] Web Dashboard: Visual results, test management, high polish
- [ ] Agentic self-integration: Moltbot can install and run LMDA on itself

### P1: Should Have
- [ ] Scenario generator: CLI-based test creation wizard
- [ ] Tier 2 external sources:
  - [ ] tuxsharxsec/Jailbreaks
  - [ ] PromptInjectionBench
  - [ ] PINT-Benchmark
- [ ] Human confirmation flows: MFA/passkey for security sign-off

### P2: Nice to Have
- [ ] Additional providers (LangChain.js, generic stdin/stdout)
- [ ] VS Code extension
- [ ] Benchmark mode (defense effectiveness scoring)

### TODO: Future Consideration
- [ ] Evaluate TrustAIRLab/JailbreakRadar
- [ ] Evaluate leeisack/jailbreak_llm
- [ ] Multi-turn attack sequences with branching
- [ ] LLM-based semantic invariant evaluation

## Model Roles

| Model | Role | Strengths |
|-------|------|-----------|
| Opus 4.6 | Design, review | Big-picture thinking, conceptual integrity |
| GPT-5.3 Codex | Implementation | Precise code generation, tests |
| Sonnet 4.6 | Polish, glue | Fast turnaround |

## Rules

- All models must read docs/CONTRIBUTING.md before writing code
- All handoffs must update HANDOFF.md
- Design changes require Opus 4.6 approval
- LMDA is a standalone tool: do not lock into Moltbot
