import { apiClient, type ApiClient } from "../client"
import { sendIdempotent } from "../outbox"
import type { IdempotentCreateOptions } from "./ramenLog"
import type {
  BlockedMember,
  CreateCommentRequest,
  CursorPage,
  CursorParams,
  Id,
  LikeResponse,
  LoungeFeedParams,
  RamenLogComment,
  RamenLogSummary,
  ReportRequest,
} from "../types"

/**
 * 라운지(공개 라멘로그 피드)와 공감·댓글·신고·차단(#63).
 * 피드와 댓글 읽기는 비회원도 볼 수 있다(로그인했으면 내 공감 여부까지 온다 → auth: "optional").
 * 비공개·삭제·비활성 회원의 글, 내가 차단한 사람과 내가 신고한 글은 서버가 빼고 준다.
 */
export function createLoungeApi(client: ApiClient = apiClient) {
  return {
    /** 공개 라멘로그 피드. LIKES는 공감 수 내림차순(같으면 id 내림차순) */
    feed(params: LoungeFeedParams = {}): Promise<CursorPage<RamenLogSummary>> {
      return client.get<CursorPage<RamenLogSummary>>("/ramen-logs", {
        auth: "optional",
        query: {
          sort: params.sort,
          ramenType: params.ramenType,
          shopId: params.shopId,
          cursor: params.cursor,
          size: params.size,
        },
      })
    },

    like(logId: Id): Promise<LikeResponse> {
      return client.put<LikeResponse>(`/ramen-logs/${encodeURIComponent(logId)}/like`)
    },

    unlike(logId: Id): Promise<LikeResponse> {
      return client.delete<LikeResponse>(`/ramen-logs/${encodeURIComponent(logId)}/like`)
    },

    /** 댓글(등록순). 답글은 없다 */
    comments(logId: Id, params: CursorParams = {}): Promise<CursorPage<RamenLogComment>> {
      return client.get<CursorPage<RamenLogComment>>(`/ramen-logs/${encodeURIComponent(logId)}/comments`, {
        auth: "optional",
        query: { cursor: params.cursor, size: params.size },
      })
    },

    /** 댓글 작성(2~500자). 기록 저장과 마찬가지로 Idempotency-Key가 필수다 */
    createComment(
      logId: Id,
      body: CreateCommentRequest,
      options: IdempotentCreateOptions = {},
    ): Promise<RamenLogComment> {
      const path = `/ramen-logs/${encodeURIComponent(logId)}/comments`
      return sendIdempotent<RamenLogComment>(
        {
          operation: "CREATE_COMMENT",
          path,
          buildBody: () => body,
          accountId: options.accountId,
          fingerprint: options.fingerprint,
          idempotencyKey: options.idempotencyKey,
          outbox: options.outbox,
        },
        ({ idempotencyKey, body: payload }) =>
          client.request<RamenLogComment>(path, { method: "POST", body: payload, idempotencyKey }),
      )
    },

    deleteComment(commentId: Id): Promise<void> {
      return client.delete<void>(`/ramen-log-comments/${encodeURIComponent(commentId)}`)
    },

    /** 신고. 같은 대상을 다시 신고해도 성공으로 온다 */
    report(body: ReportRequest): Promise<void> {
      return client.post<void>("/reports", body)
    },

    /** 이 사람의 글과 댓글을 더 보지 않는다 */
    block(memberId: Id): Promise<void> {
      return client.put<void>(`/members/${encodeURIComponent(memberId)}/block`)
    },

    unblock(memberId: Id): Promise<void> {
      return client.delete<void>(`/members/${encodeURIComponent(memberId)}/block`)
    },

    /** 내가 차단한 사람들(기기를 바꿔도 유지된다) */
    myBlocks(): Promise<BlockedMember[]> {
      return client.get<BlockedMember[]>("/members/me/blocks")
    },
  } as const
}

export const loungeApi = createLoungeApi()
export type LoungeApi = ReturnType<typeof createLoungeApi>
