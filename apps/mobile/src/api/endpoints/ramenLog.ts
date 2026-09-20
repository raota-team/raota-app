import { apiClient, type ApiClient } from "../client"
import { sendIdempotent, type IdempotencyOutbox } from "../outbox"
import type {
  CreateRamenLogRequest,
  Id,
  RamenLogDetail,
  RamenLogSummaryItem,
  TasteNoteDefinitionsResponse,
  UpdateRamenLogRequest,
} from "../types"

/** 생성 요청에 붙는 멱등 옵션 */
export interface IdempotentCreateOptions {
  /**
   * 로그인한 계정 id. 주면 로컬 아웃박스에 (키, 본문, 처음 보낸 시각)을 남겨
   * 앱을 껐다 켜고 다시 보내도 같은 키를 쓴다. 없으면 매번 새 키다.
   */
  accountId?: string
  /** 같은 요청인지 가리는 값(기본값: 본문). 사진 업로드 전 원본으로 만들면 재시도 때 사진을 다시 올리지 않는다 */
  fingerprint?: string
  idempotencyKey?: string
  outbox?: IdempotencyOutbox
}

/** 기록 만들기·읽기·고치기·지우기(#62) */
export function createRamenLogApi(client: ApiClient = apiClient) {
  return {
    /**
     * 기록 저장. Idempotency-Key가 필수다.
     * 같은 (회원, 키)로 다시 보내면 서버가 이미 만든 기록을 그대로 돌려준다(기록이 두 번 생기지 않는다).
     */
    create(body: CreateRamenLogRequest, options: IdempotentCreateOptions = {}): Promise<RamenLogDetail> {
      return sendIdempotent<RamenLogDetail>(
        {
          operation: "CREATE_RAMEN_LOG",
          path: "/ramen-logs",
          buildBody: () => body,
          accountId: options.accountId,
          fingerprint: options.fingerprint,
          idempotencyKey: options.idempotencyKey,
          outbox: options.outbox,
        },
        ({ idempotencyKey, body: payload }) =>
          client.request<RamenLogDetail>("/ramen-logs", { method: "POST", body: payload, idempotencyKey }),
      )
    },

    get(logId: Id): Promise<RamenLogDetail> {
      return client.get<RamenLogDetail>(`/ramen-logs/${encodeURIComponent(logId)}`, { auth: "optional" })
    },

    update(logId: Id, body: UpdateRamenLogRequest): Promise<RamenLogDetail> {
      return client.patch<RamenLogDetail>(`/ramen-logs/${encodeURIComponent(logId)}`, body)
    },

    remove(logId: Id): Promise<void> {
      return client.delete<void>(`/ramen-logs/${encodeURIComponent(logId)}`)
    },

    /** 내 기록 전체를 가볍게(페이지 없음). memberApi.myRamenLogSummary와 같은 경로다 */
    mySummary(): Promise<RamenLogSummaryItem[]> {
      return client.get<RamenLogSummaryItem[]>("/members/me/ramen-logs/summary")
    },

    /** 맛 태그 코드 ↔ 이름표. 앱은 같은 순서를 TASTE_FIELDS로도 갖고 있다 */
    tasteNoteDefinitions(): Promise<TasteNoteDefinitionsResponse> {
      return client.get<TasteNoteDefinitionsResponse>("/taste-note-definitions", { auth: "optional" })
    },
  } as const
}

export const ramenLogApi = createRamenLogApi()
export type RamenLogApi = ReturnType<typeof createRamenLogApi>
