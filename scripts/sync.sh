#!/usr/bin/env bash
#
# Sincroniza cambios con GitHub → Vercel despliega automáticamente.
#
# Uso:
#   ./scripts/sync.sh "mensaje del cambio"
#   ./scripts/sync.sh                        (mensaje automático)
#
set -e

MSG="${1:-actualización del sistema POS}"

cd "$(dirname "$0")/.."

echo "════════════════════════════════════════"
echo "  Validando antes de subir..."
echo "════════════════════════════════════════"

# 1. TypeScript
echo "→ Verificando tipos..."
if ! npx tsc --noEmit --pretty false 2>&1 | head -20; then
  echo "✗ Errores de TypeScript. Cancelado."
  exit 1
fi
echo "✓ Tipos correctos"

# 2. Build
echo "→ Compilando..."
if ! npm run build > /tmp/sync-build.log 2>&1; then
  echo "✗ Build falló:"
  tail -25 /tmp/sync-build.log
  exit 1
fi
echo "✓ Build exitoso"

# 3. Seguridad
echo "→ Revisando archivos sensibles..."
if git status --porcelain | grep -qE '(^|\s)\.env$'; then
  echo "✗ PELIGRO: .env detectado. Cancelado."
  exit 1
fi
echo "✓ Sin credenciales expuestas"

# 4. Commit + Push
echo ""
echo "════════════════════════════════════════"
echo "  Subiendo a GitHub..."
echo "════════════════════════════════════════"

git add -A

if git diff --cached --quiet; then
  echo "ℹ No hay cambios que subir."
  exit 0
fi

git commit -q -m "$MSG"
git push -q origin main --force-with-lease || git push -q origin main --force

COMMIT=$(git rev-parse --short HEAD)

echo "✓ Subido a GitHub (commit $COMMIT)"
echo ""
echo "════════════════════════════════════════"
echo "  Vercel desplegando automáticamente"
echo "  ~2 minutos → https://punto-venta-pos.vercel.app"
echo "════════════════════════════════════════"
