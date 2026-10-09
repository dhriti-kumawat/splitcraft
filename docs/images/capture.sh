#!/bin/sh
# Retake the README screenshots (1440 × 900) with headless Chrome.
# Needs the dashboard (npm run dev -w apps/dashboard, :5173) and the site
# (npm run dev -w apps/web, :5174) running. Screens use the preview page's example data.
set -e
cd "$(dirname "$0")"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
D="http://localhost:5173/preview.html?path="
shot() {
  "$CHROME" --headless=new --hide-scrollbars --window-size=1440,900 \
    --virtual-time-budget=8000 --screenshot="$1.png" "$2" >/dev/null 2>&1
  echo "$1.png"
}
shot results "${D}/p/marketing-site/experiments/sticky/results"
shot experiments "${D}/p/marketing-site/experiments"
shot targeting "${D}/p/marketing-site/experiments/sticky/targeting"
shot variants "${D}/p/marketing-site/experiments/sticky/variants"
shot segment-builder "${D}/p/marketing-site/audiences/seg-returners"
shot projects "${D}/projects"
shot login "${D}/login"
shot home "http://localhost:5174/"

# Home page hero: the results screen at 2x, 1280 × 920, resized to 1720 px wide.
"$CHROME" --headless=new --hide-scrollbars --window-size=1280,920 --force-device-scale-factor=2 \
  --virtual-time-budget=8000 --screenshot=hero.png "${D}/p/marketing-site/experiments/sticky/results" >/dev/null 2>&1
sips -Z 1720 -s format jpeg -s formatOptions 85 hero.png --out ../../apps/web/public/shots/hero-results.jpg >/dev/null
rm hero.png
echo "apps/web/public/shots/hero-results.jpg"
