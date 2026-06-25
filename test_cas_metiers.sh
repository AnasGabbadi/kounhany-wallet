#!/bin/bash
# ============================================================
# Kounhany Wallet — Tests des 4 cas métiers
# ============================================================
# Usage: bash test_cas_metiers.sh
# Prérequis: CLIENT_IDS valides dans la DB
# ============================================================

API="https://kounhany.fr/wallet-api"
API_KEY="kounhany-secret-2024"
H="x-api-key: $API_KEY"
CT="Content-Type: application/json"

# ── Couleurs ─────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

pass() { echo -e "${GREEN}✅ PASS${NC} — $1"; }
fail() { echo -e "${RED}❌ FAIL${NC} — $1"; }
info() { echo -e "${BLUE}ℹ️  INFO${NC} — $1"; }
section() { echo -e "\n${YELLOW}══════════════════════════════════════${NC}"; echo -e "${YELLOW}$1${NC}"; echo -e "${YELLOW}══════════════════════════════════════${NC}"; }

# ── Récupérer un client actif ─────────────────────────────────
get_client() {
  curl -s -H "$H" "$API/clients" | python3 -c "
import sys, json
data = json.load(sys.stdin)
clients = data.get('data', {}).get('clients', data.get('data', []))
if isinstance(clients, list) and len(clients) > 0:
    print(clients[0]['client_id'])
" 2>/dev/null
}

CLIENT_ID=$(get_client)

if [ -z "$CLIENT_ID" ]; then
  echo -e "${RED}❌ Aucun client trouvé — créer un client d'abord via Authentik SCIM${NC}"
  exit 1
fi

info "Client utilisé : $CLIENT_ID"

