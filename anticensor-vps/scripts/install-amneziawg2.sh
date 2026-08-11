#!/usr/bin/env bash
# install-amneziawg2.sh — deploy genuine AmneziaWG 2.0 on a fresh Ubuntu/Debian VPS.
# Builds the kernel module (DKMS) + tools, generates UNIQUE keys & obfuscation params
# (so every server has a distinct fingerprint), writes server + client configs, starts
# the service, and prints the client .conf for import into AmneziaVPN app / WG Tunnel.
#
# Usage:
#   SERVER_IP=1.2.3.4 [PORT=39574] [IFACE=ens3] [SUBNET=10.13.13] bash install-amneziawg2.sh
#
# Lessons baked in:
#   - `make dkms-install` ONLY copies sources; we run dkms add/build/install explicitly.
#   - awg-quick reads /etc/amnezia/amneziawg/ (NOT /etc/amneziawg/ or /etc/wireguard/).
#   - obfuscation params are written identically into BOTH configs (must match end-to-end).
#   - client = AmneziaVPN app / WG Tunnel only (mihomo = base AWG; xray/sing-box = none).
set -euo pipefail

SERVER_IP="${SERVER_IP:?set SERVER_IP=<public IP for client Endpoint>}"
PORT="${PORT:-39574}"
IFACE="${IFACE:-$(ip route get 8.8.8.8 2>/dev/null | grep -oP 'dev \K\S+' || echo eth0)}"
SUBNET="${SUBNET:-10.13.13}"            # /24; server=.1, first client=.2
CONF_DIR="/etc/amnezia/amneziawg"
IFNAME="awg0"

echo "==> AmneziaWG 2.0 install:  port=$PORT  iface=$IFACE  subnet=${SUBNET}.0/24  endpoint=${SERVER_IP}:${PORT}"

# --- 1. kernel module (DKMS) + tools ---
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y build-essential git dkms "linux-headers-$(uname -r)" software-properties-common >/dev/null

if ! lsmod | grep -q '^amneziawg'; then
  rm -rf /tmp/awg-mod
  git clone --depth 1 https://github.com/amnezia-vpn/amneziawg-linux-kernel-module.git /tmp/awg-mod
  make -C /tmp/awg-mod/src dkms-install          # NOTE: only copies sources to /usr/src/amneziawg-<VER>
  AWG_VER=$(ls -d /usr/src/amneziawg-*/ 2>/dev/null | head -1 | sed 's#.*/amneziawg-##; s#/##')
  echo "==> detected amneziawg DKMS version: ${AWG_VER:-UNKNOWN}"
  [ -z "$AWG_VER" ] && { echo "!! dkms source dir not found"; exit 1; }
  dkms add   -m amneziawg -v "$AWG_VER" || true
  dkms build -m amneziawg -v "$AWG_VER"
  dkms install -m amneziawg -v "$AWG_VER"
  modprobe amneziawg
fi
lsmod | grep -q '^amneziawg' && echo "==> module loaded" || { echo "!! module failed to load"; exit 1; }

if ! command -v awg >/dev/null; then
  rm -rf /tmp/awg-tools
  git clone --depth 1 https://github.com/amnezia-vpn/amneziawg-tools.git /tmp/awg-tools
  make -C /tmp/awg-tools/src >/dev/null && make -C /tmp/awg-tools/src install >/dev/null
fi
command -v awg >/dev/null && echo "==> awg tools: $(awg --version 2>&1 | head -1)"

# --- 2. forwarding ---
sysctl -wq net.ipv4.ip_forward=1
grep -q '^net.ipv4.ip_forward=1' /etc/sysctl.conf || echo 'net.ipv4.ip_forward=1' >> /etc/sysctl.conf

