'use client'

import { useChat } from '@ai-sdk/react'
import {
  Send,
  Mic,
  MicOff,
  Bot,
  User,
  Sparkles,
  Command,
  CornerDownLeft,
} from 'lucide-react'
import { useRef, useState, useEffect, useCallback } from 'react'

/* ============================================================
   CareerPilot · Chat — AI Career Advisor
   Client component — preserves useChat + Web Speech API + all handlers.
   Visual layer refreshed — Linear/Notion/Raycast aesthetic.
   ============================================================ */

const SUGGESTIONS = [
  'Как подготовиться к интервью в Сбер?',
  'Какие вакансии мне больше подходят?',
  'Помоги улучшить CV для AI-позиций',
  'Стратегия переговоров по зарплате',
]

export default function ChatPage() {
  const { messages, sendMessage, status } = useChat()
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [isListening, setIsListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const recognitionRef = useRef<any>(null)

  const isLoading = status === 'streaming' || status === 'submitted'

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Web Speech API — preserved
  useEffect(() => {
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition
    if (SR) {
      setSpeechSupported(true)
      const recognition = new SR()
      recognition.lang = 'ru-RU'
      recognition.continuous = false
      recognition.interimResults = false

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript
        setInput(transcript)
        setIsListening(false)
      }

      recognition.onerror = () => setIsListening(false)
      recognition.onend = () => setIsListening(false)
      recognitionRef.current = recognition
    }
  }, [])

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return
    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      recognitionRef.current.start()
      setIsListening(true)
    }
  }, [isListening])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    sendMessage({ text: input })
    setInput('')
  }

  return (
    <div className="-m-8 flex h-screen flex-col bg-white text-slate-900 antialiased">
      {/* Top bar */}
      <header className="flex-none border-b border-slate-200 bg-white/80 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-[860px] items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-slate-900 text-white">
              <Sparkles size={14} />
            </span>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Advisor · v4.2
              </div>
              <h1 className="text-[15px] font-semibold tracking-[-0.01em]">
                AI Карьерный Советник
              </h1>
            </div>
          </div>
          <span className="pill">
            <span className="pulse-dot" />
            online
          </span>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full max-w-[860px] flex-col px-6 py-6">
          {messages.length === 0 && (
            <EmptyStart
              onPick={(text) => setInput(text)}
            />
          )}

          <div className="space-y-5">
            {messages.map((message) => {
              const isUser = message.role === 'user'
              return (
                <div
                  key={message.id}
                  className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isUser && (
                    <span className="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-slate-900 text-white shadow-sm">
                      <Bot size={14} />
                    </span>
                  )}
                  <div
                    className={`max-w-[76%] rounded-lg px-4 py-3 text-[14px] leading-[1.55] ${
                      isUser
                        ? 'bg-slate-900 text-white'
                        : 'border border-slate-200 bg-white text-slate-800'
                    }`}
                  >
                    {message.parts.map((part, i) =>
                      part.type === 'text' ? (
                        <p key={i} className="whitespace-pre-wrap">
                          {part.text}
                        </p>
                      ) : null,
                    )}
                  </div>
                  {isUser && (
                    <span className="flex h-8 w-8 flex-none items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600">
                      <User size={14} />
                    </span>
                  )}
                </div>
              )
            })}

            {isLoading && (
              <div className="flex gap-3">
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-slate-900 text-white shadow-sm">
                  <Bot size={14} />
                </span>
                <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 rounded-full bg-slate-400 animate-bounce"
                      style={{ animationDelay: '0ms' }}
                    />
                    <span
                      className="h-2 w-2 rounded-full bg-slate-400 animate-bounce"
                      style={{ animationDelay: '150ms' }}
                    />
                    <span
                      className="h-2 w-2 rounded-full bg-slate-400 animate-bounce"
                      style={{ animationDelay: '300ms' }}
                    />
                    <span className="ml-2 font-mono text-[10.5px] uppercase tracking-wider text-slate-400">
                      thinking…
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Composer */}
      <div className="flex-none border-t border-slate-200 bg-white px-6 py-4">
        <form onSubmit={handleSubmit} className="mx-auto max-w-[860px]">
          <div
            className={`flex items-center gap-2 rounded-lg border bg-white p-2 transition-colors ${
              isListening
                ? 'border-red-300 ring-2 ring-red-100'
                : 'border-slate-200 focus-within:border-slate-300 focus-within:ring-4 focus-within:ring-slate-100'
            }`}
          >
            {speechSupported && (
              <button
                type="button"
                onClick={toggleListening}
                className={`flex h-9 w-9 flex-none items-center justify-center rounded-md transition-colors ${
                  isListening
                    ? 'bg-red-50 text-red-600 animate-pulse'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                }`}
                title={isListening ? 'Остановить запись' : 'Голосовой ввод'}
              >
                {isListening ? <MicOff size={15} /> : <Mic size={15} />}
              </button>
            )}
            <input
              name="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                isListening ? 'Слушаю…' : 'Спросите о вакансиях, интервью, CV…'
              }
              className="flex-1 bg-transparent px-2 py-1.5 text-[14px] placeholder:text-slate-400 focus:outline-none"
              disabled={isLoading}
              autoComplete="off"
            />
            <div className="hidden items-center gap-1 font-mono text-[10.5px] text-slate-400 sm:flex">
              <span className="kbd">
                <Command size={9} />
              </span>
              <span className="kbd">
                <CornerDownLeft size={9} />
              </span>
            </div>
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="flex h-9 flex-none items-center gap-1.5 rounded-md bg-slate-900 px-3 text-[12.5px] font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-40"
            >
              Send
              <Send size={13} />
            </button>
          </div>
          {isListening && (
            <p className="mt-2 text-center font-mono text-[10.5px] uppercase tracking-wider text-red-600">
              ● recording · speak now
            </p>
          )}
        </form>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------
   EmptyStart — hero before any messages
   ------------------------------------------------------------ */

function EmptyStart({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
      <div className="relative mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-slate-900 text-white">
        <Bot size={22} />
        <span
          className="absolute -inset-2 -z-10 rounded-2xl opacity-60 blur-xl"
          style={{
            background:
              'radial-gradient(circle, rgba(37,99,235,0.3) 0%, transparent 70%)',
          }}
        />
      </div>

      <div className="font-mono text-[10.5px] uppercase tracking-wider text-slate-500">
        Context-aware advisor
      </div>
      <h2 className="mt-1 text-[24px] font-semibold tracking-[-0.015em] text-slate-900">
        Привет! Я знаю ваш CV и матчи.
      </h2>
      <p className="mt-2 max-w-[420px] text-[13.5px] leading-[1.55] text-slate-500">
        Спросите о подготовке к интервью, критериях выбора, переговорах. Контекст
        RAG подгружает ваш профиль и последние AI-оценки.
      </p>

      <div className="mt-6 grid w-full max-w-[560px] gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="tile group flex items-center justify-between rounded-md border border-slate-200 bg-white px-3.5 py-2.5 text-left text-[13px] text-slate-700 hover:bg-slate-50"
          >
            <span className="truncate pr-2">{s}</span>
            <CornerDownLeft
              size={13}
              className="flex-none text-slate-400 transition-transform group-hover:translate-x-0.5"
            />
          </button>
        ))}
      </div>

      <div className="mt-6 flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-wider text-slate-400">
        <span className="pulse-dot" />
        Model: claude-sonnet-4.5 · RAG context: profile + evals
      </div>
    </div>
  )
}
