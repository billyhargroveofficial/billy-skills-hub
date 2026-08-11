---
name: "anticensor-vps"
description: >-
  Deploy or audit a censorship-resistant multi-protocol proxy VPS from scratch: Xray VLESS+XHTTP+REALITY+post-quantum, Hysteria2+Salamander, and AmneziaWG 2.0. Use when setting up, rolling out, or hardening an anti-DPI or anti-censorship VPN server on a fresh Linux VPS, especially for hostile networks such as Russia/RKN/TSPU, Iran, or China/GFW.
---

# Censorship-resistant multi-protocol VPS

A battle-tested playbook for standing up a 3-layer anti-DPI proxy server. Distilled from
a working RU-path deployment (VDSina, Ubuntu 24.04). Generalize the placeholders per server.

## When to use
- User wants a new proxy/VPN server that survives DPI/censorship (RU TSPU, Iran, GFW).
- Rolling the same stack onto another VPS.
- Auditing an existing server's exposure (Phase 4 alone).

## The 3-layer stack (defense-in-depth)

Run all three; if DPI learns to throttle one fingerprint, the others survive.

| Layer | Transport | Role | Strength | Weakness |
|---|---|---|---|---|
| VLESS + XHTTP + REALITY + **PQ** | TCP (HTTP/2) | primary stealth | looks like HTTPS to a real site; post-quantum | TLS-class → can hit TSPU volume-freeze on a foreign IP |
| Hysteria2 + Salamander | UDP (QUIC) | speed | brutal congestion, UDP obfs | UDP sometimes throttled |
| **AmneziaWG 2.0** | UDP (WG) | backup fingerprint | mimics QUIC/DNS (CPS), dynamic headers | narrow client support (AmneziaVPN app / WG Tunnel only) |

## ⚠️ CRITICAL gotchas — read before deploying

1. **NEVER use ports 443 or 8443 on a heavily-censored path (RU).** TSPU intercepts/redirects them
   → REALITY reports `received real certificate (MITM or redirection)` or `i/o timeout`, and no
   connection reaches the server. **Use random high ports** (20000–60000). Test the chosen port
   is not blocked on-path before committing.
2. **PQ token differs by side.** Server `decryption` = `mlkem768x25519plus.native.`**`600s`**`.<seed>`;
   client `encryption` MUST be `...native.`**`0rtt`**`.<client-pubkey>` (NOT `600s`). Wrong token →
   client refuses with `unsupported "encryption"`. Derive client pubkey: `xray mlkem768 -i "<seed>"`.
3. **REALITY `dest` must be a real TLS1.3 + HTTP/2 + X25519 site** reachable from the VPS.
   `www.google.com` is a safe default (not an AWS/s2n-tls cracker target). The dest's handshake is
   what you impersonate; SNI on the wire = `serverNames`.
4. **Xray-core does Hysteria2 server-side** (protocol `hysteria`, version 2) since 26.x — but
   Xray-core *clients* cannot do Hysteria2 *outbound*. Hysteria2 clients = sing-box / mihomo / Happ.
5. **sing-box has NO XHTTP (by design) and no VLESS-PQ.** So the XHTTP+PQ inbound is reachable only
   by **Xray-core clients** (v2rayN, v2rayNG, Happ). Hiddify/Karing/NekoBox (sing-box) can't open it.
6. **AmneziaWG 2.0 specifics** (see `scripts/install-amneziawg2.sh`):
   - Kernel module: `amnezia-vpn/amneziawg-linux-kernel-module`. `make dkms-install` **only copies
     sources** to `/usr/src/amneziawg-1.0.0`; you MUST then run `dkms add/build/install -m amneziawg -v 1.0.0`.
   - `awg-quick` (from `amneziawg-tools`, v1.0.20210914 base) reads configs from
     **`/etc/amnezia/amneziawg/`** — NOT `/etc/amneziawg/`, NOT `/etc/wireguard/`. This bites every time.
   - That tools version DOES support 2.0 params (S3/S4 + I1–I5 CPS). Verify after `up`:
     `awg show <iface>` must list `s3 / s4 / i1`.
   - **Obfuscation params (`Jc Jmin Jmax S1 S2 S3 S4 H1 H2 H3 H4 I1`) MUST be identical** on server
     and client. Generate them per-server for a unique fingerprint (the script does this).
   - **Client = AmneziaVPN app (≥4.8.12.9) or WG Tunnel (Android) ONLY.** mihomo speaks only *base*
     AWG (no I1–I5 CPS); xray/sing-box speak none.
7. **Security hygiene.** After any work, run a full `ss -tunlp` audit. Kill any unexpected listeners —
   especially no-auth proxies (we found an open `python:3128` forward proxy on a live box). A
   self-appearing open proxy is a classic post-compromise artifact → consider a compromise check.