# --- 3. keys ---
mkdir -p "$CONF_DIR" && chmod 700 "$CONF_DIR" && cd "$CONF_DIR"
[ -s s.key ] || awg genkey | tee s.key | awg pubkey > s.pub
[ -s c.key ] || awg genkey | tee c.key | awg pubkey > c.pub
[ -s psk.key ] || awg genpsk > psk.key
chmod 600 ./*.key
SK_S=$(cat s.key); PK_S=$(cat s.pub); SK_C=$(cat c.key); PK_C=$(cat c.pub); PSK=$(cat psk.key)

# --- 4. UNIQUE obfuscation params (valid ranges; identical on both ends) ---
r32() { od -An -N4 -tu4 /dev/urandom | tr -d ' '; }      # random uint32 (>4, distinct in practice)
JC=$(( RANDOM % 6 + 3 ))          # 3..8 junk packets
JMIN=50; JMAX=1000                 # junk size bounds
S1=$(( RANDOM % 100 + 30 ))        # 30..129
S2=$(( RANDOM % 100 + 200 ))       # 200..299  (S1+56 never == S2)
S3=$(( RANDOM % 40 + 10 ))         # 2.0 cookie-pkt prefix
S4=$(( RANDOM % 20 + 5 ))          # 2.0 data-pkt prefix
H1=$(r32); H2=$(r32); H3=$(r32); H4=$(r32)
# I1 = CPS signature packet mimicking a QUIC Initial (long header 0xc3 + v1 + DCID + ~1.2KB body)
I1='<b 0xc30000000108><r 8><b 0x00><r 1000><r 180>'

write_obf() {   # emit the shared obfuscation block
  cat <<EOF
Jc = $JC
Jmin = $JMIN
Jmax = $JMAX
S1 = $S1
S2 = $S2
S3 = $S3
S4 = $S4
H1 = $H1
H2 = $H2
H3 = $H3
H4 = $H4
I1 = $I1
EOF
}

# --- 5. server config ---
cat > "$CONF_DIR/$IFNAME.conf" <<EOF
[Interface]
Address = ${SUBNET}.1/24
ListenPort = $PORT
PrivateKey = $SK_S
$(write_obf)
PostUp = iptables -A FORWARD -i $IFNAME -j ACCEPT; iptables -A FORWARD -o $IFNAME -j ACCEPT; iptables -t nat -A POSTROUTING -o $IFACE -j MASQUERADE
PostDown = iptables -D FORWARD -i $IFNAME -j ACCEPT; iptables -D FORWARD -o $IFNAME -j ACCEPT; iptables -t nat -D POSTROUTING -o $IFACE -j MASQUERADE

[Peer]
PublicKey = $PK_C
PresharedKey = $PSK
AllowedIPs = ${SUBNET}.2/32
EOF
chmod 600 "$CONF_DIR/$IFNAME.conf"

# --- 6. client config ---
cat > "$CONF_DIR/$IFNAME-client.conf" <<EOF
[Interface]
PrivateKey = $SK_C
Address = ${SUBNET}.2/32
DNS = 8.8.8.8, 1.1.1.1
$(write_obf)

[Peer]
PublicKey = $PK_S
PresharedKey = $PSK
Endpoint = ${SERVER_IP}:${PORT}
AllowedIPs = 0.0.0.0/0, ::/0
PersistentKeepalive = 25
EOF
chmod 600 "$CONF_DIR/$IFNAME-client.conf"

# --- 7. start + persist ---
systemctl enable "awg-quick@$IFNAME" >/dev/null 2>&1 || true
systemctl restart "awg-quick@$IFNAME" 2>/dev/null || awg-quick up "$IFNAME"
sleep 1

# --- 8. verify 2.0 params engaged ---
echo "==> awg show:"
awg show "$IFNAME" | grep -E "listening port|jc|s3|s4|i1|public key" || true
awg show "$IFNAME" | grep -q '^  i1:' && echo "==> OK: 2.0 CPS (i1) engaged" || echo "!! WARN: i1 not shown — tools may lack 2.0 support"

# --- 9. emit client config ---
echo
echo "================= CLIENT CONFIG ($IFNAME-client.conf) ================="
echo "  import into AmneziaVPN app (native AmneziaWG config) or WG Tunnel (Android)"
echo "======================================================================="
cat "$CONF_DIR/$IFNAME-client.conf"
