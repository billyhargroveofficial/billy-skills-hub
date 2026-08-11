---
name: "singbox-vpn"
description: >-
  Operate and maintain the user's hand-rolled sing-box VPN on this Mac: TUN split-routing to a Hysteria2 server, TUN-only with no local proxy ports. Use when the user wants to start, stop, background, kill, add direct exceptions, or debug why a site will not open through sing-box.
---

# sing-box VPN (macOS client)

Hand-rolled **sing-box 1.13** on the user's Mac, binary is **brew** (`/opt/homebrew/bin/sing-box`,
1.13.12 — not bundled). TUN does transparent split-routing, **INVERTED** as of 2026-06-03:
**everything → the VPN server EXCEPT a small direct-exceptions list**; selected Cloudflare-problem AI
domains go to a WARP endpoint. **No local SOCKS/HTTP inbounds** — `tun-in` is the only inbound
(ports 2080–2083 removed 2026-06-03).

**Default transport = Hysteria2** (`proxy` outbound → `91.201.114.192:36712`), single process.
A 2026-06-05 experiment swapped it for a **local Xray** doing VLESS-PQ-XHTTP-REALITY (sing-box can't do
xhttp / PQ-encryption `mlkem768x25519plus` / mieru / AmneziaWG2 — those are Xray/mihomo-only) via SOCKS
`127.0.0.1:2090`, but it was **reverted 2026-06-06**: PQ-XHTTP worked for small transfers yet **froze on
large ones** (YouTube, claude.ai, Telegram video) — the 16KB-freeze (TCP-TLS to a foreign DC IP gets
throttled; hy2/UDP dodges it). `~/sing-box/xray-config.json` is kept for a future xmux-tuning attempt
(to re-try: start xray, swap `proxy`→`socks`@127.0.0.1:2090, set dns-remote `type:tcp`).
**QUIC is rejected** (`{ "protocol":"quic", "action":"reject" }` right after hijack-dns) — Safari +
Cloudflare (claude.ai) push HTTP/3 over UDP, flaky through the tunnel → intermittent "couldn't connect"
+ slow first load; rejecting forces reliable TCP/HTTP2.
**Cloudflare WARP endpoint** (`endpoints[].tag:"warp"`, `detour:"proxy"`) is used only for rule-sets
`midjourney`, `claude`, and `gemini`, to dodge Cloudflare managed challenge on datacenter IPs.
`chatgpt`/OpenAI is explicitly routed to `proxy` (Hysteria2) as of 2026-08-05: the WARP egress got a
Cloudflare managed challenge/HTTP 429 on Codex Apps MCP `/backend-api/ps/mcp`, while an authenticated
MCP `initialize` through Hysteria2 returned HTTP 200 with a valid handshake.

**Direct exceptions (NOT tunneled):** `ip_is_private` (LAN/localhost), `protocol: bittorrent`,
and rule-sets `ru-inside` (geosite-ru-available-only-inside), `yandex` (geosite + geoip), `steam`
(geosite), `valve` (geoip — Dota/CS game servers, see below), plus service exceptions like `avito`,
`cian`, `bybit`, `vseinstrumenti`, `kimi`, `samokat`, `boosty`, and `search` (source rule-set
`rule-sets/search.json` — search-engine domains duckduckgo/google-search/bing/brave/startpage/mojeek/
qwant/ecosia routed residential so the LOCAL SearXNG MCP + ddgs dodge datacenter CAPTCHAs; added 2026-07-24). WARP rule-sets go → `warp`;
everything else → `proxy`.

Full human docs + config backup live in `~/Documents/billynotes/vpn/clients/singbox-mac/`
(`README.md`, `CONFIG.md`, `config.json`, `config-allproxy.json`). Keep them and this skill in sync after changes.

## Layout (`/Users/billy/sing-box/`)
```
config.json             # normal split-routing profile; rule-set paths are RELATIVE -> MUST run with -D = repo root
config-allproxy.json    # temporary all-proxy profile: no direct rule-sets, only LAN/localhost direct
rule-sets/              # *.srs plus source *.json rule-sets, including WARP AI-domain rules
warp/                   # wgcf-account.toml + wgcf-profile.conf for the WARP endpoint
```
No `bin/` (uses brew sing-box), no `scripts/` (the user runs it by hand — deleted 2026-06-03),
not a git repo. Just `config.json`, `config-allproxy.json` + `rule-sets/`.

