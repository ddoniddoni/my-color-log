# 색 강조 D단계 — 평가 도구와 1차 비교

- 날짜: 2026-10-22
- 관련 요구사항: FR-PHOTO-002/005/006, [실사용 피드백 계획 D/E/F](iphone-feedback-improvement-plan.md)
- 상태: D 평가 도구·공개 사진 파일럿 완료. 정식 정확도·모바일 성능 측정과 E 구현은 다음 단계다.

## 결정

기존 Skia 렌더링 경로를 유지하고, E에서는 **색상군별 hue 범위·채도/명도 허용 범위**를 개선하는 후보를 구현한다. 이번 HSV·OKLCH 실험의 고정 파라미터를 앱에 그대로 적용하지 않는다. 단일 Oklab 거리로 바꾸는 안도 채택하지 않는다. 세부 이유는 아래 실측 결과에 있다.

OpenCV 도입이 필요한 증거는 아직 없다. 현재 확인한 문제는 잘못 남긴 색과 넓게 누락한 색 영역이며, 마스크 잡음 정리만으로 해결되지 않는다. 후처리와 새 네이티브 라이브러리는 이득을 입증한 뒤 검토한다. 이번 단계의 새 런타임/개발 의존성은 0개다.

사용자는 공개 사진으로 우선 진행하고 자신의 실제 촬영 사진 확인은 마지막 기기 QA에서 하기로 했다. 사진은 로컬에서만 처리했다. Supabase의 사용자 사진을 조회하거나 외부 분석 서비스로 전송하지 않았다.

## 재현한 원인

D의 기존 `colorIsolation.ts`는 각 픽셀과 목표색을 `(rgb - min) / (max - min)`으로 정규화한 뒤 거리를 비교한다. 색이 있는지 판단하는 최소 채도·밝기 조건은 있지만, 목표와 픽셀 사이의 명도·채도 차이는 비교에서 사라진다.

- 와인 `#8B1E4B`를 목표로 하면 로즈 핑크 `#EC407A`도 완전히 살아난다. 실제 baseline SkSL을 CanvasKit으로 실행해 재현했다.
- 와인색 잎 사진에서는 밝은 핑크가 남고 어두운 잎의 상당 부분이 빠졌다. 부분 주석 영역 recall은 0.185였다. 이는 실제 사용자가 찍었던 사진의 재현과는 구분한다.
- 자연광 보라 꽃은 기존 방식도 부분 영역 recall 0.995였다. “보라색이면 항상 실패한다”는 가설은 지지하지 않는다.
- 잎의 노란 기운과 옅은 하늘색처럼 대표 HEX에서 벗어난 색이 어려웠다. 모든 색의 채도 하한을 높이면 하늘을 잃고, hue 범위를 한꺼번에 넓히면 피부·붉은 갈색도 남는다.
- 알파 해제/복원과 `layout(color)`는 기존 코드에 이미 있다. 이번 결과로 Display P3 처리 오류나 미리보기/저장 불일치까지 재현했다고 주장하지 않는다.

## 평가 자료와 방법

**공개 사진 6장, 장면-목표색 조합 11개**, 합성 표본 10색 × 20개 픽셀을 사용했다. 같은 사진의 여러 목표색은 독립 사진으로 세지 않는다. 합성 표본에는 기준색, 그림자, 따뜻한 색 편향, 밝은 변형, 다른 팔레트색, 흰색/회색/암부가 있다. 와인의 밝은 변형처럼 핑크와 의미가 겹치는 표본 1개는 평가에서 제외했다.

사진 출처·저자·라이선스·원본 SHA-256·주석은 [photos.json](../scripts/color-isolation/photos.json)에 있다.

| 장면 | 사용 조건 | 분할 / 용도 |
| --- | --- | --- |
| NASA astronaut | Public domain, scikit-image 배포 | development / 피부·주황 의상·빨간 깃발·흰 배경 |
| Coffee / Rachel Michetti | CC0, scikit-image 배포 | development / 따뜻한 조명·나무·도자기, 와인/보라 없는 전체 장면 |
| PurpleCrocus / Sue Welsh | Public domain, Wikimedia Commons | development / 보라 꽃·갈색 낙엽·흰 꽃 |
| Beautiful Coleus / Rohitverma9625 | CC0, Wikimedia Commons | validation / 핑크·어두운 와인 잎·연두·파란 배경 |
| Flower / vultilion, 배포 README의 danielbuechele 표기도 병기 | CC BY 2.0, scikit-learn 배포 | validation / 주황 꽃·어두운 청록 배경 |
| China / danielbuechele | CC BY 2.0, scikit-learn 배포 | validation / 옅은 하늘·그늘진 잎·주황 지붕 |

