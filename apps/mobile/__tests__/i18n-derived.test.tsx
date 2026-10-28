import { act, renderHook } from "@testing-library/react-native"
import { labelOf, setLocale } from "@raota/shared"
import { useActivityLevel, useTasteIdentity } from "@/src/data/hooks"

const mockSnapshot = { currentUser: null, userLogs: [], isHydrated: true, storageError: null }
jest.mock("@/src/state/RaotaStore", () => ({ useRaota: () => mockSnapshot }))

afterEach(() => setLocale("ko"))

it("refreshes memoized taste and activity copy on a retained screen without changing its records", async () => {
  const { result } = await renderHook(() => {
    const identity = useTasteIdentity()
    const level = useActivityLevel()
    return { identity, level, levelTitle: labelOf(level.data.title) }
  })
  const originalLogs = mockSnapshot.userLogs
  expect(result.current.identity.data.title).toBe("아직 취향을 모으는 중")
  await act(async () => setLocale("en"))
  expect(result.current.identity.data.title).toBe("Discovering your taste")
  expect(result.current.levelTitle).toBe("Ramen beginner")
  await act(async () => setLocale("ja"))
  expect(result.current.identity.data.title).toBe("好みを見つけている途中")
  expect(result.current.levelTitle).toBe("ラーメン初心者")
  expect(result.current.level.data.title).toBe("라멘 입문자")
  expect(mockSnapshot.userLogs).toBe(originalLogs)
  expect(result.current.identity.data.total).toBe(0)
})
