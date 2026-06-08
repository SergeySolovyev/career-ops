#!/usr/bin/env bash
#
# finalize-domain.sh — финализация подключения vibeoffer.today после
# успешной DNS-verification у Vercel.
#
# Запускать ТОЛЬКО после того как:
#   1. Сергей купил vibeoffer.today у регистратора (Namecheap / Reg.ru / Porkbun)
#   2. Прописал DNS-записи (см. DOMAIN-CONFIG-vibeoffer-today.md шаг 3)
#   3. Vercel прислал email что домен verified (обычно 10 мин — 24ч)
#
# Что делает:
#   1. Проверяет что vibeoffer.today резолвится в 76.76.21.21
#   2. Обновляет NEXT_PUBLIC_SITE_URL в Vercel env (Production)
#   3. Триггерит redeploy для применения новой env var
#   4. Smoke-test: curl https://vibeoffer.today → 200 OK
#
# Использование:
#   cd apps/web && bash ../../scripts/finalize-domain.sh

set -e

DOMAIN="vibeoffer.today"
EXPECTED_IP="76.76.21.21"
SITE_URL="https://${DOMAIN}"

cd "$(dirname "$0")/../apps/web"

echo "🔍 Шаг 1/4: проверка DNS..."
RESOLVED=$(nslookup "${DOMAIN}" 2>/dev/null | grep -A2 "Name:" | grep "Address:" | head -1 | awk '{print $2}')

if [ "${RESOLVED}" != "${EXPECTED_IP}" ]; then
  echo "❌ ${DOMAIN} резолвится в '${RESOLVED}', а должно быть в '${EXPECTED_IP}'"
  echo "   Проверьте DNS-записи у регистратора (см. DOMAIN-CONFIG-vibeoffer-today.md)"
  echo "   ИЛИ подождите ещё 1-2ч пока propagation завершится."
  exit 1
fi
echo "✅ DNS OK: ${DOMAIN} → ${RESOLVED}"

echo ""
echo "🔍 Шаг 2/4: обновление NEXT_PUBLIC_SITE_URL в Vercel..."
# Удаляем старое значение (если есть) и добавляем новое
vercel env rm NEXT_PUBLIC_SITE_URL production --yes 2>/dev/null || true
echo "${SITE_URL}" | vercel env add NEXT_PUBLIC_SITE_URL production
echo "✅ NEXT_PUBLIC_SITE_URL = ${SITE_URL}"

echo ""
echo "🔍 Шаг 3/4: redeploy для применения env vars..."
vercel --prod
echo "✅ Production deploy запущен"

echo ""
echo "🔍 Шаг 4/4: ждём 30с и проверяем smoke-test..."
sleep 30
HTTP_CODE=$(curl -o /dev/null -s -w "%{http_code}" "${SITE_URL}")
if [ "${HTTP_CODE}" = "200" ]; then
  echo "🎉 ${SITE_URL} → 200 OK · домен работает!"
  echo ""
  echo "📋 Следующие шаги:"
  echo "   1. Обновить webhook-URL в CloudPayments (когда одобрят):"
  echo "      ${SITE_URL}/api/billing/webhook"
  echo "   2. Запустить Resend DKIM-setup для ${DOMAIN} (если будем слать email)"
  echo "   3. (опц.) Подключить www.${DOMAIN} → 301 на ${DOMAIN}"
else
  echo "⚠️  ${SITE_URL} вернул HTTP ${HTTP_CODE}"
  echo "   Vercel deploy может ещё идти (build ~3-5 мин). Проверь:"
  echo "   curl -I ${SITE_URL}"
fi
