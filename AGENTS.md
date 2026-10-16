# Repository Guidelines

## Structure

This project is a dependency-free Manifest V3 extension for desktop Brave. `extension/` is directly loadable; it contains the worker, pure domain/rule logic, options UI, popup, local gate page, and bundled quotes. `test/` contains Node tests. `scripts/` contains syntax validation and build scripts. Keep related code together; place future static assets in `extension/assets/`. Do not commit `dist/` or dependency caches.

## Commands

Use Node.js 22+. No installation is required for runtime, tests, or build. See `README.md` for installation in Brave and browser verification.

- `npm test`: complete suite; `node --test test/core.test.js` for an individual file.
- `npm run lint`: JavaScript syntax and JSON checks.
- `npm run build`: copies the extension into ignored `dist/one-block`.
- `npm run format` / `npm run format:check`: pinned Prettier via npx; first use needs registry access. Configuration is `.prettierrc.json`.

## Code and tests

Use descriptive camelCase JavaScript names, ES modules, and Prettier formatting. Follow existing lowercase filenames. Keep domain matching and rule compilation pure. Tests should be deterministic, independent of external services, and cover behavior and fixes. Browser API mocks do not replace the manual Brave checks documented in README. All quotes and UI resources must remain local; do not add runtime quote fetching or remote scripts.

## Reviews and security

Use concise imperative commit subjects and focused changes. PRs should describe purpose, validation, setup steps, and limitations; include screenshots for UI changes. Never commit credentials or private configuration. Validate extension message senders, enforce cooldowns in the worker, and preserve always-blocked priority over temporary allowances. Document additional permissions and dependencies.
