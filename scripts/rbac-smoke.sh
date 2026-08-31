#!/usr/bin/env bash
# Exercises the server-side role checks against the running mock API.
# Usage: bash scripts/rbac-smoke.sh
set -uo pipefail

API="${API:-http://localhost:3001}"
ANALYST=1
MANAGER=2
ADMIN=3
VIEWER=4

pass=0
fail=0

# check <label> <expected-status> <curl args...>
check() {
  local label="$1" expect="$2"
  shift 2
  local body status
  body=$(curl -s -o /tmp/rbac-body -w "%{http_code}" "$@")
  status="$body"
  if [ "$status" = "$expect" ]; then
    printf 'PASS  %-58s %s\n' "$label" "$status"
    pass=$((pass + 1))
  else
    printf 'FAIL  %-58s got %s want %s | %s\n' "$label" "$status" "$expect" "$(head -c 160 /tmp/rbac-body)"
    fail=$((fail + 1))
  fi
}

json() { printf '%s' "$1"; }

echo "=== Users: create ==="
check "anonymous cannot create a user" 401 \
  -X POST "$API/api/users" -H 'content-type: application/json' \
  -d "$(json '{"email":"x1@test.com","first_name":"X","last_name":"Y","abbreviation":"XY","role_access":"Analyst"}')"

check "Analyst cannot create a user" 403 \
  -X POST "$API/api/users" -H 'content-type: application/json' -H "x-user-id: $ANALYST" \
  -d "$(json '{"email":"x2@test.com","first_name":"X","last_name":"Y","abbreviation":"XY","role_access":"Analyst"}')"

check "Viewer cannot create a user" 403 \
  -X POST "$API/api/users" -H 'content-type: application/json' -H "x-user-id: $VIEWER" \
  -d "$(json '{"email":"x3@test.com","first_name":"X","last_name":"Y","abbreviation":"XY","role_access":"Analyst"}')"

check "Manager cannot create an Administrator" 403 \
  -X POST "$API/api/users" -H 'content-type: application/json' -H "x-user-id: $MANAGER" \
  -d "$(json '{"email":"x4@test.com","first_name":"X","last_name":"Y","abbreviation":"XY","role_access":"Administrator"}')"

check "Manager can create an Analyst" 201 \
  -X POST "$API/api/users" -H 'content-type: application/json' -H "x-user-id: $MANAGER" \
  -d "$(json '{"email":"smoke-analyst@test.com","first_name":"Smoke","last_name":"Analyst","abbreviation":"SA","role_access":"Analyst"}')"
SMOKE_ANALYST=$(sed -n 's/.*"user_id":"\([0-9]*\)".*/\1/p' /tmp/rbac-body | head -1)

check "duplicate email is rejected" 400 \
  -X POST "$API/api/users" -H 'content-type: application/json' -H "x-user-id: $MANAGER" \
  -d "$(json '{"email":"smoke-analyst@test.com","first_name":"Dup","last_name":"E","abbreviation":"DE","role_access":"Analyst"}')"

check "Administrator can create an Administrator" 201 \
  -X POST "$API/api/users" -H 'content-type: application/json' -H "x-user-id: $ADMIN" \
  -d "$(json '{"email":"smoke-admin@test.com","first_name":"Smoke","last_name":"Admin","abbreviation":"SD","role_access":"Administrator"}')"
SMOKE_ADMIN=$(sed -n 's/.*"user_id":"\([0-9]*\)".*/\1/p' /tmp/rbac-body | head -1)

echo
echo "=== Users: update ==="
check "anonymous cannot update a profile" 401 \
  -X PATCH "$API/api/users/$ADMIN" -H 'content-type: application/json' \
  -d "$(json '{"first_name":"Hacked"}')"

check "Analyst cannot update another user's profile" 403 \
  -X PATCH "$API/api/users/$ADMIN" -H 'content-type: application/json' -H "x-user-id: $ANALYST" \
  -d "$(json '{"first_name":"Hacked"}')"

check "Analyst can update their own profile" 200 \
  -X PATCH "$API/api/users/$ANALYST" -H 'content-type: application/json' -H "x-user-id: $ANALYST" \
  -d "$(json '{"first_name":"John"}')"

check "Manager cannot update an Administrator" 403 \
  -X PATCH "$API/api/users/$ADMIN" -H 'content-type: application/json' -H "x-user-id: $MANAGER" \
  -d "$(json '{"first_name":"Hacked"}')"

echo
echo "=== Users: delete ==="
check "Manager cannot delete an Administrator" 403 \
  -X DELETE "$API/api/users/$ADMIN" -H "x-user-id: $MANAGER"

check "Manager cannot delete themselves" 400 \
  -X DELETE "$API/api/users/$MANAGER" -H "x-user-id: $MANAGER"

check "Manager can delete the Analyst they created" 200 \
  -X DELETE "$API/api/users/${SMOKE_ANALYST:-9999}" -H "x-user-id: $MANAGER"