## Endpoints / credentials
- **ACTIVE: outbound `proxy` = Hysteria2** → `91.201.114.192:36712`, pwd
  `OVRYXjQV052HLJ32rW5hHjpRhdsmbXge`, obfs salamander `PfPYhe7HEg4NKudi`, sni
  `v648658.hosted-by-vdsina.com`, insecure. `dns-remote` = UDP 8.8.8.8 via `detour:proxy`;
  `final: proxy`. Outbounds = `proxy` + `direct`; endpoint = `warp`; `tun-in` is the only inbound
  (mixed ports 2080–2083 + US/KZ/GE socks removed 2026-06-03).
- **ACTIVE: endpoint `warp` = Cloudflare WARP WireGuard**. wgcf profile is in
  `/Users/billy/sing-box/warp/wgcf-profile.conf`; current `PrivateKey`/`Address` are copied into
  `endpoints[].tag="warp"` in both configs. The WARP endpoint has `detour:"proxy"`, so the WARP
  handshake rides hy2 rather than going direct from RU.
- **OLD server #2 fallback:** `89.124.90.41:58329` pwd `9icMjz8Qg2hjnly7xkJ233bYeD4pXvGQ`, obfs
  `I84hNRWvM3WNzhUk`, sni `v741563.hosted-by-vdsina.com`.
- **PARKED: Xray VLESS-PQ-XHTTP-REALITY** (config `~/sing-box/xray-config.json`, binary = v2rayN's bundled
  `~/Library/Application Support/v2rayN/bin/xray/xray` 26.5.9): VLESS+REALITY+XHTTP+PQ to `89.124.90.41:47843`,
  SOCKS5 `127.0.0.1:2090`. uuid `fc2d3c8a-1465-4bf4-814a-035b851c0f07`, sni/host `www.google.com`,
  pbk `ImL0sChrUwbEcWqO0IllLF5Sa1j_t7t_64a6eYA4fQ8`, sid `6af0f3ec1504cac3`, fp chrome, path `/790238afd392`,
  mode auto, encryption `mlkem768x25519plus.native.0rtt.<token>`. Reverted (16KB-freeze on big transfers).
- Claude Code's `settings.json` `HTTP(S)_PROXY → 127.0.0.1:2080` env was **removed** — Claude's API rides
  the TUN. ⚠️ So **sing-box must be running** for Claude (and everything) to reach the net from RU; if
  connectivity dies, check `pgrep -fl "sing-box run"` first.

## Run / stop — the user runs it BY HAND (no scripts). TUN needs root.
Zsh aliases in `~/.zshrc`: `von` starts normal `config.json`, `vall` starts
`config-allproxy.json`, and `voff` stops sing-box.
Single process (Hysteria2 transport):
```bash
# START (sudo, TUN):
sudo zsh -c 'nohup sing-box run -c /Users/billy/sing-box/config.json -D /Users/billy/sing-box > /tmp/sing-box.log 2>&1 &'
pgrep -fl "sing-box run"            # alive? shows PID
tail -f /tmp/sing-box.log           # watch log
# STOP:
sudo pkill -f "sing-box run"        # SIGTERM — removes TUN cleanly; NEVER -9
```
All-proxy variant (keeps only `ip_is_private -> direct`; no RU/Yandex/Steam/service direct exceptions):
```bash
sudo zsh -c 'nohup sing-box run -c /Users/billy/sing-box/config-allproxy.json -D /Users/billy/sing-box > /tmp/sing-box.log 2>&1 &'
```
(Reviving the parked Xray transport = TWO processes: start xray FIRST —
`nohup "/Users/billy/Library/Application Support/v2rayN/bin/xray/xray" run -c /Users/billy/sing-box/xray-config.json >/tmp/xray.log 2>&1 &`
— then sing-box; stop sing-box then `pkill -f "xray run"`. Test xray alone: `curl -x socks5h://127.0.0.1:2090 https://api.ipify.org`.)
Foreground variant (see log live, Ctrl+C to stop):
`sudo sing-box run -c /Users/billy/sing-box/config.json -D /Users/billy/sing-box`
Validate before running: `sing-box check -c /Users/billy/sing-box/config.json -D /Users/billy/sing-box`
or `sing-box check -c /Users/billy/sing-box/config-allproxy.json -D /Users/billy/sing-box`
⚠️ Claude **cannot** start/stop it — TUN needs `sudo` and the password is interactive. Hand the user
the command above (e.g. via the `! ` prompt prefix) and let them run it.
⚠️ The binary is **`sing-box`** (hyphen) — `pkill -f "sign box"`/"signbox" matches nothing.
⚠️ Without `-D` (or cwd=repo) the relative rule-set paths fail to load → run errors.

