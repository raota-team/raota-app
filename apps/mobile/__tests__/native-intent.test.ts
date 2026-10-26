import { redirectSystemPath } from "@/app/+native-intent"

describe("incoming system links", () => {
  it("does not route KakaoTalk's login return link, which used to open the 404 screen", () => {
    expect(redirectSystemPath({ path: "kakaob758c1d5fb18405f68a4264e7d2f076a://oauth?code=abc", initial: false })).toBeNull()
    expect(redirectSystemPath({ path: "kakaob758c1d5fb18405f68a4264e7d2f076a://oauth?code=abc", initial: true })).toBeNull()
  })

  it("keeps routing the app's own links and reminder links", () => {
    expect(redirectSystemPath({ path: "raota://record/select-shop?mode=nearby", initial: false })).toBe("raota://record/select-shop?mode=nearby")
    expect(redirectSystemPath({ path: "/settings", initial: true })).toBe("/settings")
  })
})