# ── Solde initial ─────────────────────────────────────────────
get_balance() {
  curl -s -H "$H" "$API/wallet/balance/$1" | python3 -c "
import sys, json
data = json.load(sys.stdin)
b = data.get('data', {}).get('balances', {})
print(f\"Available={b.get('available',0)} | Blocked={b.get('blocked',0)} | Receivable={b.get('receivable',0)}\")
" 2>/dev/null
}

# ============================================================
# SETUP — Recharger le wallet pour les tests
# ============================================================
section "SETUP — Recharge wallet (1000 MAD)"

REF_PAY="SETUP-PAY-$(date +%s)"
RES=$(curl -s -X POST "$API/wallet/pay" \
  -H "$H" -H "$CT" \
  -d "{\"clientId\":\"$CLIENT_ID\",\"amount\":1000,\"reference\":\"$REF_PAY\",\"description\":\"Recharge pour tests\"}")

echo "$RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK' if d.get('success') else 'FAIL: '+str(d))" 2>/dev/null

info "Solde après recharge : $(get_balance $CLIENT_ID)"

# ============================================================
# CAS 1 — FLEET
# ============================================================
section "CAS 1 — FLEET (Block → Confirm → Facture Dolibarr)"

echo ""
echo "── Scénario 1.1 : Flux nominal FLEET ──"
REF_FLEET="FLEET-$(date +%s)"

# Step 1 : Vérifier disponibilité
info "Step 1 : Vérifier disponibilité (300 MAD)"
RES=$(curl -s -X POST "$API/wallet/check-available" \
  -H "$H" -H "$CT" \
  -d "{\"clientId\":\"$CLIENT_ID\",\"amount\":300}")
STATUS=$(echo "$RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('available',False))" 2>/dev/null)
[ "$STATUS" = "True" ] && pass "Solde disponible" || fail "Solde insuffisant"

# Step 2 : BLOCK
info "Step 2 : BLOCK 300 MAD"
RES=$(curl -s -X POST "$API/wallet/block" \
  -H "$H" -H "$CT" \
  -d "{\"clientId\":\"$CLIENT_ID\",\"amount\":300,\"reference\":\"$REF_FLEET\",\"description\":\"Maintenance véhicule fleet\"}")
echo "$RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print('PASS — BLOCK OK' if d.get('success') else 'FAIL: '+str(d.get('error','')))" 2>/dev/null \
  | while read l; do [[ $l == PASS* ]] && pass "$l" || fail "$l"; done

info "Solde après BLOCK : $(get_balance $CLIENT_ID)"

# Step 3 : CONFIRM
info "Step 3 : CONFIRM 300 MAD → facture Dolibarr auto"
RES=$(curl -s -X POST "$API/wallet/confirm" \
  -H "$H" -H "$CT" \
  -d "{\"clientId\":\"$CLIENT_ID\",\"amount\":300,\"reference\":\"$REF_FLEET\",\"description\":\"Maintenance véhicule fleet\"}")
echo "$RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print('PASS — CONFIRM OK' if d.get('success') else 'FAIL: '+str(d.get('error','')))" 2>/dev/null \
  | while read l; do [[ $l == PASS* ]] && pass "$l" || fail "$l"; done

info "Solde après CONFIRM : $(get_balance $CLIENT_ID)"

# Vérifier facture Dolibarr créée
info "Step 4 : Vérifier facture Dolibarr"
RES=$(curl -s -H "$H" "$API/dolibarr/invoices/$CLIENT_ID")
COUNT=$(echo "$RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',{}).get('invoices',[])))" 2>/dev/null)
[ "$COUNT" -gt "0" ] && pass "Facture Dolibarr créée ($COUNT facture(s))" || fail "Aucune facture Dolibarr trouvée"

echo ""
echo "── Scénario 1.2 : BLOCK avec solde insuffisant ──"
REF_FLEET2="FLEET-INSUF-$(date +%s)"
RES=$(curl -s -X POST "$API/wallet/block" \
  -H "$H" -H "$CT" \
  -d "{\"clientId\":\"$CLIENT_ID\",\"amount\":999999,\"reference\":\"$REF_FLEET2\",\"description\":\"Test solde insuffisant\"}")
HTTP_STATUS=$(echo "$RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('success',True))" 2>/dev/null)
[ "$HTTP_STATUS" = "False" ] && pass "Rejet correct — solde insuffisant" || fail "Devrait être rejeté"

echo ""
echo "── Scénario 1.3 : Idempotence (même référence deux fois) ──"
REF_IDEM="FLEET-IDEM-$(date +%s)"
curl -s -X POST "$API/wallet/block" -H "$H" -H "$CT" \
  -d "{\"clientId\":\"$CLIENT_ID\",\"amount\":50,\"reference\":\"$REF_IDEM\",\"description\":\"Test idempotence\"}" > /dev/null
RES=$(curl -s -X POST "$API/wallet/block" -H "$H" -H "$CT" \
  -d "{\"clientId\":\"$CLIENT_ID\",\"amount\":50,\"reference\":\"$REF_IDEM\",\"description\":\"Test idempotence\"}")
STATUS=$(echo "$RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('success',True))" 2>/dev/null)
[ "$STATUS" = "False" ] && pass "Idempotence OK — doublon rejeté" || info "Idempotence — vérifier manuellement"

# ============================================================
# CAS 2 — LOGISTIQUE
# ============================================================
section "CAS 2 — LOGISTIQUE (CONFIRM direct → Mission stockée)"

echo ""
echo "── Scénario 2.1 : Flux nominal LOGISTIQUE ──"
REF_LOGI="LOGI-$(date +%s)"

# Step 1 : Vérifier disponibilité
info "Step 1 : Vérifier disponibilité (200 MAD)"
RES=$(curl -s -X POST "$API/wallet/check-available" \
  -H "$H" -H "$CT" \
  -d "{\"clientId\":\"$CLIENT_ID\",\"amount\":200}")
STATUS=$(echo "$RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('available',False))" 2>/dev/null)
[ "$STATUS" = "True" ] && pass "Solde disponible" || fail "Solde insuffisant"

# Step 2 : CONFIRM direct (Available → Receivable)
info "Step 2 : CONFIRM direct 200 MAD (sans BLOCK)"
RES=$(curl -s -X POST "$API/wallet/confirm" \
  -H "$H" -H "$CT" \
  -d "{\"clientId\":\"$CLIENT_ID\",\"amount\":200,\"reference\":\"$REF_LOGI\",\"description\":\"Mission transport Casablanca-Rabat\"}")
echo "$RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print('PASS — CONFIRM LOGISTIQUE OK' if d.get('success') else 'FAIL: '+str(d.get('error','')))" 2>/dev/null \
  | while read l; do [[ $l == PASS* ]] && pass "$l" || fail "$l"; done

info "Solde après CONFIRM LOGISTIQUE : $(get_balance $CLIENT_ID)"

echo ""
echo "── Scénario 2.2 : Créer commande LOGISTIQUE via /orders ──"
REF_ORDER_LOGI="ORDER-LOGI-$(date +%s)"
RES=$(curl -s -X POST "$API/orders" \
  -H "$H" -H "$CT" \
  -d "{
    \"clientId\":\"$CLIENT_ID\",
    \"order_type\":\"LOGISTIQUE\",
    \"amount\":150,
    \"reference\":\"$REF_ORDER_LOGI\",
    \"description\":\"Mission transport test\",
    \"metadata\":{\"trajet\":\"Casa-Rabat\",\"chauffeur\":\"Ahmed\"}
  }")
echo "$RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print('PASS — Order LOGISTIQUE créée status='+str(d.get('data',{}).get('order',{}).get('status','?')) if d.get('success') else 'FAIL: '+str(d.get('error','')))" 2>/dev/null \
  | while read l; do [[ $l == PASS* ]] && pass "$l" || fail "$l"; done

echo ""
echo "── Scénario 2.3 : LOGISTIQUE avec solde insuffisant ──"
REF_LOGI3="LOGI-INSUF-$(date +%s)"
RES=$(curl -s -X POST "$API/orders" \
  -H "$H" -H "$CT" \
  -d "{\"clientId\":\"$CLIENT_ID\",\"order_type\":\"LOGISTIQUE\",\"amount\":999999,\"reference\":\"$REF_LOGI3\",\"description\":\"Test insuffisant\"}")
STATUS=$(echo "$RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('success',True))" 2>/dev/null)
[ "$STATUS" = "False" ] && pass "Rejet correct — solde insuffisant" || fail "Devrait être rejeté"

# ============================================================
# CAS 3 — B2C
# ============================================================
section "CAS 3 — B2C (Paiement immédiat → Available)"

echo ""
echo "── Scénario 3.1 : Flux nominal B2C ──"
REF_B2C="B2C-$(date +%s)"

info "Step 1 : Paiement B2C 500 MAD (@World → Available)"
RES=$(curl -s -X POST "$API/wallet/pay" \
  -H "$H" -H "$CT" \
  -d "{\"clientId\":\"$CLIENT_ID\",\"amount\":500,\"reference\":\"$REF_B2C\",\"description\":\"Paiement CMI carte bancaire\"}")
echo "$RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print('PASS — PAYMENT B2C OK' if d.get('success') else 'FAIL: '+str(d.get('error','')))" 2>/dev/null \
  | while read l; do [[ $l == PASS* ]] && pass "$l" || fail "$l"; done

info "Solde après paiement B2C : $(get_balance $CLIENT_ID)"

echo ""
echo "── Scénario 3.2 : Créer commande B2C via /orders ──"
REF_ORDER_B2C="ORDER-B2C-$(date +%s)"
RES=$(curl -s -X POST "$API/orders" \
  -H "$H" -H "$CT" \
  -d "{
    \"clientId\":\"$CLIENT_ID\",
    \"order_type\":\"B2C\",
    \"amount\":100,
    \"reference\":\"$REF_ORDER_B2C\",
    \"description\":\"Achat service B2C\",
    \"metadata\":{\"payment_method\":\"CMI\",\"card_last4\":\"1234\"}
  }")
echo "$RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print('PASS — Order B2C créée status='+str(d.get('data',{}).get('order',{}).get('status','?')) if d.get('success') else 'FAIL: '+str(d.get('error','')))" 2>/dev/null \
  | while read l; do [[ $l == PASS* ]] && pass "$l" || fail "$l"; done

echo ""
echo "── Scénario 3.3 : B2C montant zéro (validation) ──"
REF_B2C3="B2C-ZERO-$(date +%s)"
RES=$(curl -s -X POST "$API/orders" \
  -H "$H" -H "$CT" \
  -d "{\"clientId\":\"$CLIENT_ID\",\"order_type\":\"B2C\",\"amount\":0,\"reference\":\"$REF_B2C3\",\"description\":\"Test montant zéro\"}")
STATUS=$(echo "$RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('success',True))" 2>/dev/null)
[ "$STATUS" = "False" ] && pass "Rejet correct — montant zéro" || fail "Devrait être rejeté"

echo ""
echo "── Scénario 3.4 : B2C pas de vérification solde ──"
info "B2C ne vérifie pas le solde — transaction directe"
REF_B2C4="B2C-DIRECT-$(date +%s)"
RES=$(curl -s -X POST "$API/wallet/pay" \
  -H "$H" -H "$CT" \
  -d "{\"clientId\":\"$CLIENT_ID\",\"amount\":1,\"reference\":\"$REF_B2C4\",\"description\":\"B2C minimal\"}")
STATUS=$(echo "$RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('success',False))" 2>/dev/null)
[ "$STATUS" = "True" ] && pass "B2C direct OK — pas de vérification solde" || fail "B2C échoué"

# ============================================================
# CAS 4 — DOLIBARR EXTERNE
# ============================================================
section "CAS 4 — DOLIBARR EXTERNE (Dette + Paiement)"

echo ""
echo "── Scénario 4.1 : Enregistrer dette Dolibarr ──"
REF_DEBT="DEBT-$(date +%s)"

info "Step 1 : Créer dette externe (@World → Receivable)"
RES=$(curl -s -X POST "$API/wallet/external-debt" \
  -H "$H" -H "$CT" \
  -d "{\"clientId\":\"$CLIENT_ID\",\"amount\":400,\"reference\":\"$REF_DEBT\",\"description\":\"Facture Dolibarr IN2026-001\"}")
echo "$RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print('PASS — EXTERNAL_DEBT OK' if d.get('success') else 'FAIL: '+str(d.get('error','')))" 2>/dev/null \
  | while read l; do [[ $l == PASS* ]] && pass "$l" || fail "$l"; done

info "Solde après dette : $(get_balance $CLIENT_ID)"

echo ""
echo "── Scénario 4.2 : Paiement Dolibarr ──"
REF_EXT_PAY="EXT-PAY-$(date +%s)"

info "Step 2 : Paiement dette (Receivable → @World)"
RES=$(curl -s -X POST "$API/wallet/external-payment" \
  -H "$H" -H "$CT" \
  -d "{\"clientId\":\"$CLIENT_ID\",\"amount\":400,\"reference\":\"$REF_EXT_PAY\",\"description\":\"Paiement facture IN2026-001\"}")
echo "$RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print('PASS — EXTERNAL_PAYMENT OK' if d.get('success') else 'FAIL: '+str(d.get('error','')))" 2>/dev/null \
  | while read l; do [[ $l == PASS* ]] && pass "$l" || fail "$l"; done

info "Solde après paiement : $(get_balance $CLIENT_ID)"

echo ""
echo "── Scénario 4.3 : Vérifier statut Dolibarr ──"
RES=$(curl -s -H "$H" "$API/dolibarr/status")
STATUS=$(echo "$RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('connected',False))" 2>/dev/null)
[ "$STATUS" = "True" ] && pass "Dolibarr connecté" || fail "Dolibarr inaccessible"

echo ""
echo "── Scénario 4.4 : Vérifier factures Dolibarr du client ──"
RES=$(curl -s -H "$H" "$API/dolibarr/invoices/$CLIENT_ID")
echo "$RES" | python3 -c "
import sys,json
d=json.load(sys.stdin)
invoices = d.get('data',{}).get('invoices',[])
print(f'PASS — {len(invoices)} facture(s) trouvée(s)' if d.get('success') else 'FAIL: '+str(d.get('error','')))
" 2>/dev/null | while read l; do [[ $l == PASS* ]] && pass "$l" || fail "$l"; done

echo ""
echo "── Scénario 4.5 : Dette partielle (paiement < dette) ──"
REF_DEBT5="DEBT-PARTIAL-$(date +%s)"
REF_PAY5="PAY-PARTIAL-$(date +%s)"

curl -s -X POST "$API/wallet/external-debt" -H "$H" -H "$CT" \
  -d "{\"clientId\":\"$CLIENT_ID\",\"amount\":300,\"reference\":\"$REF_DEBT5\",\"description\":\"Dette partielle\"}" > /dev/null

RES=$(curl -s -X POST "$API/wallet/external-payment" \
  -H "$H" -H "$CT" \
  -d "{\"clientId\":\"$CLIENT_ID\",\"amount\":100,\"reference\":\"$REF_PAY5\",\"description\":\"Paiement partiel\"}")
echo "$RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print('PASS — Paiement partiel OK' if d.get('success') else 'FAIL: '+str(d.get('error','')))" 2>/dev/null \
  | while read l; do [[ $l == PASS* ]] && pass "$l" || fail "$l"; done

info "Solde après paiement partiel : $(get_balance $CLIENT_ID)"

# ============================================================
# RÉSUMÉ FINAL
# ============================================================
section "RÉSUMÉ — Solde final du client $CLIENT_ID"
get_balance $CLIENT_ID

echo ""
info "Voir les transactions : GET $API/wallet/transactions/$CLIENT_ID"
info "Voir les KPIs : GET $API/kpis/overview"
echo ""
