export type SessionStatus = "completed" | "abandoned"

export type DeepWorkSession = {
  id: string
  intention: string
  plannedMinutes: number
  elapsedMs: number
  startedAt: number
  endedAt: number
  status: SessionStatus
}

export const STORAGE_KEY = "github_deepwork.sessions.v1"

export const DURATION_PRESETS = [
  { label: "短冲", minutes: 25, hint: "先打开状态" },
  { label: "专注块", minutes: 50, hint: "写完一块再停" },
  { label: "深度块", minutes: 90, hint: "经典 Deep Work" },
] as const

export function createSessionId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function formatClock(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

export function formatDuration(ms: number) {
  const minutes = Math.max(1, Math.round(ms / 60_000))
  return `${minutes} 分钟`
}

export function startOfToday() {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return now.getTime()
}

export function loadSessions(): DeepWorkSession[] {
  if (typeof window === "undefined") return []
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return []
  const parsed = JSON.parse(raw) as unknown
  if (!Array.isArray(parsed)) {
    throw new Error("会话记录格式无效")
  }
  return parsed.filter(isSession)
}

export function saveSessions(sessions: DeepWorkSession[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
}

function isSession(value: unknown): value is DeepWorkSession {
  if (!value || typeof value !== "object") return false
  const session = value as DeepWorkSession
  return (
    typeof session.id === "string" &&
    typeof session.intention === "string" &&
    typeof session.plannedMinutes === "number" &&
    typeof session.elapsedMs === "number" &&
    typeof session.startedAt === "number" &&
    typeof session.endedAt === "number" &&
    (session.status === "completed" || session.status === "abandoned")
  )
}
