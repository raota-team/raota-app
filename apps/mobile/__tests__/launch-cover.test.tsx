jest.mock("expo-splash-screen", () => ({ hideAsync: jest.fn(async () => undefined) }))
jest.mock("expo-router", () => ({ useSegments: jest.fn(() => ["native"]) }))
// 걷어 내는 페이드는 건너뛰고 바로 사라지게 한다(타이밍만 본다)
jest.mock("react-native-reanimated", () => ({ useReducedMotion: () => true }))
jest.mock("@/src/state/RaotaStore", () => ({ useRaota: jest.fn(() => ({ isHydrated: true })) }))

type Testing = typeof import("@testing-library/react-native/pure")
type Router = { useSegments: jest.Mock }

/**
 * 앱을 켠 시각(launchedAt)과 준비 신호(launch.ts)는 모듈 상태라 테스트마다 모듈을 새로 읽는다.
 * React와 렌더러도 같은 새 모듈에서 읽어야 훅이 한 React를 쓴다.
 */
async function launch(segments: string[] = ["native"]) {
  jest.resetModules()
  // 기본 진입점은 불러올 때 beforeAll·afterEach를 등록해 테스트 안에서 다시 읽을 수 없다. 훅이 없는 pure를 쓴다
  const testing: Testing = require("@testing-library/react-native/pure")
  const react: typeof import("react") = require("react")
  const router: Router = require("expo-router")
  router.useSegments.mockReturnValue(segments)
  const cover: typeof import("@/src/components/LaunchCover") = require("@/src/components/LaunchCover")
  const signal: typeof import("@/src/launch") = require("@/src/launch")

  const view = await testing.render(react.createElement(cover.default))
  return {
    covered: () => view.queryByLabelText("RAOTA 불러오는 중") !== null,
    homeReady: () => testing.act(async () => signal.markLaunchReady()),
    advance: (ms: number) => testing.act(async () => jest.advanceTimersByTime(ms)),
  }
}

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

describe("앱을 켤 때 덮는 화면", () => {
  it("홈이 바로 준비돼도 1초는 보여 주고 걷는다", async () => {
    const app = await launch()
    await app.homeReady()
    expect(app.covered()).toBe(true)

    await app.advance(999)
    expect(app.covered()).toBe(true)
    await app.advance(1)
    expect(app.covered()).toBe(false)
  })

  it("홈 데이터가 늦으면 2초까지 기다린 뒤 홈을 연다", async () => {
    const app = await launch()
    await app.advance(1_999)
    expect(app.covered()).toBe(true)
    await app.advance(1)
    expect(app.covered()).toBe(false)
  })

  it("알림으로 홈이 아닌 화면부터 열리면 홈을 기다리지 않는다", async () => {
    const app = await launch(["(flows)", "record"])
    await app.advance(1_000)
    expect(app.covered()).toBe(false)
  })
})
