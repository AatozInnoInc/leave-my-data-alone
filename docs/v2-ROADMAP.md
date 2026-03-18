# v2 Roadmap

Features planned for v2 release. Priorities may shift based on user feedback.

## P0: Must Have

### Web Dashboard
**Priority**: Critical
**Effort**: High

A polished web interface for:
- Visual test results (pass/fail, violation details)
- Test management (enable/disable scenarios, create suites)
- Historical trends (security posture over time)
- Export and share reports

**Design Standards**:
- Meta/iOS design language
- Accessible (keyboard, ARIA, contrast)
- Responsive (mobile-friendly)
- Could integrate with OpenClaw's existing web UI

### Agentic Self-Integration
**Priority**: Critical
**Effort**: Medium

Enable Moltbot to install and run LMDA on itself:
```
User: "Run a security check on yourself"
Moltbot: [Installs LMDA if needed] -> [Runs tests in isolated process] -> [Reports results]
```

**Key Constraints**:
- Agent under test must be a fresh instance (isolated workspace)
- Test runner cannot be influenced by primary agent
- Results reported directly to user

## P1: Should Have

### Scenario Generator
**Priority**: High
**Effort**: Medium

CLI wizard for creating custom scenarios:
```bash
lmda generate
# Interactive prompts:
# What type of attack? (injection, coercion, leakage, encoding)
# What canary values?
# What tools to test?
# Outputs: my-custom-test.yaml
```

### Tier 2 External Sources
**Priority**: High
**Effort**: Low to Medium per adapter

| Source | Format | Adapter Effort |
|--------|--------|----------------|
| tuxsharxsec/Jailbreaks | Mixed (model-specific dirs) | Medium |
| PromptInjectionBench | Test scripts | Medium |
| PINT-Benchmark | Benchmark format | Low |

### Human Confirmation Flows
**Priority**: Medium
**Effort**: Medium

For high-assurance testing:
- MFA/passkey required to sign off "agent is secure"
- Human review gate before publishing results
- Audit trail of who approved what

## P2: Nice to Have

### Additional Providers
**Priority**: Medium
**Effort**: Medium per provider

- LangChain.js provider
- Generic stdin/stdout provider (for any CLI-based agent)
- OpenAI Assistants API provider

### VS Code Extension
**Priority**: Low
**Effort**: High

- Run tests from editor
- Inline scenario validation
- Results panel

### Benchmark Mode
**Priority**: Low
**Effort**: Medium

Score defense effectiveness:
- Run suite against agent
- Calculate pass rate, response times, evasion patterns
- Compare against baseline

## Future Consideration

These are ideas to evaluate, not committed features.

### External Sources to Evaluate
- TrustAIRLab/JailbreakRadar: Research/defense focused, may not have raw prompts
- leeisack/jailbreak_llm: Generator scripts, would need extraction

### Advanced Scenario Features
- Multi-turn attack sequences with branching
- Stateful attacks (persist across sessions)
- Conditional invariants (if X then Y must hold)

### LLM-Based Evaluation
- Semantic invariant checking ("did the agent intend to exfiltrate?")
- Use separate LLM to judge agent responses
- Confidence scoring for ambiguous cases

## Non-Goals for v2

These are explicitly out of scope:

- Mobile apps (web dashboard is responsive)
- Enterprise features (SSO, RBAC, audit logs): maybe v3
- Paid tiers: remains open source

---

Last updated: 2026-02-01