## Before first run each session (prerequisites)
```bash
# 1. Quit v2rayN fully (Clear system proxy → Quit) — two TUNs conflict.
# 2. DNS MUST go through the tunnel, else DNS-blocked domains (e.g. proton.me) fail to resolve:
networksetup -setdnsservers "Wi-Fi" 8.8.8.8        # (revert: ... "Wi-Fi" Empty)
# 3. Kill IPv6 (stack is v4-only):
sudo networksetup -setv6off Wi-Fi                  # (revert: -setv6automatic)
```

## Verify it's working
TUN tunnels everything, so a plain curl shows the VPN exit (no local port exists):
```bash
curl https://api.ipify.org      # → 91.201.114.192 (NL) when sing-box is up
curl https://www.midjourney.com/cdn-cgi/trace | grep -E 'warp=|loc='  # → warp=on for WARP-routed domains
```

## Add a direct-exception category (geosite/geoip from runetfreedom)
The list is the set of things kept OFF the tunnel. To add one (e.g. another RU service):
Rule source: repo `runetfreedom/russia-v2ray-rules-dat`, branch `release`,
`sing-box/rule-set-geosite/geosite-<name>.srs` (domains) or `rule-set-geoip/geoip-<name>.srs` (IPs).
Download with sing-box RUNNING (raw.githubusercontent is blocked from RU, but TUN tunnels it via hy2):
```bash
cd /Users/billy/sing-box/rule-sets
BASE="https://raw.githubusercontent.com/runetfreedom/russia-v2ray-rules-dat/release/sing-box"
curl -fsSL "$BASE/rule-set-geosite/geosite-<name>.srs" -o geosite-<name>.srs
```
(No `-x` proxy — there's no local port anymore; TUN routes raw.githubusercontent through the VPN.)
Then wire the **tag in 3 places** in `config.json`:
1. `route.rule_set` — add a definition: `{ "type":"local", "tag":"<name>", "format":"binary", "path":"rule-sets/geosite-<name>.srs" }`
2. `route.rules` (the rule whose `outbound` is **`direct`**) — add `"<name>"` to its `rule_set` array
3. `dns.rules` (the rule → `dns-local`) — add `"<name>"` to its `rule_set` array **(geosite only; for geoip-* skip DNS)**
Then `sing-box check` → restart.
> To push something INTO the tunnel instead: it already is — `final: proxy` tunnels everything by default.
> You only ever add things to the DIRECT exception list.

## Dota 2 / Steam game servers — MUST be geoip, not geosite (`valve` exception)
Dota/CS match traffic uses **Steam Datagram Relay (SDR)**: UDP to Valve relay IPs with **no DNS** →
a `geosite` (domain) rule never sees it. If it falls to `final: proxy` the match goes through NL and
ping dies. All Valve relays + game servers are announced from **AS32590 (Valve Corporation)** — so
"every server covered" = the whole AS32590 routed `direct`. runetfreedom has **no** geoip-steam/valve
(only country codes + cloudflare/google/telegram/yandex/…), so it's hand-built:
`rule-sets/valve-ip.json` (`format:"source"`, tag `valve`, wired into the direct rule; **no DNS rule**
— it's IP-based). Aggregated Valve blocks (cover all currently-announced AS32590 /24s + robust to churn).
**Refresh the ranges** (every few months, sing-box running):
```bash
curl -s "https://stat.ripe.net/data/announced-prefixes/data.json?resource=AS32590" \
  | grep -oE '"prefix": *"[^"]+"' | sed 's/.*: *"//;s/"//' | grep -vE ':' | sort -u
# each announced /24 should fall inside a block already in valve-ip.json; if a NEW parent block
# appears, add it to rules[].ip_cidr and restart. (IP not announced by AS32590 = no reachable Valve server.)
```

## The user's OWN domains (my-rules.json was DELETED 2026-06-03)
There is no custom domain list anymore — the user removed `my-rules.json` ("не нужон"). If they ever
want one back, recreate `/Users/billy/sing-box/rule-sets/my-rules.json` with **`format:"source"`**
(plain JSON, no compile), wire it as a tag in the **direct** rule (3 places, dns → dns-local):
```json
{ "version": 3, "rules": [ { "domain_suffix": ["example.com"] } ] }
```
`domain_suffix` = domain + subdomains; `domain` = exact; `domain_keyword` = substring.

## How config.json works (route rules, top→bottom) — INVERTED
`sniff` (get domain + detect bittorrent) → `hijack-dns` (DNS into sing-box module) →
`protocol:quic→reject` → `rule_set[chatgpt]→proxy` → `rule_set[midjourney, claude, gemini]→warp` →
`ip_is_private→direct` → `protocol:bittorrent→direct` →
`rule_set[ru-inside, yandex, yandex-ip, steam, valve, avito, cian, bybit, vseinstrumenti, kimi, samokat, boosty, search]→direct` → **`final: proxy`** (everything else).
DNS: `dns.final = dns-remote` (8.8.8.8 via hy2, anti-poisoning) for all tunneled traffic;
the domain exceptions (ru-inside, yandex, steam, avito, cian, bybit, vseinstrumenti, kimi, samokat, boosty, search) → `dns-local` (resolve to nearest/local node);
WARP domains are NOT in `dns-local`, so they resolve via `dns-remote`; `strategy: ipv4_only`;
`default_domain_resolver = dns-remote`. Don't use sing-box's built-in `set_system_proxy` — bug #3529
crashes with TUN on macOS 26.

## Troubleshooting playbook
- **A normally-tunneled site won't open, but others work.** It's probably falling into a direct
  exception (geoip-yandex / ru-inside catching it), or DNS poisoning. Check: does it match an
  exception rule-set? If it's an IP-only app, the geoip exception may be too broad.
- **A RU site (bank/gov) breaks.** It's being tunneled (foreign IP) when it should be direct — add it
  to the direct exceptions: `geosite` (domain) is usually enough; if the app hits hardcoded IPs with no
  DNS, add a `geoip-*` exception too (geosite=match by domain, geoip=match by IP).
- **ALL direct/RU-exception sites break at once, tunneled sites are fine** — `direct` outbound has no
  `bind_interface`. Symptom: Yandex (incl. Disk), ya.ru, avito, steam ALL fail identically — TCP connects
  (`curl` shows a `remote_ip`) but the TLS handshake / page stalls then resets (`SSL_ERROR_SYSCALL`);
  even plain `http://` on port 80 dies fast. Meanwhile everything *through* the VPN loads perfectly, and
  the site is alive from the exit (`ssh root@<server> 'curl -sI https://disk.yandex.ru'` → `302`).
  **Cause:** `auto_route` installs `0/1`+`128.0/1` routes shoving the whole IPv4 space into the TUN
  (`gw 172.19.0.1`); a `direct` socket with no explicit interface follows them straight back INTO the TUN
  → routing loop → re-enters sing-box. The TCP handshake squeaks through but data loops and dies. The VPN
  outbound works *because* it already carries `"bind_interface": "en0"`. **Fix:** add
  `"bind_interface": "en0"` to the **`direct`** outbound too, `sing-box check`, restart. **Diagnose:**
  `route -n get <RU-IP>` shows `interface: utun*` / `gateway: 172.19.0.1` = will loop;
  `netstat -rn -f inet | grep -E '0/1|128.0/1'` shows the two /1 routes parked on the TUN. (Hit & fixed
  2026-06-09; en0 = active Wi-Fi — use the real default iface from `route -n get default`.)
- **"Could not resolve host" / SERVFAIL for a blocked domain (e.g. proton.me).** DNS is going to the
  local router (`192.168.1.1`), which sing-box does NOT intercept (local subnet excluded from auto_route).
  Fix: `networksetup -setdnsservers "Wi-Fi" 8.8.8.8` (a non-local resolver gets routed through TUN → hijacked).
  Confirm with `nslookup <domain> 8.8.8.8` (should return a real IP).
- **Small pages load, big ones freeze (~16-18KB then timeout).** The classic RU **16KB-freeze** — TSPU
  throttles TLS to a foreign datacenter IP on a DIRECT RU→foreign path. (Not an issue for hy2 itself —
  it's obfuscated.) If you ever add a plain SOCKS outbound to a foreign DC, chain it through the server
  with **`"detour": "proxy"`** so RU→server is obfuscated Hysteria2.
- **FATAL `detour to an empty direct outbound makes no sense`.** A DNS server (or outbound) has
  `detour:"direct"`. Remove the detour line — direct is the default path anyway.
- **FATAL `configure tun interface: operation not permitted`.** TUN needs root — run with `sudo`.
- **`sing-box check` says OK but `run` fails.** check misses runtime-semantic errors. Validate by running
  **without sudo**: it passes DNS/outbounds/route and fails ONLY at TUN (operation not permitted) = rest is fine.
- **ALL connections timeout with "no recent network activity" the moment sing-box starts.** Every outbound
  through `proxy` fails immediately (sub-second to few-second timeouts). The Hysteria2 tunnel itself never
  establishes, so nothing goes through. **First check if the issue is server-side:**
  1. Test the server with a minimal non-TUN config (SOCKS inbound → hy2 outbound, no `sudo`):
     ```bash
     cat > /tmp/sing-test.json << 'EOF'
     {"log":{"level":"debug","timestamp":true},"inbounds":[{"type":"mixed","tag":"in","listen":"127.0.0.1","listen_port":12080}],"outbounds":[{"type":"hysteria2","tag":"proxy","bind_interface":"en0","server":"<IP>","server_port":<PORT>,"password":"<PW>","obfs":{"type":"salamander","password":"<OBFS>"},"tls":{"enabled":true,"server_name":"<SNI>","insecure":true}},{"type":"direct","tag":"direct"}],"route":{"rules":[{"inbound":"in","outbound":"proxy"}],"final":"proxy"}}
     EOF
     sing-box run -c /tmp/sing-test.json &
     sleep 2
     curl -x socks5h://127.0.0.1:12080 https://api.ipify.org
     kill %1
     ```
     If this works → the hy2 transport + credentials are fine, the issue is **server-side listener hung**:
     `ssh root@<IP> 'systemctl restart xray'` (or `hysteria-server` if standalone). Verify with
     `ss -ulnp | grep <PORT>`.
  2. If the minimal test also fails → check UDP reachability: `nc -u -w 3 <IP> <PORT>` (UDP is connectionless,
     `nc` just sends; no response is normal). Ping the server. If ping OK but UDP dead → ISP blocking QUIC/UDP.
  3. If the server is running standalone `hysteria-server` (not inside xray): `pgrep -fl hysteria` should show
     the process; restart with `systemctl restart hysteria-server`.
  4. The xray-internal hysteria2 listener can silently hang (process stays up, port shows in `ss -ulnp`, but
     new QUIC handshakes are ignored). Restart fixes it. Hit & fixed 2026-06-18 on server #1.
- **Safari slow to load / claude.ai "couldn't connect to Claude" intermittently.** Browsers + Cloudflare
  (claude.ai) push QUIC/HTTP3 over UDP, which is flaky/slow through the tunnel → Safari stalls waiting on
  QUIC then falls back to TCP. Fix = **reject QUIC** so it falls back instantly: `{ "protocol":"quic",
  "action":"reject" }` right after hijack-dns (in the config since 2026-06-06). If slow-first-load persists
  after that, suspect plaintext DNS to 8.8.8.8 (direct from RU, throttled) → consider encrypted DNS.
- **Codex starts with `MCP client for codex_apps failed` + HTTP 429 Cloudflare HTML.** Test the authenticated
  Apps MCP path through both AI routes. On 2026-08-05 WARP (`warp=on`, NL) returned a managed challenge,
  while the same Bearer/account request through Hysteria2 returned a valid HTTP 200 MCP handshake. Keep
  `chatgpt` on the explicit `proxy` rule before the WARP rule; do not disable Codex `features.apps` merely
  to hide this routing failure.
- **Editing config has no effect.** Rule-sets/config are read only at start — restart sing-box.

## After any change
Run `sing-box check`, restart (the user's manual `sudo zsh -c 'nohup sing-box run ...'` / `sudo pkill`),
then sync the backup + docs:
`cp /Users/billy/sing-box/config.json /Users/billy/sing-box/config-allproxy.json ~/Documents/billynotes/vpn/clients/singbox-mac/`
and copy `/Users/billy/sing-box/rule-sets/*` into
`~/Documents/billynotes/vpn/clients/singbox-mac/rule-sets/`. Update README.md/CONFIG.md there if behavior changed.
Keep Claude memory `singbox-mac-setup` current.
