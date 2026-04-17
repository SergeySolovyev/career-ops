'use client'

import { useChat } from '@ai-sdk/react'
import { Send, Mic, MicOff, Bot, User } from 'lucide-react'
import { useRef, useState, useEffect, useCallback } from 'react'

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

  // Check Web Speech API support
  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
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
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="border-b border-border px-6 py-4">
        <h1 className="text-xl font-bold">AI Карьерный Советник</h1>
        <p className="text-sm text-muted-foreground">
          Спросите о вакансиях, подготовке к интервью, стратегии поиска
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <Bot className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">Привет! Я ваш AI карьерный советник.</p>
            <p className="mt-2 max-w-md">
              Я знаю ваш профиль и оценённые вакансии. Спросите меня о чём угодно:
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {[
                'Как подготовиться к интервью в Сбер?',
                'Какие вакансии мне больше подходят?',
                'Помоги улучшить CV для AI-позиций',
                'Стратегия переговоров по зарплате',
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-secondary transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.role === 'assistant' && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Bot className="h-4 w-4" />
              </div>
            )}
            <div
              className={`rounded-2xl px-4 py-3 max-w-[80%] ${
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground'
              }`}
            >
              {message.parts.map((part, i) =>
                part.type === 'text' ? (
                  <p key={i} className="text-sm whitespace-pre-wrap">{part.text}</p>
                ) : null
              )}
            </div>
            {message.role === 'user' && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                <User className="h-4 w-4" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Bot className="h-4 w-4" />
            </div>
            <div className="rounded-2xl bg-secondary px-4 py-3">
              <div className="flex space-x-1">
                <div className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border px-6 py-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          {speechSupported && (
            <button
              type="button"
              onClick={toggleListening}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                isListening
                  ? 'border-red-500 bg-red-50 text-red-600 animate-pulse'
                  : 'border-border hover:bg-secondary'
              }`}
              title={isListening ? 'Остановить запись' : 'Голосовой ввод'}
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
          )}
          <input
            name="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isListening ? 'Слушаю...' : 'Спросите что-нибудь...'}
            className="flex-1 rounded-lg border border-border px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
        {isListening && (
          <p className="mt-2 text-xs text-red-500 animate-pulse">
            Говорите... (распознавание речи активно)
          </p>
        )}
      </div>
    </div>
  )
}
