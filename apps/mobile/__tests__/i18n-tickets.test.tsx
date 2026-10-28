import { act, fireEvent, render } from "@testing-library/react-native"
import { setLocale } from "@raota/shared"

import { TicketCard, ticketDay, ticketIssuedAt } from "@/src/components/TodayTicketsSheet"
import { SHOPS } from "@/src/data/fixtures"
import type { RemoteTicket } from "@/src/data/remote"

jest.mock("lucide-react-native", () => {
  const React = require("react") as typeof import("react")
  const { View } = require("react-native") as typeof import("react-native")
  const Icon = (props: Record<string, unknown>) => React.createElement(View, props)
  return new Proxy({ __esModule: true }, {
    get: (target, property) => property === "__esModule" ? target.__esModule : Icon,
  })
})

afterEach(() => setLocale("ko"))

describe("ticket dates", () => {
  test.each([
    ["2026-10-27T14:59:59.999Z", "2026-10-27"],
    ["2026-10-27T15:00:00.000Z", "2026-10-28"],
    ["2026-10-27T15:30:00.000Z", "2026-10-28"],
    ["2026-12-31T15:00:00.000Z", "2027-01-01"],
  ])("groups %s by its Seoul calendar day", (timestamp, day) => {
    expect(ticketDay(timestamp).key).toBe(day)
  })

  it("changes the displayed date with the app language while retaining the same day group", () => {
    const issuedAt = "2026-10-27T15:30:00.000Z"
    setLocale("ko")
    const korean = ticketDay(issuedAt)
    expect(korean).toEqual({ key: "2026-10-28", label: "2026년 10월 28일 (수)" })
    expect(ticketIssuedAt(issuedAt)).toBe("2026년 10월 28일 00:30")

    setLocale("es")
    const spanish = ticketDay(issuedAt)
    expect(spanish.key).toBe(korean.key)
    expect(spanish.label).toMatch(/28.*oct.*2026/i)
    expect(spanish.label).toContain("mié")
    expect(ticketIssuedAt(issuedAt)).toMatch(/28.*oct.*2026.*00:30/i)

    setLocale("en")
    const english = ticketDay(issuedAt)
    expect(english.key).toBe(korean.key)
    expect(english.label).toMatch(/Oct 28, 2026.*Wed/)
    expect(english.label).not.toBe(spanish.label)

    setLocale("ko")
    expect(ticketDay(issuedAt)).toEqual(korean)
  })
})

it("updates app hints on a mounted ticket while preserving API shop names and conditions", async () => {
  const ticket: RemoteTicket = {
    id: "ticket-language-check",
    createdAt: "2026-10-27T15:30:00.000Z",
    // A shop can have the same name as app copy; its name must still remain original.
    shops: [{ ...SHOPS[0], name: "홈", photos: [] }],
    appliedConditions: ["돈코츠", "진한 육수"],
    reasons: {},
  }
  const onPress = jest.fn()
  const view = await render(<TicketCard onPress={onPress} ticket={ticket} />)
  expect(view.getByText("홈")).toBeTruthy()
  expect(view.getByText("돈코츠 · 진한 육수")).toBeTruthy()

  await act(async () => setLocale("es"))
  expect(view.getByText("홈")).toBeTruthy()
  expect(view.queryByText("Inicio")).toBeNull()
  expect(view.getByText("돈코츠 · 진한 육수")).toBeTruthy()
  expect(view.queryByText("Tonkotsu · Caldo intenso")).toBeNull()
  expect(view.getByRole("button").props.accessibilityHint).toBe("Vuelve a ver las recomendaciones de este boleto")
  expect(view.getByRole("button").props.accessibilityLabel).toContain("홈")
  expect(view.getByRole("button").props.accessibilityLabel).toContain("돈코츠, 진한 육수")

  await act(async () => setLocale("en"))
  expect(view.getByText("홈")).toBeTruthy()
  expect(view.getByText("돈코츠 · 진한 육수")).toBeTruthy()
  expect(view.getByRole("button").props.accessibilityHint).toBe("Revisit this ticket's picks")
  await fireEvent.press(view.getByRole("button"))
  expect(onPress).toHaveBeenCalledTimes(1)
  expect(ticket.appliedConditions).toEqual(["돈코츠", "진한 육수"])
  expect(ticket.shops[0].name).toBe("홈")
})

it("translates app-authored empty-ticket copy in Spanish", async () => {
  setLocale("es")
  const ticket: RemoteTicket = {
    id: "empty-ticket",
    createdAt: "2026-10-27T15:30:00.000Z",
    shops: [],
    appliedConditions: [],
    reasons: {},
  }
  const view = await render(<TicketCard onPress={jest.fn()} ticket={ticket} />)
  expect(view.getByText("No hay locales para mostrar ahora")).toBeTruthy()
  expect(view.getByRole("button").props.accessibilityLabel).toContain("Sin locales para mostrar")
})
