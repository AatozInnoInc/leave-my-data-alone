# Scenario Templates

Starter templates for writing your own LMDA security scenarios.

## Available Templates

| Template | Attack Class | Description |
|----------|-------------|-------------|
| `indirect-injection.template.yaml` | Indirect prompt injection | Tests agent resistance to malicious instructions in retrieved content |
| `tool-coercion.template.yaml` | Tool-call coercion | Tests whether agents can be tricked into unauthorized tool calls |
| `canary-leak.template.yaml` | Data exfiltration | Tests for canary token leaks via outputs or encoded channels |

## Usage

1. Copy the template that matches your attack scenario
2. Replace all `REPLACE_ME` and `YOUR-*` placeholder values
3. Update the `attack` section with your specific prompt
4. Adjust `invariants` to match your expected security boundaries
5. Run with `lmda validate <your-file>.yaml` to check structure
6. Run with `lmda run <your-file>.yaml --provider <provider>` to execute

## Writing Good Scenarios

- Use unique, high-entropy canary values (or let LMDA generate them)
- Test one attack vector per scenario
- Start with `severity: high` and adjust based on actual risk
- Tag scenarios for filtering during test runs
- Keep attack prompts realistic to catch real-world vulnerabilities
