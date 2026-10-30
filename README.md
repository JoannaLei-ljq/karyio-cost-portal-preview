# Karyio Cost Planning — Preview v0.2

Sanitized static preview of an internal cost-planning tool. Figures are planning estimates built from public prices and assumed usage. They are not bills, quotes or production measurements.

## Structure

```
index.html         six sections, hash-routed (#overview, #simulator, #breakdown, #architecture, #assumptions, #validation)
assets/model.js    the cost model: prices, assumptions, presets, month(), sensitivity. Every number comes from here
assets/charts.js   inline-SVG chart helpers
assets/map.js      Architecture Map: grouped system map, feature flows, cost inventory, future features
assets/gate.js     team password screen
assets/app.js      routing, shared state, scenario links, page rendering (incl. Cost Breakdown)
assets/portal.css  styles (light/dark, mobile)
```

No build step, no dependencies, no external scripts, fonts or analytics.

## Preview locally

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

Then open http://localhost:8765/. The password screen needs `localhost` or `https://`, because the browser's hashing API isn't available on other plain-http addresses.

## Password gate

A simple team password screen. It is a courtesy screen, not security: this repository and every file on the site are public, so anyone can read the content without the password. Don't put anything on the site that must stay confidential.

- The page stores only a SHA-256 hash of `karyio-portal-v1:` + password (`GATE_HASH` in `assets/gate.js`).
- A successful entry is remembered for the browser tab's session (`sessionStorage`).
- To change the password:

  ```bash
  printf '%s' 'karyio-portal-v1:NEW-PASSWORD' | shasum -a 256
  ```

  Paste the hex into `GATE_HASH`, then commit and push. People who are already unlocked stay unlocked until they close the tab.

## Updating

Edit the files, preview locally, then commit and push to `main`. GitHub Pages redeploys in about a minute.
Keep `month()` in `model.js` identical to the internal simulator, and check parity after changes (Small pilot base month 1 = $148.98 at the 2026-10-28 defaults).

## Scenario links

"Copy scenario link" encodes only the inputs, prices and assumptions that differ from the defaults into the URL fragment (`#page?cfg=…`). Fragments aren't sent to the server. Decoded values are type-checked and clamped. Links still work behind the password screen: the scenario is applied after unlocking.
