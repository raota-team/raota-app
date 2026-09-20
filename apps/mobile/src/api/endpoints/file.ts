import * as FileSystem from "expo-file-system/legacy"

import { ApiError, apiClient, type ApiClient } from "../client"
import type { UploadPurpose, UploadTicket, UploadTicketRequest, UploadTicketResponse } from "../types"

/**
 * 사진 업로드(#62). 두 걸음이다.
 * 1) POST /files/upload-tickets 로 업로드 주소와 완성될 imageUrl을 받는다
 * 2) 받은 방식대로 파일을 올린다
 *    - method POST + fields: multipart/form-data로 fields와 file을 함께 보낸다(Cloudinary)
 *    - method PUT + headers: 파일을 그대로 PUT 한다(OCI presigned)
 * 그 뒤 생성 본문에는 imageUrl만 넣는다(objectKey가 아니다).
 */

/** 한 장 최대 크기. 서버가 미리 막지 못하니 앱에서 먼저 걸러 준다 */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const

/** 한 번에 올릴 수 있는 장수 */
export const UPLOAD_COUNT_LIMIT: Record<UploadPurpose, number> = { PROFILE: 1, RAMEN_LOG: 3 }

const EXTENSION_TO_TYPE: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
}

const TYPE_TO_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

function validationError(message: string, field?: string): ApiError {
  return new ApiError({
    status: 0,
    code: "VALIDATION_ERROR",
    message,
    fields: field ? [{ field, code: "VALIDATION_ERROR", message }] : [],
  })
}

export function extensionOf(uri: string): string | undefined {
  const path = uri.split(/[?#]/, 1)[0] ?? ""
  return path.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase()
}

/** 파일 확장자 → Content-Type. 모르는 확장자면 null */
export function contentTypeOf(uri: string): string | null {
  const extension = extensionOf(uri)
  return extension ? (EXTENSION_TO_TYPE[extension] ?? null) : null
}

async function fileSizeOf(uri: string): Promise<number> {
  const info = await FileSystem.getInfoAsync(uri)
  if (!info.exists) throw validationError("사진을 찾을 수 없어요. 다시 선택해 주세요.", "images")
  const size = info.size ?? 0
  if (size <= 0) throw validationError("사진을 읽을 수 없어요. 다시 선택해 주세요.", "images")
  return size
}

export function createFileApi(client: ApiClient = apiClient) {
  const api = {
    /** 업로드 주소 받기 */
    tickets(body: UploadTicketRequest): Promise<UploadTicketResponse> {
      return client.post<UploadTicketResponse>("/files/upload-tickets", body)
    },

    /** 받은 방식(POST 멀티파트 · PUT 원본)대로 한 장을 올린다 */
    async upload(ticket: UploadTicket, uri: string, contentType: string): Promise<string> {
      const result =
        ticket.method === "POST"
          ? await FileSystem.uploadAsync(ticket.url, uri, {
              httpMethod: "POST",
              uploadType: FileSystem.FileSystemUploadType.MULTIPART,
              fieldName: "file",
              mimeType: contentType,
              parameters: ticket.fields ?? {},
              headers: ticket.headers ?? undefined,
            })
          : await FileSystem.uploadAsync(ticket.url, uri, {
              httpMethod: "PUT",
              uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
              headers: { "Content-Type": contentType, ...(ticket.headers ?? {}) },
            })

      if (result.status < 200 || result.status >= 300) {
        throw new ApiError({
          status: result.status,
          code: "HTTP_ERROR",
          message: "사진을 올리지 못했어요. 잠시 후 다시 시도해 주세요.",
        })
      }
      return ticket.imageUrl
    },

    /**
     * 기기에 있는 사진들을 올리고 주소를 순서대로 돌려준다.
     * 한 장이라도 실패하면 오류를 낸다(이미 올라간 파일은 서버가 정리한다).
     */
    async uploadImages(purpose: UploadPurpose, uris: readonly string[]): Promise<string[]> {
      if (uris.length === 0) return []
      const limit = UPLOAD_COUNT_LIMIT[purpose]
      if (uris.length > limit) throw validationError(`사진은 ${limit}장까지 올릴 수 있어요.`, "images")

      const files: UploadTicketRequest["files"] = []
      for (const uri of uris) {
        if (/^https?:\/\//i.test(uri)) throw validationError("기기에 있는 사진만 올릴 수 있어요.", "images")
        const contentType = contentTypeOf(uri)
        if (!contentType) throw validationError("JPG·PNG·WEBP 사진만 올릴 수 있어요.", "images")
        if ((await fileSizeOf(uri)) > MAX_IMAGE_BYTES) {
          throw validationError("사진 한 장은 10MB까지 올릴 수 있어요.", "images")
        }
        files.push({ contentType, extension: extensionOf(uri) ?? TYPE_TO_EXTENSION[contentType] })
      }

      const { uploads } = await api.tickets({ purpose, files })
      if (!uploads || uploads.length !== uris.length) {
        throw new ApiError({ status: 0, code: "INVALID_RESPONSE", message: "사진 업로드 주소를 받지 못했어요." })
      }
      const urls: string[] = []
      for (const [index, ticket] of uploads.entries()) {
        urls.push(await api.upload(ticket, uris[index], files[index].contentType))
      }
      return urls
    },
  } as const
  return api
}

export const fileApi = createFileApi()
export type FileApi = ReturnType<typeof createFileApi>
