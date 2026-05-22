// Minimal toast helper — no external lib. Uses CustomEvent so it works across
// the React tree without context plumbing.

export type ToastKind = 'error' | 'success' | 'info'
export type ToastPayload = {
  kind: ToastKind
  message: string
  durationMs?: number
}

export function showToast(payload: ToastPayload) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent('careerpilot:toast', { detail: payload }),
  )
}

export async function fetchWithToast(
  input: RequestInfo,
  init?: RequestInit,
): Promise<Response> {
  const res = await fetch(input, init)
  if (res.status >= 500) {
    showToast({
      kind: 'error',
      message: 'Сервер недоступен. Попробуйте ещё раз через минуту.',
      durationMs: 6000,
    })
  } else if (res.status === 429) {
    showToast({
      kind: 'error',
      message: 'Слишком много запросов. Подождите немного.',
      durationMs: 5000,
    })
  }
  return res
}