check "Administrator can delete an Administrator" 200 \
  -X DELETE "$API/api/users/${SMOKE_ADMIN:-9999}" -H "x-user-id: $ADMIN"

echo
echo "=== Records ==="
REC=$(curl -s "$API/api/records" -H "x-user-id: $ADMIN" | sed -n 's/.*"record_id":"\([^"]*\)".*/\1/p' | head -1)
check "Viewer cannot edit a record" 403 \
  -X PATCH "$API/api/records/$REC" -H 'content-type: application/json' -H "x-user-id: $VIEWER" \
  -d "$(json '{"comment":"nope"}')"

check "Analyst cannot reassign a record" 403 \
  -X PATCH "$API/api/records/$REC" -H 'content-type: application/json' -H "x-user-id: $ANALYST" \
  -d "$(json '{"assigned_analyst_id":"5"}')"

check "Manager can reassign a record" 200 \
  -X PATCH "$API/api/records/$REC" -H 'content-type: application/json' -H "x-user-id: $MANAGER" \
  -d "$(json '{"assigned_analyst_id":"1"}')"

echo
echo "=== Connectors ==="
check "anonymous cannot read the Egnyte connector" 401 "$API/api/connectors/egnyte"
check "Analyst cannot read the Egnyte connector" 403 "$API/api/connectors/egnyte" -H "x-user-id: $ANALYST"
check "Manager cannot read the Egnyte connector" 403 "$API/api/connectors/egnyte" -H "x-user-id: $MANAGER"
check "Administrator can read the Egnyte connector" 200 "$API/api/connectors/egnyte" -H "x-user-id: $ADMIN"
check "Manager cannot write the Egnyte connector" 403 \
  -X PUT "$API/api/connectors/egnyte" -H 'content-type: application/json' -H "x-user-id: $MANAGER" \
  -d "$(json '{"client_id":"evil","client_secret":"evil"}')"

echo
echo "=== Views ==="
check "Viewer gets no saved views" 200 "$API/api/views" -H "x-user-id: $VIEWER"
if [ "$(cat /tmp/rbac-body)" = '{"views":[]}' ]; then
  echo "PASS  Viewer view list is empty"
  pass=$((pass + 1))
else
  echo "FAIL  Viewer view list is not empty: $(head -c 200 /tmp/rbac-body)"
  fail=$((fail + 1))
fi

check "Analyst cannot share a view with a role" 403 \
  -X POST "$API/api/views" -H 'content-type: application/json' -H "x-user-id: $ANALYST" \
  -d "$(json '{"name":"Smoke","order":5,"fields":["file_name"],"conditions":{"join":"AND","items":[]},"sorts":[],"assigned_user_ids":[],"assigned_roles":["Analyst"]}')"

echo
echo "=== Languages ==="
check "Analyst cannot add a language code" 403 \
  -X POST "$API/api/language-codes" -H 'content-type: application/json' -H "x-user-id: $ANALYST" \
  -d "$(json '{"code_id":"XX","language":"Test","country":""}')"

check "Manager can add a language code" 201 \
  -X POST "$API/api/language-codes" -H 'content-type: application/json' -H "x-user-id: $MANAGER" \
  -d "$(json '{"code_id":"ZZ","language":"Smoke Test","country":""}')"

check "duplicate language code is rejected" 400 \
  -X POST "$API/api/language-codes" -H 'content-type: application/json' -H "x-user-id: $ADMIN" \
  -d "$(json '{"code_id":"zz","language":"Dup","country":""}')"

echo
echo "=== Audit log shape ==="
# Every row must name the field it describes and use a bare event verb, matching the
# seeded convention. A regression here silently degrades the Audit Log tab.
audit_rows=$(tail -n +2 ../data/sla-audit-log.csv 2>/dev/null || tail -n +2 data/sla-audit-log.csv)
bad_event=$(printf '%s\n' "$audit_rows" | awk -F, 'NF>1 && $NF !~ /^(Created|Updated|Deleted)\r?$/' | wc -l | tr -d ' ')
bad_table=$(printf '%s\n' "$audit_rows" | awk -F, 'NF>1 && $4 !~ /^(sla-file-records|sla-users|connectors|language-codes)$/' | wc -l | tr -d ' ')
blank_name=$(printf '%s\n' "$audit_rows" | awk -F, 'NF>1 && $5 == ""' | wc -l | tr -d ' ')

for pair in "event_type is a bare verb:$bad_event" "artifact_table is known:$bad_table" "artifact_name is populated:$blank_name"; do
  label="${pair%:*}"
  count="${pair##*:}"
  if [ "$count" = "0" ]; then
    printf 'PASS  %-58s\n' "$label"
    pass=$((pass + 1))
  else
    printf 'FAIL  %-58s %s offending row(s)\n' "$label" "$count"
    fail=$((fail + 1))
  fi
done

echo
echo "---------------------------------------------"
echo "passed: $pass   failed: $fail"
[ "$fail" -eq 0 ]
