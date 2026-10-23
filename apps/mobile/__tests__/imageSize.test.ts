import { PixelRatio } from "react-native"

import { sizedImageUri } from "@/src/api/imageSize"

describe("sizedImageUri", () => {
  beforeEach(() => {
    jest.spyOn(PixelRatio, "get").mockReturnValue(3)
  })
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("asks Cloudflare for the smallest width step that covers the frame on a 3x screen", () => {
    const original = "https://images.raota.net/shops/a.webp"
    expect(sizedImageUri(original, 48)).toBe("https://images.raota.net/cdn-cgi/image/width=320,quality=80,fit=scale-down/shops/a.webp")
    expect(sizedImageUri(original, 116)).toBe("https://images.raota.net/cdn-cgi/image/width=640,quality=80,fit=scale-down/shops/a.webp")
    // 화면 폭 사진도 1080px에서 멈춘다
    expect(sizedImageUri(original, 390)).toBe("https://images.raota.net/cdn-cgi/image/width=1080,quality=80,fit=scale-down/shops/a.webp")
  })

  it("leaves device photos, other hosts, already-sized and unmeasured images alone", () => {
    expect(sizedImageUri("file:///tmp/photo.jpg", 48)).toBe("file:///tmp/photo.jpg")
    expect(sizedImageUri("https://example.com/a.webp", 48)).toBe("https://example.com/a.webp")
    const sized = "https://images.raota.net/cdn-cgi/image/width=320,quality=80,fit=scale-down/a.webp"
    expect(sizedImageUri(sized, 390)).toBe(sized)
    expect(sizedImageUri("https://images.raota.net/a.webp", 0)).toBe("https://images.raota.net/a.webp")
  })
})
