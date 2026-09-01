"use client"

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { Pause, Play, RotateCcw, Square } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  DURATION_PRESETS,
  createSessionId,
  formatClock,
  formatDuration,
  loadSessions,
  saveSessions,
  startOfToday,
  type DeepWorkSession,
} from "@/lib/sessions"
import { cn } from "@/lib/utils"

type TimerPhase = "idle" | "running" | "paused"

export function DeepWorkTimer() {
  const [intention, setIntention] = useState("")
  const [plannedMinutes, setPlannedMinutes] = useState(90)
  const [customMinutes, setCustomMinutes] = useState("90")
  const [phase, setPhase] = useState<TimerPhase>("idle")
  const [remainingMs, setRemainingMs] = useState(90 * 60_000)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [sessions, setSessions] = useState<DeepWorkSession[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [storageError, setStorageError] = useState<string | null>(null)
  const [customError, setCustomError] = useState<string | null>(null)
  const tickRef = useRef<number | null>(null)
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )

  if (isClient && !hydrated) {
    setHydrated(true)
    try {
      setSessions(loadSessions())
      setStorageError(null)
    } catch (error) {
      setStorageError(
        error instanceof Error ? error.message : "无法读取本地会话记录"
      )
    }
  }

  useEffect(() => {
    if (phase !== "running") {
      if (tickRef.current) window.clearInterval(tickRef.current)
      tickRef.current = null
      return
    }

    const endsAt = Date.now() + remainingMs
    let completed = false
    tickRef.current = window.setInterval(() => {
      const nextRemaining = Math.max(0, endsAt - Date.now())
      setRemainingMs(nextRemaining)
      setElapsedMs(plannedMinutes * 60_000 - nextRemaining)
      if (nextRemaining <= 0 && !completed) {
        completed = true
        if (tickRef.current) window.clearInterval(tickRef.current)
        finishSession("completed", plannedMinutes * 60_000)
      }
    }, 250)

    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current)
    }
    // finishSession is stable enough for this client widget
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, plannedMinutes])

  const todaySessions = useMemo(
    () => sessions.filter((session) => session.endedAt >= startOfToday()),
    [sessions]
  )
  const todayCompleted = todaySessions.filter(
    (session) => session.status === "completed"
  )
  const todayMs = todayCompleted.reduce(
    (total, session) => total + session.elapsedMs,
    0
  )
  const progress = Math.min(
    1,
    elapsedMs / Math.max(plannedMinutes * 60_000, 1)
  )

  function persist(next: DeepWorkSession[]) {
    setSessions(next)
    try {
      saveSessions(next)
      setStorageError(null)
    } catch {
      setStorageError("会话已完成，但写入浏览器存储失败。")
    }
  }

  function appendSession(session: DeepWorkSession) {
    setSessions((prev) => {
      const next = [session, ...prev].slice(0, 40)
      try {
        saveSessions(next)
        setStorageError(null)
      } catch {
        setStorageError("会话已完成，但写入浏览器存储失败。")
      }
      return next
    })
  }

  function applyMinutes(minutes: number) {
    setCustomError(null)
    setPlannedMinutes(minutes)
    setCustomMinutes(String(minutes))
    if (phase === "idle") {
      setRemainingMs(minutes * 60_000)
      setElapsedMs(0)
    }
  }

  function applyCustomMinutes() {
    const parsed = Number(customMinutes)
    if (!Number.isFinite(parsed) || parsed < 5 || parsed > 240) {
      setCustomError("请输入 5 到 240 之间的分钟数。")
      return
    }
    applyMinutes(Math.round(parsed))
  }

  function startTimer() {
    const trimmed = intention.trim()
    if (!trimmed) {
      setCustomError("先写下一件要做的事，再开始。")
      return
    }
    setCustomError(null)
    if (phase === "idle") {
      setRemainingMs(plannedMinutes * 60_000)
      setElapsedMs(0)
      setStartedAt(Date.now())
    }
    setPhase("running")
  }

  function pauseTimer() {
    setPhase("paused")
  }

  function resetTimer() {
    setPhase("idle")
    setRemainingMs(plannedMinutes * 60_000)
    setElapsedMs(0)
    setStartedAt(null)
  }

  function finishSession(status: DeepWorkSession["status"], finalElapsed: number) {
    const now = Date.now()
    const session: DeepWorkSession = {
      id: createSessionId(),
      intention: intention.trim() || "未命名块",
      plannedMinutes,
      elapsedMs: Math.max(30_000, finalElapsed),
      startedAt: startedAt ?? now - finalElapsed,
      endedAt: now,
      status,
    }
    appendSession(session)
    setPhase("idle")
    setRemainingMs(plannedMinutes * 60_000)
    setElapsedMs(0)
    setStartedAt(null)
    if (status === "completed") {
      setIntention("")
    }
  }

  if (!hydrated) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>正在读取今天的记录…</CardTitle>
            <CardDescription>从浏览器本地存储恢复会话。</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-32 animate-pulse rounded-xl bg-muted" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      {storageError ? (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {storageError}
        </div>
      ) : null}

      <Card className="overflow-hidden">
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">github_deepwork_test</Badge>
            <Badge variant={phase === "running" ? "default" : "outline"}>
              {phase === "running"
                ? "进行中"
                : phase === "paused"
                  ? "已暂停"
                  : "待开始"}
            </Badge>
          </div>
          <CardTitle className="text-2xl tracking-tight md:text-3xl">
            先写清意图，再进入一段不被打断的工作。
          </CardTitle>
          <CardDescription>
            选一个时长，开始后只做这一件事。记录会留在这台设备的浏览器里。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium">这一段要完成什么</span>
            <Input
              value={intention}
              onChange={(event) => setIntention(event.target.value)}
              placeholder="例如：写完 github_deepwork 的第一版计时器"
              disabled={phase !== "idle"}
              className="h-11 text-base"
            />
          </label>

          <div className="grid gap-2 sm:grid-cols-3">
            {DURATION_PRESETS.map((preset) => (
              <button
                key={preset.minutes}
                type="button"
                disabled={phase !== "idle"}
                onClick={() => applyMinutes(preset.minutes)}
                className={cn(
                  "rounded-xl border px-4 py-3 text-left transition-colors disabled:opacity-50",
                  plannedMinutes === preset.minutes
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background hover:bg-muted"
                )}
              >
                <div className="text-lg font-medium">{preset.minutes} 分钟</div>
                <div
                  className={cn(
                    "text-sm",
                    plannedMinutes === preset.minutes
                      ? "text-background/70"
                      : "text-muted-foreground"
                  )}
                >
                  {preset.label} · {preset.hint}
                </div>
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="flex min-w-0 flex-1 flex-col gap-2">
              <span className="text-sm font-medium">自定义分钟</span>
              <Input
                inputMode="numeric"
                value={customMinutes}
                disabled={phase !== "idle"}
                onChange={(event) => setCustomMinutes(event.target.value)}
                onBlur={applyCustomMinutes}
                onKeyDown={(event) => {
                  if (event.key === "Enter") applyCustomMinutes()
                }}
              />
            </label>
            <Button
              variant="outline"
              className="sm:mb-px"
              disabled={phase !== "idle"}
              onClick={applyCustomMinutes}
            >
              使用这个时长
            </Button>
          </div>

          {customError ? (
            <p className="text-sm text-destructive">{customError}</p>
          ) : null}

          <div className="relative overflow-hidden rounded-2xl bg-muted/70 px-6 py-10 text-center">
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 bg-foreground/8 transition-[height]"
              style={{ height: `${Math.round(progress * 100)}%` }}
            />
            <div className="relative">
              <p className="font-mono text-6xl tracking-tight tabular-nums md:text-7xl">
                {formatClock(remainingMs / 1000)}
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                {phase === "idle"
                  ? `准备进入 ${plannedMinutes} 分钟`
                  : `已进行 ${formatDuration(elapsedMs)} · 目标 ${plannedMinutes} 分钟`}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            {phase === "running" ? (
              <Button size="lg" className="flex-1" onClick={pauseTimer}>
                <Pause data-icon="inline-start" />
                暂停
              </Button>
            ) : (
              <Button size="lg" className="flex-1" onClick={startTimer}>
                <Play data-icon="inline-start" />
                {phase === "paused" ? "继续" : "开始这段 Deep Work"}
              </Button>
            )}
            <Button
              size="lg"
              variant="outline"
              className="flex-1"
              disabled={phase === "idle"}
              onClick={() => finishSession("completed", elapsedMs)}
            >
              <Square data-icon="inline-start" />
              提前完成
            </Button>
            <Button
              size="lg"
              variant="ghost"
              disabled={phase === "idle"}
              onClick={() => {
                if (elapsedMs > 30_000) {
                  finishSession("abandoned", elapsedMs)
                } else {
                  resetTimer()
                }
              }}
            >
              <RotateCcw data-icon="inline-start" />
              {elapsedMs > 30_000 ? "放弃并记录" : "重置"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>今天的深度工作</CardTitle>
          <CardDescription>
            {todayCompleted.length === 0
              ? "还没有完成的块。第一段结束后会出现在这里。"
              : `已完成 ${todayCompleted.length} 段，合计 ${formatDuration(todayMs)}。`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {todaySessions.length === 0 ? (
            <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              空的。选一个时长，写下意图，然后开始。
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {todaySessions.map((session) => (
                <li key={session.id}>
                  <div className="flex flex-col gap-1 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{session.intention}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDuration(session.elapsedMs)} / {session.plannedMinutes}{" "}
                        分钟 ·{" "}
                        {new Date(session.endedAt).toLocaleTimeString("zh-CN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <Badge
                      variant={
                        session.status === "completed" ? "secondary" : "outline"
                      }
                    >
                      {session.status === "completed" ? "完成" : "中断"}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {sessions.length > 0 ? (
            <>
              <Separator />
              <Button
                variant="ghost"
                className="self-start"
                onClick={() => persist([])}
              >
                清空全部记录
              </Button>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
