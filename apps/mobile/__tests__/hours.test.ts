import { groupWeek, hoursStatusAt, parseOpeningHours, seoulTime, statusText } from "@/src/domain/hours"

const WEEK = ["월요일", "화요일", "수요일", "목요일", "금요일", "토요일", "일요일"]
const everyDay = (hours: string) => WEEK.map((day) => `${day}: ${hours}`)

describe("parseOpeningHours", () => {
  it("reads break time as two ranges, closed days, and closing after midnight as the next day", () => {
    const week = parseOpeningHours([
      "월요일: 11:00 ~ 15:00, 17:00 ~ 20:30",
      "화요일: 휴무",
      "수요일: 정기 휴무",
      "목요일: 18:00 ~ 02:00",
      "금요일: 시간 확인 필요",
      "아무날: 11:00 ~ 12:00",
    ])

    expect(week).toEqual([
      { day: 1, closed: false, ranges: [{ start: 660, end: 900 }, { start: 1020, end: 1230 }] },
      { day: 2, closed: true, ranges: [] },
      { day: 3, closed: true, ranges: [] },
      // 다음 날 새벽 2시는 24시를 넘긴 26:00으로 둔다
      { day: 4, closed: false, ranges: [{ start: 1080, end: 1560 }] },
    ])
  })
})

describe("groupWeek", () => {
  it("collapses a week with one schedule into 매일", () => {
    expect(groupWeek(parseOpeningHours(everyDay("11:00 ~ 15:00, 17:00 ~ 20:30"))).map((group) => group.label)).toEqual(["매일"])
  })

  it("groups consecutive days from Monday and keeps separated days apart even when their hours match", () => {
    const week = parseOpeningHours([
      "일요일: 휴무",
      "월요일: 11:00 ~ 20:00",
      "화요일: 11:00 ~ 20:00",
      "수요일: 11:00 ~ 20:00",
      "목요일: 12:00 ~ 18:00",
      "금요일: 11:00 ~ 20:00",
      "토요일: 10:00 ~ 16:00",
    ])

    expect(groupWeek(week).map(({ label, closed }) => ({ label, closed }))).toEqual([
      { label: "월–수", closed: false },
      { label: "목요일", closed: false },
      { label: "금요일", closed: false },
      { label: "토요일", closed: false },
      { label: "일요일", closed: true },
    ])
    expect(groupWeek(parseOpeningHours(["토요일: 휴무", "일요일: 휴무"]))[0].label).toBe("토·일")
  })
})

describe("hoursStatusAt", () => {
  const week = parseOpeningHours([
    "월요일: 11:00 ~ 15:00, 17:00 ~ 20:30",
    "화요일: 휴무",
    "수요일: 11:00 ~ 15:00, 17:00 ~ 20:30",
  ])
  const at = (day: number, time: string) => {
    const [hour, minute] = time.split(":").map(Number)
    return statusText(hoursStatusAt(week, { day, minute: hour * 60 + minute })!)
  }

  it("walks a day with a break: before open, open, break, open again, then closed until the next open day", () => {
    expect(at(1, "10:00")).toEqual({ label: "준비 중", detail: "11:00에 열어요" })
    expect(at(1, "11:00")).toEqual({ label: "영업 중", detail: "15:00에 닫아요" })
    expect(at(1, "15:00")).toEqual({ label: "쉬는 시간", detail: "17:00에 다시 열어요" })
    expect(at(1, "17:30")).toEqual({ label: "영업 중", detail: "20:30에 닫아요" })
    // 화요일은 휴무라 다음 영업일 이름으로 알려 준다
    expect(at(1, "20:30")).toEqual({ label: "영업 종료", detail: "수요일 11:00에 열어요" })
    expect(at(2, "12:00")).toEqual({ label: "오늘 휴무", detail: "내일 11:00에 열어요" })
  })

  it("does not invent a next opening when a day in between has no hours", () => {
    // 수요일 다음 목요일 자료가 없다
    expect(at(3, "21:00")).toEqual({ label: "영업 종료", detail: null })
    // 오늘(목) 자료가 없으면 상태를 정하지 않는다
    expect(hoursStatusAt(week, { day: 4, minute: 720 })).toBeNull()
  })

  it("keeps a shop open after midnight on yesterday's schedule", () => {
    const lateNight = parseOpeningHours(["금요일: 18:00 ~ 02:00", "토요일: 휴무"])

    expect(statusText(hoursStatusAt(lateNight, { day: 6, minute: 90 })!)).toEqual({ label: "영업 중", detail: "다음 날 02:00에 닫아요" })
    expect(statusText(hoursStatusAt(lateNight, { day: 6, minute: 150 })!).label).toBe("오늘 휴무")
  })
})

describe("seoulTime", () => {
  it("uses Seoul time regardless of the device time zone", () => {
    // 금요일 15:30 UTC는 서울 토요일 00:30이다
    expect(seoulTime(new Date("2026-10-23T15:30:00Z"))).toEqual({ day: 6, minute: 30 })
  })
})
