# One Block to Rule Them All

A Manifest V3 extension for **Brave on desktop**. Protect your attention with two website lists:

- **Always blocked:** navigation is replaced with a local blocked page and a randomly selected Lord of the Rings book quote. There is no continue button.
- **Pause before entering:** a local page waits 30 seconds before enabling **Continue with intention**. Navigation requires a click; the page never proceeds automatically.

Approval applies to that domain and its subdomains in that tab until you navigate away. A different tab needs its own pause. Reloading the pause page preserves the original deadline. Closing the tab, restarting Brave, or saving settings revokes approvals. Always-blocked domains take priority over approvals, including more specific subdomains.

## Install in Brave

1. Open `brave://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this repository's **extension** folder.
4. Open the extension's toolbar popup and click **Manage my websites** (pin it using Brave's extensions menu if useful).
5. Enter one domain per line in either list, then click **Save my paths**.
6. Open a configured website to try it.

Use `reddit.com`, for example. This also covers `www.reddit.com` and other subdomains, but not `notreddit.com`. Full HTTP/HTTPS URLs with only a trailing slash are accepted and normalized. Paths, query strings, ports, credentials, and wildcards are rejected. International domain names are supported. Lists start empty; the combined limit is 500 domains.

Changes affect subsequent navigations; they don't close or replace pages already open. After updating extension files, click **Reload** on its card in `brave://extensions` and reopen its pages. Incognito requires enabling **Allow in Incognito** in Brave's extension details.

## Development

Runtime: **Node.js 22 or newer** for development scripts. The extension itself is plain HTML, CSS, and JavaScript with no runtime dependencies, bundler, or remote assets. No dependency installation is needed to run, test, or build it.

```sh
npm test                         # complete deterministic test suite
node --test test/core.test.js    # domain matching and rule compilation
node --test test/background.test.js # worker authorization and cooldown flow
npm run lint                     # JS syntax and JSON validation
npm run build                    # copies extension into dist/one-block
npm run format                   # standard Prettier formatter
npm run format:check              # check formatting
```

Formatting uses pinned Prettier 3.6.2 through `npx`; it requires registry access on first use. Configuration is in `.prettierrc.json`. `lint` is a lightweight syntax check, not a semantic linter. To run locally, load the `extension/` directory in Brave as above. To use the build, load `dist/one-block` instead. Generated output is ignored.

## Structure

- `extension/manifest.json`: permissions and entry points.
- `extension/core.js`: domain validation, matching, and redirect rule compilation.
- `extension/background.js`: settings, declarative rules, cooldown enforcement, and per-tab approvals.
- `extension/options.*`, `popup.*`: configuration and toolbar UI.
- `extension/gate.*`, `quotes.js`, `style.css`: block/pause page and locally bundled quotations.
- `test/`: Node tests with an in-memory Chrome API mock; no network or real waiting.
- `scripts/`: validation and build scripts.

## Privacy and behavior

Settings use `chrome.storage.local`. Temporary deadlines and approvals use `chrome.storage.session`. There are no analytics, accounts, cloud sync, external fonts, or runtime quote requests. The two short book quotations, chapter attributions, and verification sources are bundled in `extension/quotes.js`. They are from *The Fellowship of the Ring*, Book I: Gandalf in Chapter 2, ‘The Shadow of the Past’, and Bilbo’s poem in Chapter 10, ‘Strider’. Sources: [Gandalf’s dialogue](https://www.sparknotes.com/lit/fellowship/quotes/) and [The Riddle of Strider](https://tolkiengateway.net/wiki/Riddle_of_Strider). No movie-only quotations are included. This is an unofficial fan project.

HTTP/HTTPS host access and `declarativeNetRequest` allow the browser to redirect configured top-level requests before loading them. `storage` saves settings and temporary tab state; `webNavigation` revokes approval after leaving a site. No content script reads pages. Quote selection and rendering happen entirely locally. **Choose another path** opens Brave Search only after you click it.

The cooldown is checked in the service worker, not just enforced by disabling a UI button. It uses a wall-clock deadline, so time spent in other tabs counts. It is an attention aid, not a tamper-proof restriction: users can edit settings, change their system clock, or disable the extension. It handles HTTP/HTTPS top-level navigations; browser internal pages, embedded frames, and installed apps are outside its scope. Original URL paths and queries are retained; fragment-only anchors may be lost because network redirects cannot reliably observe them.

Implementation references: [Chrome declarativeNetRequest](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest) and [Brave extension support](https://support.brave.com/hc/en-us/articles/360017909112-How-can-I-add-extensions-to-Brave).

## Manual browser verification

The automated tests mock browser APIs. Before publishing, check in desktop Brave:

1. Block `example.com`, visit it and a subdomain, and confirm a quote appears with no Continue action. Unrelated domains should work.
2. Put `example.org` on cooldown. Confirm Continue stays disabled for 30 seconds, no automatic navigation occurs, and a click returns to the original path/query.
3. Reload during the pause; confirm the deadline persists. Try a second tab; it needs a separate wait.
4. After approval, follow another page on that domain, then leave for another site and revisit. A new pause should start.
5. Add a blocked subdomain of a cooldown domain. Even with an approval for the parent, the subdomain must remain blocked.
6. Check invalid entries, saving and reopening settings, browser restart, tab close, and settings edits during a countdown.
