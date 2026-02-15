# Contributing Guide

Engineering standards for leave-my-data-alone (LMDA).

This document defines the coding standards, patterns, and practices that all contributors (human and AI) must follow. These are non-negotiable.

## Table of Contents

1. [Philosophy](#philosophy)
2. [TypeScript Standards](#typescript-standards)
3. [Code Organization](#code-organization)
4. [Error Handling](#error-handling)
5. [Testing](#testing)
6. [Documentation](#documentation)
7. [Git Workflow](#git-workflow)
8. [AI Model Handoff Protocol](#ai-model-handoff-protocol)

## Philosophy

### No Vibe Coding

This project demonstrates principal-level software engineering. Every decision should be:
- **Intentional**: Know why you're doing something
- **Documented**: Leave a trail for future maintainers
- **Tested**: If it's not tested, it's broken
- **Reviewed**: Code should be readable by humans

### Principles (Apply Judiciously)

Not all principles apply in all situations. Use judgment.

| Principle | When to Apply |
|-----------|---------------|
| SOLID | Class design, interface design |
| DRY | When duplication creates maintenance burden (not before) |
| YAGNI | Always. Don't build for hypothetical futures. |
| Composition over Inheritance | Almost always in TypeScript |
| Fail Fast | Input validation, configuration |
| Explicit over Implicit | API design, configuration |

## TypeScript Standards

### Strict Mode

All TypeScript code uses strict mode. The base config:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true
  }
}
```

### Prefer `interface` for Object Shapes

```typescript
// Good
interface ScenarioMetadata {
  id: string;
  name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

// Avoid (unless you need union/intersection types)
type ScenarioMetadata = {
  id: string;
  name: string;
};
```

### Use `type` for Unions, Intersections, Mapped Types

```typescript
// Good
type Severity = 'low' | 'medium' | 'high' | 'critical';
type TelemetryEventType = 'tool_call' | 'llm_output' | 'memory_write';

// Good: mapped types
type Readonly<T> = { readonly [K in keyof T]: T[K] };
```

### Discriminated Unions for Variants

```typescript
// Good: discriminated union
interface ToolCallEvent {
  type: 'tool_call';
  tool: string;
  args: Record<string, unknown>;
}

interface LLMOutputEvent {
  type: 'llm_output';
  content: string;
}

type TelemetryEvent = ToolCallEvent | LLMOutputEvent;

// Usage: TypeScript narrows correctly
function handleEvent(event: TelemetryEvent) {
  switch (event.type) {
    case 'tool_call':
      console.log(event.tool); // TS knows this exists
      break;
    case 'llm_output':
      console.log(event.content); // TS knows this exists
      break;
  }
}
```

### No `any`

```typescript
// Never
function process(data: any) {}

// Use unknown and narrow
function process(data: unknown) {
  if (typeof data === 'string') {
    // data is string here
  }
}

// Or use generics
function process<T>(data: T): T {}
```

### Exhaustiveness Checking

```typescript
function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${x}`);
}

function handleSeverity(s: Severity): string {
  switch (s) {
    case 'low': return 'green';
    case 'medium': return 'yellow';
    case 'high': return 'orange';
    case 'critical': return 'red';
    default:
      return assertNever(s); // Compile error if case missed
  }
}
```

### Use `readonly` for Immutable Data

```typescript
// Good
interface Scenario {
  readonly id: string;
  readonly invariants: readonly Invariant[];
}

// Also good: as const for literals
const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
```

### Named Exports, No Default Exports

```typescript
// Good
export interface Scenario {}
export function loadScenario() {}

// Avoid
export default class Scenario {}
```

Rationale: Named exports have better refactoring support and more explicit imports.

### Import Order

```typescript
// 1. Node built-ins
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// 2. External packages
import { Type, Static } from '@sinclair/typebox';
import { parse } from 'yaml';

// 3. Internal packages (monorepo)
import { TelemetryProvider } from '@lmda/core';

// 4. Relative imports
import { parseSession } from './session-parser.js';
import type { GatewayConfig } from './types.js';
```

### File Naming

- `kebab-case.ts` for all files
- `*.test.ts` for unit tests
- `*.integration.test.ts` for integration tests
- `index.ts` only for public API re-exports

---

## Code Organization

### One Concept Per File

```
// Good
invariants/
  evaluator.ts        # InvariantEvaluator class
  types.ts            # Invariant types/interfaces
  matchers/
    must-not-contain.ts
    must-not-call.ts

// Avoid
invariants.ts         # 500 lines with everything
```

### Explicit Public APIs

Each package has a single `index.ts` that explicitly exports its public API:

```typescript
// packages/core/src/index.ts

// Types
export type { Scenario, ScenarioMetadata, Invariant } from './scenario/types.js';
export type { TelemetryEvent, TelemetryProvider } from './telemetry/types.js';
export type { EvaluationResult, Violation } from './invariants/types.js';

// Classes/Functions
export { loadScenario } from './scenario/loader.js';
export { ScenarioEngine } from './engine/runner.js';
export { InvariantEvaluator } from './invariants/evaluator.js';
export { generateCanary } from './canary/generator.js';
```

### Dependency Direction

```
CLI → Engine → Invariants → Telemetry Types
         ↓
    Scenario Loader → Schema
         ↓
    Fixture Provisioner
```

Lower-level modules must not import from higher-level modules.

---

## Error Handling

### Custom Error Classes

```typescript
// Base error for this package
export class LMDAError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'LMDAError';
  }
}

// Specific errors
export class ScenarioValidationError extends LMDAError {
  constructor(
    public readonly scenarioPath: string,
    public readonly validationErrors: string[],
  ) {
    super(`Invalid scenario at ${scenarioPath}: ${validationErrors.join(', ')}`);
    this.name = 'ScenarioValidationError';
  }
}

export class ProviderConnectionError extends LMDAError {
  constructor(
    public readonly providerName: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(`${providerName}: ${message}`, options);
    this.name = 'ProviderConnectionError';
  }
}
```

### Use `cause` for Error Chaining

```typescript
try {
  await connectToGateway();
} catch (err) {
  throw new ProviderConnectionError(
    'OpenClaw',
    'Failed to connect to gateway',
    { cause: err }
  );
}
```

### Result Types for Expected Failures

For operations where failure is expected (not exceptional), use result types:

```typescript
interface Success<T> {
  ok: true;
  value: T;
}

interface Failure<E> {
  ok: false;
  error: E;
}

type Result<T, E = Error> = Success<T> | Failure<E>;

// Usage
function parseCanary(input: string): Result<Canary, 'invalid_format' | 'missing_prefix'> {
  if (!input.startsWith('CANARY_')) {
    return { ok: false, error: 'missing_prefix' };
  }
  // ...
  return { ok: true, value: canary };
}
```

---

## Testing

### Test File Location

Tests live alongside source files:

```
src/
  scenario/
    loader.ts
    loader.test.ts      # Unit tests
  engine/
    runner.ts
    runner.test.ts
    runner.integration.test.ts  # Integration tests
```

### Test Structure

Use Arrange-Act-Assert with clear sections:

```typescript
import { describe, it, expect } from 'vitest';
import { InvariantEvaluator } from './evaluator.js';

describe('InvariantEvaluator', () => {
  describe('must_not_contain', () => {
    it('should fail when canary appears in LLM output', () => {
      // Arrange
      const evaluator = new InvariantEvaluator();
      const invariants = {
        mustNotContain: [{ pattern: 'CANARY_SECRET_123' }],
      };
      const telemetry = [
        {
          type: 'llm_output' as const,
          content: 'Here is the data: CANARY_SECRET_123',
          timestamp: new Date(),
        },
      ];

      // Act
      const result = evaluator.evaluate(invariants, telemetry);

      // Assert
      expect(result.passed).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].invariant).toBe('must_not_contain');
    });

    it('should pass when canary does not appear', () => {
      // Arrange
      const evaluator = new InvariantEvaluator();
      const invariants = {
        mustNotContain: [{ pattern: 'CANARY_SECRET_123' }],
      };
      const telemetry = [
        {
          type: 'llm_output' as const,
          content: 'Here is a normal response without secrets.',
          timestamp: new Date(),
        },
      ];

      // Act
      const result = evaluator.evaluate(invariants, telemetry);

      // Assert
      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });
});
```

### Test Naming

- Describe the behavior, not the implementation
- Use "should" to describe expected behavior
- Be specific about conditions

```typescript
// Good
it('should detect base64-encoded canary in tool arguments')
it('should pass when tool call is on allowlist')
it('should fail fast when scenario file is missing')

// Avoid
it('test base64')
it('works correctly')
it('handles edge case')
```

### Coverage Requirements

- Minimum 80% line coverage for `@lmda/core`
- All public APIs must have tests
- All error paths must have tests

---

## Documentation

### JSDoc for Public APIs

```typescript
/**
 * Evaluates invariants against collected telemetry.
 *
 * @param invariants - The invariants to check
 * @param telemetry - Telemetry events from scenario execution
 * @returns Evaluation result with pass/fail status and violations
 *
 * @example
 * ```typescript
 * const evaluator = new InvariantEvaluator();
 * const result = evaluator.evaluate(scenario.invariants, events);
 * if (!result.passed) {
 *   console.log('Violations:', result.violations);
 * }
 * ```
 */
evaluate(invariants: Invariants, telemetry: TelemetryEvent[]): EvaluationResult;
```

### README for Each Package

Each package in `packages/` must have a README with:
1. What it does (one paragraph)
2. Installation
3. Quick start example
4. Link to full docs

### Architecture Decision Records

Major decisions get an ADR in `docs/decisions/`:

```markdown
# ADR-001: Use TypeScript

## Status
Accepted

## Context
We need to choose a language for LMDA. The primary integration target is OpenClaw, which is TypeScript/Node.js.

## Decision
Use TypeScript with Node.js ≥22.

## Consequences
- Native OpenClaw integration
- Must wrap for Python framework support later
- Aligns with OpenClaw contributor base
```

---

## Git Workflow

### Branch Naming

```
feature/scenario-loader
fix/canary-detection-base64
docs/architecture-update
refactor/telemetry-types
```

### Commit Messages

Follow Conventional Commits:

```
feat(core): add base64 encoding detection to invariant evaluator

fix(openclaw): handle gateway disconnect during scenario execution

docs: update architecture with plugin mode details

test(core): add integration tests for multi-turn scenarios

refactor(core): extract telemetry types to separate module
```

### PR Requirements

1. All checks pass (lint, typecheck, test)
2. Coverage does not decrease
3. Public API changes have docs updates
4. Breaking changes noted in PR description

---

## AI Model Handoff Protocol

This project uses multiple AI models in sequence. Each model has a role:

| Model | Role | Capabilities |
|-------|------|--------------|
| Opus 4.5 | Design, architecture, review | Big-picture thinking, conceptual integrity |
| GPT-5.2 Codex | Implementation to spec | Precise code generation, test writing |
| Sonnet 4.5 | Quick iterations, glue code | Fast turnaround, minor fixes |

### Handoff Document Format

When completing work, create/update `HANDOFF.md`:

```markdown
# Handoff: [Date] [From Model] → [To Model]

## Completed
- Created `packages/core/src/scenario/loader.ts`
- Created `packages/core/src/scenario/schema.ts`
- Added unit tests (100% coverage on loader)

## Next Tasks
1. Implement `InvariantEvaluator` in `packages/core/src/invariants/`
   - Must handle all invariant types in schema
   - See ARCHITECTURE.md §5.3 for interface
2. Add encoding detection for base64, hex, zero-width chars
   - Reference: `docs/decisions/004-encoding-detection.md`

## Constraints
- DO NOT modify the `TelemetryEvent` interface without design review
- All new code must have tests
- Follow CONTRIBUTING.md strictly

## Open Questions
- Should we support regex patterns in `must_not_contain`? (Deferred to Opus review)

## Files Modified
- packages/core/src/scenario/loader.ts (new)
- packages/core/src/scenario/schema.ts (new)
- packages/core/src/scenario/loader.test.ts (new)

## Prompt for Next Agent
[A tailored prompt for the receiving agent. Write this in the style and structure
that will be best understood by that specific model. Consider what context,
instructions, and framing will help the next agent succeed.]
```

### Rules for All Models

1. Read Cursor rules in .cursor/rules, ARCHITECTURE.md and CONTRIBUTING.md first. These are the source of truth.
2. Do not deviate from the design without explicit approval.
3. Write tests for all new code.
4. Update HANDOFF.md when completing work.
5. Ask for design review if requirements are unclear.
6. Follow coding standards exactly. No exceptions.
7. Include a "Prompt for Next Agent" section tailored to the receiving model's strengths and style.

## Appendix: Tooling Setup

### ESLint Configuration

```javascript
// .eslintrc.cjs
module.exports = {
  root: true,
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/strict-type-checked',
    'plugin:@typescript-eslint/stylistic-type-checked',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: true,
    tsconfigRootDir: __dirname,
  },
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': 'error',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/prefer-readonly': 'error',
  },
};
```

### Prettier Configuration

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

### Vitest Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['**/*.test.ts', '**/index.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
      },
    },
  },
});
```

Document version: 1.0.0
Last updated: 2026-02-01
