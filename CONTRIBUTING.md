# Contributing to Aurelia Telegram

Thank you for your interest in contributing!

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/aurelia-telegram.git`
3. Install dependencies: `npm install`
4. Create a branch: `git checkout -b feature/your-feature`

## Development

```bash
npm run build      # Build with tsup
npm run dev        # Build in watch mode
npm test           # Run tests
npm run lint       # Lint source code
npm run typecheck  # TypeScript type checking
```

## Code Standards

- **TypeScript strict mode** with `noUncheckedIndexedAccess`
- **ESM only** — use `.js` extensions in imports
- Follow existing patterns in the codebase
- Add unit tests for new functionality
- Ensure `npm test`, `npm run lint`, and `npm run typecheck` pass

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat: add new feature`
- `fix: resolve bug`
- `docs: update documentation`
- `test: add tests`
- `chore: maintenance tasks`
- `refactor: code restructuring`

## Pull Requests

1. Ensure all tests pass
2. Update documentation if needed
3. Describe your changes in the PR description
4. Link related issues

## Project Structure

```
src/
  bot/         # Telegram bot (grammY)
  cli/         # CLI (Commander.js)
  config/      # Configuration & encryption
  kimi/        # Kimi auth, client, translator
  bridge/      # Claude Code CLI bridge
  core/        # Pipeline engine
  session/     # User session management
  utils/       # Shared utilities
tests/
  unit/        # Unit tests (mirrors src/ structure)
```

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
