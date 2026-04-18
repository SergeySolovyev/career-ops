#!/usr/bin/env bash
# Quick check whether HH.ru responds 200 from this droplet.
# If 403 — DO IP is blocklisted by HH; need to switch region or use proxy.
set -euo pipefail

echo "→ Direct curl to HH API:"
curl -sS -o /dev/null -w "HTTP %{http_code}\n" \
  -A "CareerPilot/1.0 (sssolovjov@yandex.ru)" \
  "https://api.hh.ru/vacancies?text=python&per_page=1"

echo "→ Curl to HH frontend:"
curl -sS -o /dev/null -w "HTTP %{http_code}\n" \
  -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36" \
  "https://hh.ru/search/vacancy?text=python"

echo
echo "Expected: 200 (OK) or 301 (redirect). 403 = blocked, must change region or proxy."