원본을 시각적으로 확인한 에이전트가 명확한 내부 영역을 사각형으로 표시했다. **사람이 검수한 전체 정답 마스크가 아니다.** 표시하지 않은 곳과 애매한 색 경계는 무시한다. Coffee의 목표색 부재 두 경우만 전체 프레임을 음성으로 평가한다. 피부는 이 한 장면만 포함하므로 다양한 피부색 검증을 대신하지 않는다.

모든 후보는 같은 sRGB 8-bit 입력과 동일한 영역을 사용한다. CanvasKit 0.41.0 CPU surface에서 실제 SkSL을 실행했다. EXIF 방향을 반영해 긴 변 최대 640px로 디코딩/축소한 뒤 픽셀만 재인코딩한다. 원본 다운로드는 임시 캐시에만 있고, 생성된 보고서 이미지는 원본 EXIF/위치를 복사하지 않는다. 이는 앱의 1600px 저장 해상도·GPU 성능·JPEG 85 품질 검증을 대신하지 않는다.

baseline은 `cb63022`의 셰이더를 `baseline.sksl`로 고정했고, D 당시 제품 코드와 동일함을 확인했다. 이후 제품 코드가 바뀌어도 기준값을 덮어쓰지 않는다. 모든 후보에서 마지막 합성 출력만 마스크로 교체해 분류 결과를 읽으며, 실제 강조 이미지도 별도로 렌더링한다. 배경 밝기 0.82·채도 강조 1.35는 후보 모두 동일하다.

- 마스크 `>= 0.5`를 검출로 고정한다. 8-bit 출력에서는 128 이상이다.
- precision = TP/(TP+FP), recall = TP/(TP+FN), ROI IoU = TP/(TP+FP+FN).
- 검출이 없는 양성 장면의 precision은 0으로 집계한다. 목표색 없는 장면은 precision/recall/IoU 평균에서 제외하고 잘못 남긴 면적 비율 FP/(FP+TN)을 별도로 기록한다.
- 표의 평균은 **주석 있는 장면-목표 조합의 macro 평균**이다. 사진 전체의 10색 정확도나 전체 픽셀 accuracy가 아니다.
- 같은 장면은 development/validation 양쪽에 들어가지 않도록 도구가 검사한다. 후보 파라미터와 주석을 정한 후 validation 결과를 열었고 결과에 맞춰 수정하지 않았다. 이제 결과가 공개되었으므로 E에서 이 장면을 참고해 조정할 경우 새 최종 holdout이 필요하다.

## 비교 후보

| 후보 | 실험 범위 | 판단 |
| --- | --- | --- |
| 기존 RGB 정규화 | threshold 0.32, softness 0.14, 기존 채도·밝기 조건 | frozen baseline |
| Skia + HSV | 원형 hue 거리 18~32° 페이드, S 0.10~0.24, V 0.025~0.09, 어두운 붉은 목표의 밝기 상한 | 와인 개선 가능성을 확인. 하늘·핑크·부재 장면 회귀로 그대로 채택 불가 |
| Skia + OKLCH | sRGB 선형화 → Oklab, hue 단위원 chord 거리 0.31~0.58, C 0.025~0.06, L 0.10~0.22, 어두운 붉은 목표의 L 상한 | 균일한 chroma 문턱이 하늘·민트를 누락. 그대로 채택 불가 |
| OpenCV + react-native-fast-opencv | 문서·라이선스·통합 비용 조사. **설치/실행/벤치마크하지 않음** | 후처리 효과가 입증되기 전까지 도입 보류 |
| Color.js | 색차 계산을 검산할 개발 도구 후보. **설치하지 않음** | 사진 전체 JS 픽셀 처리 경로로 사용하지 않음 |

