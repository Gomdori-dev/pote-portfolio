# 방 미리보기 텍스처 출처

`/artworks/[slug]`의 "벽에 걸어보기"(`src/components/RoomPreview.tsx`)에서 쓰는 이미지들.

**전부 CC0, 퍼블릭 도메인 또는 직접 생성한 이미지**라 사이트에 저작자 표시를 띄우지 않는다. CC0는
저작자 표시 의무를 명시적으로 포기한 라이선스이고 퍼블릭 도메인은 애초에 의무가 없다. 다만 나중에 이
파일들의 출처를 되짚을 일이 반드시 생기므로 기록은 여기 남긴다.

| 파일 | 용도 | 원본 |
| --- | --- | --- |
| `wall-plaster-real.webp` | 벽 질감 "석고" | OpenAI 이미지 생성 — 실제 석회 미장 마감 참고 |
| `wall-linen-real.webp` | 벽 질감 "천" | OpenAI 이미지 생성 — 실제 리넨 벽지 참고 |
| `wall-smooth-real.webp` | 벽 질감 "매끈" | OpenAI 이미지 생성 — 실제 에그셸 도장면 참고 |
| `wood-gray.jpg` | 나무 액자 | `Wood pattern parquet floor tiles.jpg` (퍼블릭 도메인)에서 결이 곧은 패치를 뽑아 중성 회색으로 평탄화 |
| `metal-gray.jpg` | 금속 액자 | Wikimedia Commons, 주조 금속판 (CC0) |
| `matte-gray.jpg` | 무광 페인트 액자 | Wikimedia Commons, 무광 도장면 (CC0) |

## 벽 질감 3종 (`wall-*-real.webp`)

2026-09-16 OpenAI 이미지 생성으로 만든 합성 재질 이미지다. 외부 사진이나 작품을 사용하지 않았다.
각각 실제 석회 미장, 리넨 직조 벽지, 에그셸 도장면처럼 보이도록 만들었고, 원본을 상하·좌우 반전한
2×2 타일로 다시 구성해 반복 경계가 이어지게 했다. 768×768 WebP로 저장한다.

CSS(`.rp-surface`)에서는 벽 마스크(`--rp-scene-mask`) 안에만 `mix-blend-mode: multiply`로 얹고,
`filter: grayscale(1)`로 색을 빼서 사용자가 고른 벽 색이 그대로 보이게 한다. 고정 px 타일링이라
뷰포트가 바뀌어도 결의 크기가 유지된다. 방의 소품·가구·작품에는 재질이 적용되지 않고, 조명 효과는
재질 위에서 유지된다.

## 액자 텍스처가 회색조인 이유

액자 텍스처(`.rp-mat`)는 `background-color` + `background-image` + `background-blend-mode: overlay`로
합성된다. 사진 자체의 색조가 남아 있으면 사용자가 고른 색이 아니라 원본 사진의 색이 결과를 지배해서
(실버를 골라도 갈색으로 보인다) `a = (a - a.mean()) * spread + target`으로 중간 회색 주변에
재중심화해 두었다. 이 파일들을 교체할 때도 같은 처리를 거쳐야 한다.

## 교체할 때 주의

**CC BY-SA(동일조건변경허락)는 쓰지 않는다.** 상업 사이트에 동일조건변경허락 의무가 붙는다.
처음 시안에서 쓰던 너도밤나무 텍스처가 CC BY-SA라 위 퍼블릭 도메인 소스로 전부 교체했다.