8. **Durable full-block fallback** (not built here): if the foreign IP gets fully dropped (CIDR/IP
   mode, not just SNI-whitelist), the answer is a **domestic relay** (dokodemo-door / iptables DNAT)
   or WebRTC bypass. Keep that as a separate contingency.

## Decide upfront (per server)
- `SERVER_IP`, `HOSTNAME` (for Hysteria2 cert CN / SNI).
- Three random high ports: `XHTTP_PORT`, `HY2_PORT`, `AWG_PORT` (e.g. `shuf -i 20000-60000 -n 3`).
- Egress iface: `ip route get 8.8.8.8 | grep -oP 'dev \K\S+'` (often `ens3`/`eth0`).
- REALITY dest: `www.google.com` default (or a whitelisted domain for SNI-whitelist regions —
  verify it's a valid TLS1.3/H2 dest first).

---

## Phase 0 — host prep
```bash
apt update && apt -y upgrade
cat >> /etc/sysctl.conf <<'EOF'
net.core.default_qdisc=fq
net.ipv4.tcp_congestion_control=bbr
net.ipv4.ip_forward=1
EOF
sysctl -p
```

## Phase 1 — Xray (VLESS+XHTTP+REALITY+PQ  +  Hysteria2+Salamander)
```bash
# install core + geodata
bash <(curl -L https://github.com/XTLS/Xray-install/raw/main/install-release.sh) @ install
bash <(curl -L https://github.com/XTLS/Xray-install/raw/main/install-release.sh) @ install-geodata

# --- generate all secrets ---
xray uuid                                   # -> UUID (VLESS client id)
xray vlessenc                               # -> server `decryption` (600s) + client `encryption` (0rtt). KEEP BOTH.
xray x25519                                 # -> REALITY Private (server) + Password/Public (client pbk)
openssl rand -hex 8                         # -> shortId
openssl rand -base64 24 | tr -d '/+=' | head -c 32; echo   # -> Hysteria2 auth
openssl rand -base64 24 | tr -d '/+=' | head -c 16; echo   # -> Salamander obfs password

# --- Hysteria2 self-signed cert (client connects with insecure=1) ---
mkdir -p /usr/local/etc/xray/certs
openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes \
  -keyout /usr/local/etc/xray/certs/hy2.key -out /usr/local/etc/xray/certs/hy2.crt \
  -days 3650 -subj "/CN=$HOSTNAME"
chmod 600 /usr/local/etc/xray/certs/hy2.key
```
Fill `templates/xray-config.template.json` → `/usr/local/etc/xray/config.json`, then:
```bash
xray run -test -c /usr/local/etc/xray/config.json && systemctl enable --now xray && systemctl restart xray
```

## Phase 2 — AmneziaWG 2.0
```bash
# generates keys + unique obfuscation params + server/client configs, builds module, starts service
SERVER_IP=<ip> PORT=<awg_port> IFACE=<egress> bash scripts/install-amneziawg2.sh
# prints the client .conf at the end → import into AmneziaVPN app / WG Tunnel
```

## Phase 3 — client share-links
- **VLESS-XHTTP-PQ:** `vless://<UUID>@<IP>:<XHTTP_PORT>?encryption=mlkem768x25519plus.native.0rtt.<CLIENT_PQ_PUB>&security=reality&pbk=<REALITY_PUB>&sni=<SNI>&sid=<shortId>&fp=chrome&type=xhttp&host=<SNI>&path=%2F<path>&mode=auto#tag`
  (`CLIENT_PQ_PUB` = `xray mlkem768 -i "<seed>"`; `REALITY_PUB` = `xray x25519 -i "<priv>"`.)
- **Hysteria2:** `hysteria2://<auth>@<IP>:<HY2_PORT>/?sni=<HOSTNAME>&insecure=1&obfs=salamander&obfs-password=<pw>#tag`
- **AmneziaWG:** the `.conf` file (Phase 2 output) → import into AmneziaVPN app / WG Tunnel.

## Phase 4 — verify + security audit
```bash
ss -tunlp | grep -E ":($XHTTP_PORT|$HY2_PORT|$AWG_PORT)"          # the 3 listen
ss -tunlp | grep -E ":(443|8443|3128|10808|3389)" && echo "!!! unexpected — investigate" || echo "clean"
systemctl is-active xray awg-quick@awg0
xray run -test -c /usr/local/etc/xray/config.json
awg show awg0 | grep -E "listening port|s3|s4|i1|latest handshake"
curl -s --max-time 8 ifconfig.me                                  # == SERVER_IP
```

## Client matrix (which app opens what)
| Client | Core | XHTTP+PQ | Hysteria2 | AmneziaWG 2.0 | Notes |
|---|---|:--:|:--:|:--:|---|
| **v2rayN** (Win/mac/Linux) | Xray(+sing-box) | ✅ | ✅ | ❌ | desktop all-rounder |
| **v2rayNG** (Android) | Xray | ✅ | ❌ | ❌ | Xray-core: no Hysteria2 |
| **Happ** (all) | Xray + own Hy2 | ✅ | ✅ | ❌ | best mobile (both Xray inbounds) |
| sing-box clients (Hiddify/Karing/NekoBox) | sing-box | ❌ | ✅ | ❌ | no XHTTP, no PQ |
| **AmneziaVPN app** (all) | own (awg-go) | ❌ | ❌ | ✅ | only thing that does 2.0 CPS |
| **WG Tunnel** (Android) | awg | ❌ | ❌ | ✅ | imports raw AWG .conf verbatim |
| mihomo (Clash.Meta) | mihomo | ❌ | ✅ | base AWG only | no I1–I5 CPS |

## Troubleshooting
| Symptom | Fix |
|---|---|
| REALITY `received real certificate` / no server-side connects | port 443 intercepted → high random port |
| `i/o timeout` on 8443 | 8443 also blocked → high random port |
| client `unsupported "encryption"` | PQ token must be `0rtt` (client), not `600s` |
| `awg-quick: config does not exist` | config must live in `/etc/amnezia/amneziawg/` |
| AWG module won't load after `make dkms-install` | run `dkms add/build/install -m amneziawg -v 1.0.0` |
| AWG won't connect from mihomo/v2rayN | 2.0 CPS only in AmneziaVPN app / WG Tunnel |
| Hysteria2 fails in v2rayNG | Xray-core can't do Hy2 outbound → sing-box/mihomo/Happ |

## Research → notes upkeep (after EVERY new anti-DPI research sweep)

Circumvention tech moves monthly — a research sweep is wasted if it isn't written down.
Whenever you run a "what else can beat DPI" pass (e.g. a multi-agent sweep), you **MUST**
persist the findings in BOTH places:

**1. User's Obsidian vault — `~/Documents/billynotes/vpn/`** (keep this structure):
- `vpn/investigation/` — research. Write a dated synthesis `anti-dpi-research-<YYYY-MM-DD>.md`.
- `vpn/server/` — per-server audits / runbooks.
- `vpn/config/` — client `.conf` / `.yaml` / share-links.
- `vpn/vpn.md`, `vpn/vpn-clients.md`, `vpn/README.md` — master docs + index (update README when the file set changes).

**2. Claude memory — `~/.claude/.../memory/`:** update `proxy-server-pq` (live server state),
`anticensor-research-2026` (verdict landscape), and the `MEMORY.md` index line.

**Synthesis format** — one block per option, ranked, so verdicts stay comparable:
1. name + 1-line mechanism
2. which RU-DPI vector it defeats (TLS-fingerprint / entropy-ML / active-probe / 16KB-volume-freeze / UDP-throttle / IP-or-SNI-whitelist)
3. per-platform client support — **flag iOS explicitly** (the recurring bottleneck; most new Xray-only features are Happ-only on iOS, sing-box iOS clients can't do XHTTP/PQ/Finalmask)
4. deployability (effort, deps, needs-a-domain?)
5. verdict: **DEPLOY / EXPERIMENT-ONLY / SKIP** + one-line why
6. maturity / fragility (stars, last commit, maintainer)

**Rules:**
- **Correct, don't just append.** When a sweep changes a prior verdict (a layer matured / died / got blocked), mark the old one superseded and carry forward the current DEPLOY/EXPERIMENT/SKIP set. A stale "deployed" claim for a removed layer is worse than no note.
- Record what's **currently live vs removed** per server (port + why removed).
- Give each agent the prior sweeps' coverage so it goes *deeper/elsewhere*, not in circles.
- Latest sweeps: `vpn/investigation/anti-dpi-research-2026-05-28.md`, `anticensor-research-waves-2026-05-26.md`.

## Files in this skill
- `scripts/install-amneziawg2.sh` — full AmneziaWG 2.0 installer (module + tools + unique keys/params + configs).
- `templates/xray-config.template.json` — Xray config with `{{PLACEHOLDERS}}` for both inbounds.

> Reference implementation (real values, do not copy keys): `~/Documents/billynotes/vpn/server/server-91.201.114.192-audit.md`.
> All VPN notes live under `~/Documents/billynotes/vpn/{config,investigation,server}/` (see `vpn/README.md`).
