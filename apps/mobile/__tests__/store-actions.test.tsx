import { fireEvent, render, waitFor } from "@testing-library/react-native"
import { useState } from "react"
import { Pressable, Text } from "react-native"

import type { CreateRamenLogInput } from "@raota/shared"
import { createInitialPersistedState } from "@/src/data/fixtures"
import type { RaotaRepository } from "@/src/repository"
import { RaotaProvider, useRaota } from "@/src/state/RaotaStore"

function repository(state = createInitialPersistedState()): RaotaRepository {
  return {
    load: jest.fn().mockResolvedValue(state),
    save: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn().mockResolvedValue(undefined),
  }
}

const logInput: CreateRamenLogInput = {
  shopId: 1,
  menuName: "특제 쇼유 라멘",
  ramenType: "쇼유",
  visitedAt: "2026-09-04",
  note: "면과 국물의 밸런스를 다시 기억하고 싶어요.",
  tasteNotes: {
    broth: ["감칠맛 좋아요"],
    noodle: ["단단해요"],
    seasoning: ["딱 좋아요"],
    topping: ["계란 좋아요"],
  },
  scores: { satisfaction: 4, brothDensity: 5, noodleFirmness: 4, topping: 3, revisit: 5 },
  revisit: "자주 감",
  isPublic: false,
}

function ReportProbe() {
  const { currentTasteReport, currentUser, userLogs, actions } = useRaota()
  return (
    <>
      <Text>{`${currentUser?.visitedCount}:${currentTasteReport?.recordCount}:${userLogs.length}`}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="기록 생성"
        onPress={() => void actions.createLog(logInput)}
      />
    </>
  )
}

function AccountProbe() {
  const { currentUser, state, actions } = useRaota()
  return (
    <>
      <Text>
        {currentUser
          ? `${currentUser.levelNumber}:${currentUser.visitedCount}`
          : "guest"}
      </Text>
      <Text>{state.storageError ?? "ok"}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="탈퇴"
        onPress={() => void actions.withdraw()}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="새 로그인"
        onPress={() => actions.login({ provider: "kakao", name: "새라오타" })}
      />
    </>
  )
}

function GuestMutationProbe() {
  const { currentUser, actions } = useRaota()
  const [result, setResult] = useState("idle")

  const create = async () => {
    try {
      await actions.createLog(logInput)
      setResult("created")
    } catch (error) {
      setResult(error instanceof Error ? error.message : "failed")
    }
  }

  return (
    <>
      <Text>{currentUser ? "member" : "guest"}</Text>
      <Text>{result}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="비회원 기록 생성"
        onPress={() => void create()}
      />
    </>
  )
}

describe("persistent store actions", () => {
  it("updates the owned log list, visit count, and taste report in one save flow", async () => {
    const view = await render(
      <RaotaProvider repository={repository()}>
        <ReportProbe />
      </RaotaProvider>,
    )

    expect(view.getByText("42:42:0")).toBeTruthy()
    await fireEvent.press(view.getByRole("button", { name: "기록 생성" }))
    expect(await view.findByText("43:43:1")).toBeTruthy()
  })

  it("creates a clean level-one account after local withdrawal", async () => {
    const view = await render(
      <RaotaProvider repository={repository()}>
        <AccountProbe />
      </RaotaProvider>,
    )

    await fireEvent.press(view.getByRole("button", { name: "탈퇴" }))
    expect(await view.findByText("guest")).toBeTruthy()
    await fireEvent.press(view.getByRole("button", { name: "새 로그인" }))

    await waitFor(() => expect(view.getByText("1:0")).toBeTruthy())
  })

  it("rejects a record mutation when the persisted account is logged out", async () => {
    const guestState = createInitialPersistedState()
    guestState.user = guestState.user
      ? { ...guestState.user, isLoggedIn: false }
      : null
    const view = await render(
      <RaotaProvider repository={repository(guestState)}>
        <GuestMutationProbe />
      </RaotaProvider>,
    )

    expect(await view.findByText("guest")).toBeTruthy()
    await fireEvent.press(
      view.getByRole("button", { name: "비회원 기록 생성" }),
    )

    expect(
      await view.findByText("로그인 후 라멘 기록을 저장할 수 있어요."),
    ).toBeTruthy()
  })
})
