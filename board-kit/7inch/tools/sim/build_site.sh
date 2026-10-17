#!/usr/bin/env bash
# 시뮬레이터 배포용 폴더(_site) 만들기: 7인치 시뮬레이터(/) + 교무실 책상 시계(/desk/)
# 쓰는 법(이 폴더에서): bash build_site.sh && npx firebase-tools deploy --only hosting --project firsttest-5db1f
set -e
cd "$(dirname "$0")"
rm -rf _site && mkdir -p _site/fonts _site/desk/fonts _site/shots
cp ../../firmware/fonts/src/Pretendard-SemiBold.otf ../../firmware/fonts/src/Pretendard-LICENSE.txt _site/fonts/
sed 's#../../firmware/fonts/src/Pretendard-SemiBold.otf#fonts/Pretendard-SemiBold.otf#' index.html > _site/index.html
cp -r shots/. _site/shots/
DESK="../../../../../37_교무실-책상시계/sim"
if [ -d "$DESK" ]; then cp "$DESK/index.html" _site/desk/; cp "$DESK/fonts/"* _site/desk/fonts/; fi
echo "ok: $(find _site -type f | wc -l) files"
