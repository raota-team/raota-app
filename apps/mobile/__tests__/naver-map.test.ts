import { naverMapLinks } from "@/src/domain/naverMap"

describe("naverMapLinks", () => {
  it("opens the Naver place page directly when the shop has a Naver map id", () => {
    expect(naverMapLinks({ name: "멘야준", branch: "망원 본점", naverMapId: "1234567890" })).toEqual({
      primary: "https://m.place.naver.com/place/1234567890/home",
    })
  })

  it("uses a full URL as-is when the admin saved one instead of an id", () => {
    const url = "https://naver.me/abcd1234"
    expect(naverMapLinks({ name: "멘야준", naverMapId: ` ${url} ` })).toEqual({ primary: url })
  })

  it("searches by name in the Naver Map app first, then on the web", () => {
    const query = encodeURIComponent("후쿠 라멘 합정점")
    expect(naverMapLinks({ name: "후쿠 라멘", branch: "합정점" })).toEqual({
      primary: `nmap://search?query=${query}&appname=com.raota.app`,
      fallback: `https://map.naver.com/p/search/${query}`,
    })
    expect(naverMapLinks({ name: "후쿠 라멘", branch: "합정점", naverMapId: "  " }).fallback).toBeDefined()
  })
})
