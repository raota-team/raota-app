import { PixelRatio } from "react-native"

/*
 * images.raota.net 사진은 Cloudflare 이미지 변환(/cdn-cgi/image/)으로 보이는 크기에 맞춰 줄여 받는다.
 * 원본은 장당 수 MB까지 커서 목록 썸네일로 그대로 받으면 LTE에서 몇 초씩 걸린다
 * (2026.10.23 측정: 홈·라운지 목록 23장이 16.4MB, 가장 큰 사진 3.2MB → 320px로 29KB).
 * 변환 결과도 Cloudflare가 캐시한다. 고유 변환 수(월 한도)를 아끼려고 폭은 세 단계로만 나눈다.
 * 다른 주소(기기 안 사진, 다른 호스트)는 그대로 둔다.
 */
const IMAGE_ORIGIN = "https://images.raota.net/"
const TRANSFORM_PATH = "cdn-cgi/image/"
const WIDTH_STEPS = [320, 640, 1080] as const

/**
 * 화면에서 `longestSidePt`만큼 차지하는 사진의 주소. 가로세로 중 긴 변을 넘긴다:
 * contentFit="cover"는 짧은 쪽을 잘라 긴 변을 채우므로, 폭만 맞추면 세로로 긴 칸에서 흐려진다.
 */
export function sizedImageUri(uri: string, longestSidePt: number): string {
  if (!uri.startsWith(IMAGE_ORIGIN) || longestSidePt <= 0) return uri
  const path = uri.slice(IMAGE_ORIGIN.length)
  if (path.startsWith(TRANSFORM_PATH)) return uri
  const pixels = PixelRatio.getPixelSizeForLayoutSize(longestSidePt)
  const width = WIDTH_STEPS.find((step) => step >= pixels) ?? WIDTH_STEPS[WIDTH_STEPS.length - 1]
  return `${IMAGE_ORIGIN}${TRANSFORM_PATH}width=${width},quality=80,fit=scale-down/${path}`
}
