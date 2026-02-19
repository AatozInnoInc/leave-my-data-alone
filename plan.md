# Development Workflow

Multi-model development with clear handoffs. Each model has a defined role.

## v1 Roadmap

### Phase 1: Design [COMPLETE]
**Model**: Opus 4.5

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

### Phase 2: Implementation [PENDING]
**Model**: GPT-5.2 Codex Extra High

Tasks:
1. Project scaffolding
   - pnpm workspace setup
   - Package structure for @lmda/core and @lmda/openclaw
   - TypeScript, ESLint, Prettier, Vitest configuration
2. @lmda/core implementation
   - Scenario schema and loader
   - Telemetry types and provider interface
   - Canary generator (non-deterministic seeds)
   - Invariant evaluator with matchers
   - Fixture provisioner
   - Scenario engine
   - Reporters (JUnit, JSON, console)
   - CLI (run, validate, list, sync, sources)
3. @lmda/openclaw implementation
   - Standalone mode (WebSocket plus JSONL)
   - Plugin mode (middleware)
   - Moltbot skill
4. External source adapters
   - JailbreakBench
   - AI-Prompt-Injection-List
   - Awesome-Jailbreak-on-LLMs

### Phase 3: Polish [PENDING]
**Model**: Sonnet 4.5

Tasks:
- Bug fixes
- Documentation polish
- Built-in scenarios (finished tests)
- Templates for user scenarios
- CI workflow setup
- GitHub Actions for daily source sync

### Phase 4: Review [PENDING]
**Model**: Opus 4.6

Tasks:
- Architecture review
- Code review for conceptual integrity
- Security review
- Final documentation review

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
| GPT-5.2 Codex | Implementation | Precise code generation, tests |
| Sonnet 4.5 | Polish, glue | Fast turnaround |

## Rules

- All models must read docs/CONTRIBUTING.md before writing code
- All handoffs must update HANDOFF.md
- Design changes require Opus 4.6 approval
- LMDA is a standalone tool: do not lock into Moltbot