[Skia RuntimeShader](https://wcandillon.github.io/react-native-skia/v2/docs/image-filters/runtime-shader/)는 기존 이미지 필터 경로를 유지할 수 있고 픽셀 밀도 주의사항이 있다. [SkSL 문서](https://skia.org/docs/user/sksl/)는 작업 색 공간과 premultiplied alpha를 설명한다. 실험의 sRGB 수동 선형화를 앱에 복사하지 말고, E에서는 `toLinearSrgb`를 포함한 작업 색 공간 처리를 확인한다.

[Oklab 원저자 자료](https://bottosson.github.io/posts/oklab/)의 linear sRGB 변환식을 사용했다. 이번 후보는 OKLCH hue/명도/채도 조건이며 ΔE2000 비교가 아니다. [Color.js 색차 문서](https://colorjs.io/docs/color-difference)의 여러 색차 스케일과 혼용하지 않는다.

[OpenCV HSV inRange](https://docs.opencv.org/4.x/da/d97/tutorial_threshold_inRange.html)는 범위 판별의 참고 자료다. 이 실험의 부동소수 HSV soft mask를 OpenCV의 정수 HSV 출력과 동일하다고 주장하지 않는다. [형태 연산 문서](https://docs.opencv.org/4.x/d9/d61/tutorial_py_morphological_ops.html)의 opening은 작은 영역을 제거할 수 있으므로 얇은 줄기·작은 물체 손실을 따로 확인해야 한다.

호환성/라이선스 조사(2026-10-22): 현재 앱은 Expo 57 / RN 0.86.3 / Skia 2.6.2이며 Skia는 [MIT](https://raw.githubusercontent.com/Shopify/react-native-skia/v2.6.2/LICENSE.md)다. Fast OpenCV 저장소의 [현재 package.json](https://raw.githubusercontent.com/lukaszkurantdev/react-native-fast-opencv/main/package.json)은 1.0.1, 개발 RN 0.85.0, peer RN `*`를 표시한다. 이것이 우리 버전의 빌드 호환 증거는 아니다. 래퍼는 [MIT](https://raw.githubusercontent.com/lukaszkurantdev/react-native-fast-opencv/main/LICENSE), OpenCV 4.5 이상은 [Apache 2.0](https://opencv.org/license/), Color.js는 [MIT](https://raw.githubusercontent.com/color-js/color.js/main/LICENSE)다. [Fast OpenCV 설치 문서](https://lukaszkurantdev.github.io/react-native-fast-opencv/installation)는 iOS 4.9.0 / Android 4.12.0의 서로 다른 바이너리와 동기 호출의 별도 스레드 처리를 안내한다. 앱 크기 증가량·메모리·처리시간은 측정하지 않았다.

## 측정 결과

validation 3장 / 6개 양성 목표 조합의 **부분 영역** 평균:

| 방식 | Precision | Recall | ROI IoU | baseline 대비 IoU |
| --- | ---: | ---: | ---: | ---: |
| 기존 | 0.818 | 0.597 | 0.552 | — |
| HSV 후보 | 0.922 | 0.630 | 0.577 | +0.025 |
| OKLCH 후보 | 0.888 | 0.580 | 0.504 | -0.048 |

주요 실패/개선 사례:

| 부분 영역 / 지표 | 기존 | HSV | OKLCH |
| --- | ---: | ---: | ---: |
| 와인 잎 recall | 0.185 | 0.603 | 0.659 |
| 와인 잎 precision | 0.343 | 0.999 | 0.796 |
| 핑크 잎 precision | 0.621 | 0.589 | 0.583 |
| 연한 하늘 recall | 0.734 | 0.351 | 0.196 |
| 청록 배경 recall | 1.000 | 1.000 | 0.678 |
| 그늘진 잎 recall | 0.013 | 0.025 | 0.041 |
| Coffee / 와인 부재 전체 프레임의 잘못 남긴 면적 | 0.036% | 0.920% | 0.095% |

합성 표본의 macro IoU는 기존 0.897 / HSV 0.860 / OKLCH 0.921이다. **합성 표본에서 좋아도 사진에서 좋아지지는 않았다.** 보라 꽃의 기존 ROI IoU는 0.995이고, 주황 의상은 0.805→HSV 0.889 / OKLCH 0.911이었다. 단일 최적 문턱을 모든 색에 강제할 근거가 없다.

## E 구현 기준과 남은 검증

초기 채택 기준을 낮추지 않는다. 정식 검증은 40장 이상의 독립된 장면과 사람이 검수한 전체 마스크로 macro IoU +0.05 이상, 색상군별 precision/recall 하락 0.03 이내, 보라·와인 누락 감소, 목표색 없는 장면의 오검출 면적 비율 악화 없음을 확인한다. 현재 도구는 부족한 자료를 성공으로 표시하지 않고 `releaseGate.status = not-evaluated`를 출력한다. 이번 결과로 어느 후보도 출시 승인하지 않는다.

E의 우선 작업:

1. 밝은 핑크와 어두운 와인의 구별에 명도 정보를 제한적으로 반영한다. 밝은 반사 부분·그림자까지 잘라내는 전역 상한은 피하고 실패 장면을 함께 검증한다.
2. 보라·와인·초록·연한 파랑/민트의 hue 폭과 저채도 허용 범위를 분리한다. 유효한 과거 미션색에도 동작하며 특정 활성 slug만 지원하는 로직은 만들지 않는다.
3. 흰색/회색/암부 억제를 유지하고, hue 확대 후 피부·목재·붉은 갈색 오검출을 다시 확인한다. RGB만 같은 두 영역은 사물 의미로 구분할 수 없다는 한계를 명시한다.
4. 분류 마스크와 배경/채도 연출을 분리해 미리보기·저장이 같은 파라미터를 사용하게 한다. 원본 저장 선택, 효과 중복 방지, 큐/실패 복구는 유지한다.
5. 40장 자료를 확장하고 독립 holdout과 사람 마스크 검수를 완료한 후 최종 판정한다. 이 파일럿에는 10색 모두의 독립 validation 사진, 다양한 피부색·실내 조명·기기 P3 입력이 없다.

F에서는 iPhone과 중급 Android에서 캐시된 사진 토글 p95 150ms 이내, 1600px 저장 p95 1초 이내라는 기존 목표와 baseline을 같이 측정한다. 각 기기에서 준비/워밍업을 분리하고 같은 사진으로 30회 이상 측정하여 p50/p95·최대 메모리·입력 지연을 기록한다. 목표를 결과에 맞춰 낮추지 않으며, 초과하면 최적화 또는 출시 보류 사유로 남긴다. P3/sRGB, 반투명 가장자리, 방향/crop, 화면 밀도, JPEG 85, 미리보기/저장 일치와 실제 사용자 촬영 사진도 F에 포함한다.

## 실행 방법과 산출물

```sh
# 네트워크 없이 합성 표본과 도구 계약을 검증한다. 앱 빌드가 아니다.
npm run test:color-isolation
npm run evaluate:color-isolation

# 최초 공개 사진 다운로드(읽기만)와 비교. 이후 --download를 빼면 오프라인 실행.
npm run evaluate:color-isolation -- --photos --download \
  --cache /tmp/mycolorlog-color-evaluation \
  --output /tmp/mycolorlog-color-evaluation/results
```

사진 없이 실행하면 사진 수를 0으로 기록한다. 다운로드 파일의 SHA-256이나 방향/크기가 다르면 평가를 중단하며 검증 없이 새 사진으로 대체하지 않는다. 결과는 `index.html`(원본/주석/효과/마스크/출처), `report.json`(후보·자료 해시, 부분 영역 수치, 색별 누락, 미완료 사유)이다. `.env`·계정·네트워크 인증이 필요 없고 사진과 대용량 결과를 저장소에 추가하지 않는다.

실행 검증: 신규 Node 평가 테스트 8개, 관련 Jest 3 suite / 19 tests, 전체 Jest 70 suite / 311 tests, `npm run typecheck`, `npm run lint` 통과. 린트에서 Node 전역 사용을 발견해 명시적 import/파일 해석으로 수정했다. 사진 평가 전체 실행과 결과 이미지의 보라·와인 비교를 확인했다. 앱 빌드·기기 연결·설치·공유 서버 변경·커밋·푸시는 수행하지 않았다.
