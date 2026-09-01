import { DeepWorkTimer } from "@/components/deep-work-timer"

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
              Deep Work
            </p>
            <h1 className="text-lg font-medium">github_deepwork</h1>
          </div>
          <p className="hidden text-sm text-muted-foreground sm:block">
            一次只做一件事
          </p>
        </div>
      </header>
      <main className="flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <DeepWorkTimer />
      </main>
    </div>
  )
}
