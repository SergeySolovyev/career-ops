"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Search,
  Brain,
  FileText,
  Rocket,
  Star,
  TrendingUp,
  LayoutDashboard,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Check,
  Sparkles,
} from "lucide-react";

/* ============================================================
   CareerPilot · Landing
   - Hero with subtle 3D-ish canvas animation (AI search radar)
   - Proof tiles (live stats)
   - Product screenshot carousel (dashboard / matches / chat)
   - Feature grid with micro-illustrations
   - Pricing · Footer
   ============================================================ */

export default function Page() {
  return (
    <main className="min-h-screen bg-white text-slate-900 antialiased">
      <AnnouncementBar />
      <Header />
      <Hero />
      <LogoTicker />
      <ProofTiles />
      <ScreenCarousel />
      <FeatureGrid />
      <Pricing />
      <FinalCTA />
      <Footer />
    </main>
  );
}

/* ---------------- announcement + header ---------------- */

function AnnouncementBar() {
  return (
    <div className="w-full border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-9 max-w-[1200px] items-center justify-center gap-2 px-6 text-[12px] text-slate-500">
        <span className="pulse-dot" />
        <span>
          Сканируем вакансии прямо сейчас —{" "}
          <span className="font-medium text-slate-900">109</span> открытых ролей
          за последние 24 часа
        </span>
        <span className="text-slate-300">·</span>
        <Link
          href="/dashboard"
          className="font-medium text-slate-900 underline-offset-2 hover:underline"
        >
          Смотреть →
        </Link>
      </div>
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-slate-900 text-white">
            <Sparkles size={14} />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">
            CareerPilot
          </span>
          <span className="ml-1 rounded border border-slate-200 px-1.5 py-[1px] font-mono text-[10px] text-slate-500">
            BETA
          </span>
        </Link>
        <nav className="hidden items-center gap-7 text-[13.5px] text-slate-500 md:flex">
          <a href="#features" className="transition hover:text-slate-900">
            Возможности
          </a>
          <a href="#screens" className="transition hover:text-slate-900">
            Продукт
          </a>
          <a href="#pricing" className="transition hover:text-slate-900">
            Тарифы
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="inline-flex h-9 items-center px-3 text-[13.5px] text-slate-500 hover:text-slate-900"
          >
            Войти
          </Link>
          <Link href="/signup" className="btn-primary h-9 text-[13px]">
            Начать бесплатно
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ---------------- hero ---------------- */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-bg grid-fade" />
      <div className="relative mx-auto grid max-w-[1200px] grid-cols-12 gap-10 px-6 pt-20 pb-24 items-center">
        <div className="col-span-12 lg:col-span-6">
          <div className="pill mb-6">
            <span className="pulse-dot" />
            <span>Для Director / VP · FinTech · AI/ML · Банки</span>
          </div>
          <h1 className="grad-text text-[56px] font-semibold leading-[1.04] tracking-[-0.03em]">
            AI найдёт
            <br />
            работу <mark className="hl">за вас</mark>
          </h1>
          <p className="mt-6 max-w-[520px] text-[17px] leading-[1.6] text-slate-500">
            Загрузите резюме — остальное сделаем мы. Сканирование вакансий,
            AI-оценка по 10 критериям, генерация CV и авто-отклик — всё на
            автопилоте.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/signup" className="btn-primary">
              Начать бесплатно <ArrowRight size={14} />
            </Link>
            <Link href="/dashboard" className="btn-secondary">
              <LayoutDashboard size={14} />
              Открыть демо-кабинет
            </Link>
            <Link href="/chat" className="btn-secondary">
              <MessageSquare size={14} />
              Спросить AI
            </Link>
          </div>
          <div className="mt-6 flex items-center gap-3 text-[12.5px] text-slate-500">
            <span>Демо с реальными данными. Без регистрации.</span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1">
              <kbd className="kbd">⌘</kbd>
              <kbd className="kbd">K</kbd> для поиска
            </span>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-6">
          <HeroVisual />
          <div className="mt-3 flex items-center justify-between text-[12px] text-slate-500">
            <span>Real-time AI match engine</span>
            <span className="font-mono">109 vacancies · 10-dim scoring</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroVisual() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [matchPct, setMatchPct] = useState("0.87");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0,
      H = 0;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      W = r.width;
      H = r.height;
      canvas.width = W * DPR;
      canvas.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const N = 38;
    const nodes = Array.from({ length: N }, (_, i) => ({
      x: Math.random(),
      y: Math.random(),
      z: 0.3 + Math.random() * 0.7,
      s: 0.6 + Math.random() * 1.0,
      p: Math.random() * Math.PI * 2,
      src: ["hh", "li", "tg", "co"][i % 4],
    }));

    const start = performance.now();
    let raf = 0;

    const draw = (now: number) => {
      const t = (now - start) / 1000;
      ctx.clearRect(0, 0, W, H);

      const g = ctx.createRadialGradient(
        W * 0.5,
        H * 0.45,
        20,
        W * 0.5,
        H * 0.45,
        Math.max(W, H) * 0.7
      );
      g.addColorStop(0, "#f8fafc");
      g.addColorStop(1, "#ffffff");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      ctx.strokeStyle = "rgba(15,23,42,0.05)";
      ctx.lineWidth = 1;
      const horizon = H * 0.52;
      for (let i = 0; i <= 12; i++) {
        const y = horizon + Math.pow(i / 12, 2) * (H - horizon);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
      for (let i = -8; i <= 8; i++) {
        const x = W / 2 + i * (W * 0.14);
        ctx.beginPath();
        ctx.moveTo(W / 2, horizon);
        ctx.lineTo(x, H);
        ctx.stroke();
      }

      const beamY = ((Math.sin(t * 0.9) + 1) / 2) * H;
      const bg2 = ctx.createLinearGradient(0, beamY - 40, 0, beamY + 40);
      bg2.addColorStop(0, "rgba(37,99,235,0)");
      bg2.addColorStop(0.5, "rgba(37,99,235,0.12)");
      bg2.addColorStop(1, "rgba(37,99,235,0)");
      ctx.fillStyle = bg2;
      ctx.fillRect(0, beamY - 40, W, 80);

      const cx = W * 0.5,
        cy = H * 0.48;
      ctx.strokeStyle = "rgba(37,99,235,0.35)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(cx, cy, 38 + Math.sin(t * 2) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(37,99,235,0.18)";
      ctx.beginPath();
      ctx.arc(cx, cy, 80, 0, Math.PI * 2);
      ctx.stroke();

      for (const n of nodes) {
        const ax = (n.x + Math.sin(t * 0.3 + n.p) * 0.02) * W;
        const ay = (n.y + Math.cos(t * 0.25 + n.p * 1.3) * 0.02) * H;
        const size = 2 + n.s * n.z * 3;
        const active = Math.abs(ay - beamY) < 60;
        const m = 0.5 + 0.5 * Math.sin(t * 0.6 + n.p * 2);
        if (active && m > 0.6) {
          ctx.strokeStyle = `rgba(37,99,235,${0.15 + 0.25 * m})`;
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(cx, cy);
          ctx.stroke();
        }
        ctx.fillStyle = active
          ? "rgba(37,99,235,0.9)"
          : "rgba(15,23,42,0.55)";
        ctx.beginPath();
        ctx.arc(ax, ay, size, 0, Math.PI * 2);
        ctx.fill();
        if (active) {
          ctx.fillStyle = "rgba(37,99,235,0.12)";
          ctx.beginPath();
          ctx.arc(ax, ay, size + 6, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (Math.floor(t * 4) % 2 === 0) {
        setMatchPct((0.72 + 0.18 * (0.5 + 0.5 * Math.sin(t * 0.8))).toFixed(2));
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  const cards = [
    { t: "VP Engineering", c: "Т-Банк", m: "4.6", x: 12, y: 18 },
    { t: "Director ML", c: "Яндекс", m: "4.3", x: 68, y: 30 },
    { t: "Head of AI", c: "Сбер", m: "3.8", x: 22, y: 64 },
    { t: "VP Product", c: "Ozon", m: "4.1", x: 60, y: 70 },
  ];

  return (
    <div
      className="card lift relative overflow-hidden"
      style={{ aspectRatio: "5 / 4" }}
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
      <div className="absolute inset-x-0 top-0 flex h-9 items-center justify-between border-b border-slate-200 bg-white/70 px-3 backdrop-blur">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#f87171]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#fbbf24]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#34d399]" />
        </div>
        <div className="font-mono text-[11px] text-slate-500">
          pilot.match.engine · v4.2
        </div>
        <div className="flex items-center gap-1 text-[11px] text-slate-500">
          <span className="pulse-dot" /> scanning
        </div>
      </div>
      <div className="pointer-events-none absolute inset-0">
        {cards.map((d, i) => (
          <div
            key={i}
            className="absolute floaty"
            style={{
              left: `${d.x}%`,
              top: `${d.y}%`,
              transform: "translate(-50%,-50%)",
              animationDelay: `${i * 0.4}s`,
              animationDuration: `${6 + i}s`,
            }}
          >
            <div
              className="card"
              style={{
                padding: "8px 10px",
                minWidth: 168,
                backdropFilter: "blur(6px)",
                background: "rgba(255,255,255,0.92)",
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-[11.5px] font-semibold tracking-tight">
                    {d.t}
                  </div>
                  <div className="mt-[1px] text-[10px] text-slate-500">
                    {d.c}
                  </div>
                </div>
                <div
                  className="font-mono text-[11px] font-semibold"
                  style={{
                    color: parseFloat(d.m) >= 4.0 ? "#2563eb" : "#0f172a",
                  }}
                >
                  {d.m}
                </div>
              </div>
              <div
                style={{
                  marginTop: 6,
                  height: 3,
                  borderRadius: 2,
                  background: "#eef2ff",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${(parseFloat(d.m) / 5) * 100}%`,
                    background: "#2563eb",
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between border-t border-slate-200 bg-white/80 px-4 py-2.5 backdrop-blur">
        <div className="flex items-center gap-4 font-mono text-[11.5px] text-slate-500">
          <span>
            <span className="text-slate-900">hh.ru</span> · 42
          </span>
          <span>
            <span className="text-slate-900">linkedin</span> · 31
          </span>
          <span>
            <span className="text-slate-900">tg channels</span> · 28
          </span>
          <span>
            <span className="text-slate-900">corporate</span> · 8
          </span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11.5px] text-slate-900">
          match → <span className="text-[#2563eb]">{matchPct}</span>
        </div>
      </div>
    </div>
  );
}

/* ---------------- logo ticker ---------------- */

function LogoTicker() {
  const items = [
    "hh.ru",
    "LinkedIn",
    "Habr Career",
    "Telegram Jobs",
    "getmatch",
    "Tinkoff",
    "Sber AI",
    "Yandex",
    "Ozon Tech",
    "Wildberries",
    "Alfa-Bank",
    "VK",
  ];
  return (
    <div className="mx-auto max-w-[1200px] px-6 pb-16">
      <div className="mb-4 font-mono text-[11px] uppercase tracking-wider text-slate-500">
        Сканируем вакансии из
      </div>
      <div className="overflow-hidden border-y border-slate-200">
        <div className="ticker flex gap-7 py-5 text-[14px] text-slate-500 whitespace-nowrap">
          {[0, 1].map((k) => (
            <div key={k} className="flex items-center gap-8 pr-8" aria-hidden={k === 1}>
              {items.map((n, i) => (
                <span key={i} className="flex items-center gap-8">
                  <span className="font-medium text-slate-900">{n}</span>
                  <span>·</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- proof tiles ---------------- */

function ProofTiles() {
  return (
    <section className="mx-auto max-w-[1200px] px-6 pb-24">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
            Live · 04.20.2026
          </div>
          <h2 className="mt-1 text-[28px] font-semibold tracking-tight">
            Результаты за последние 24 часа
          </h2>
        </div>
        <div className="hidden text-[12.5px] text-slate-500 md:block">
          Данные демо-кабинета · обновляется каждые 5 минут
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          icon={<Search size={18} />}
          badge={<span className="font-mono text-[11px] text-emerald-600">▲ 12%</span>}
          value="109"
          label="вакансий найдено"
          extra={
            <div className="bar">
              <span style={{ width: "78%" }} />
            </div>
          }
        />
        <Tile
          icon={<Brain size={18} />}
          badge={<span className="font-mono text-[11px] text-slate-500">/ month</span>}
          value="31"
          label="AI-отчётов"
          extra={
            <div className="flex items-end gap-[3px]">
              {[10, 14, 8, 18, 12, 22, 16, 26].map((h, i) => (
                <div
                  key={i}
                  className={`w-1 ${i % 3 === 0 ? "bg-[#2563eb]" : "bg-slate-300"}`}
                  style={{ height: `${h}px` }}
                />
              ))}
            </div>
          }
        />
        <Tile
          icon={<Star size={18} />}
          badge={<span className="font-mono text-[11px] text-[#2563eb]">match ≥ 3.5</span>}
          value="17"
          label="рекомендовано"
          extra={
            <div className="-space-x-2 flex">
              {["SB", "YA", "TN"].map((t, i) => (
                <div
                  key={t}
                  className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white font-mono text-[10px] text-slate-900"
                  style={{
                    background: ["#e2e8f0", "#cbd5e1", "#94a3b8"][i],
                    color: i === 2 ? "#fff" : "#0f172a",
                  }}
                >
                  {t}
                </div>
              ))}
              <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-[#2563eb] font-mono text-[10px] text-white">
                +14
              </div>
            </div>
          }
        />
        <Tile
          icon={<TrendingUp size={18} />}
          badge={<span className="font-mono text-[11px] text-slate-500">avg</span>}
          value={
            <>
              1.8<span className="text-[24px] text-slate-500">/5</span>
            </>
          }
          label="средний AI-скор"
          extra={
            <div className="flex gap-1">
              <span className="h-1 flex-1 rounded-full bg-[#2563eb]" />
              <span className="h-1 flex-1 rounded-full bg-[#2563eb] opacity-60" />
              <span className="h-1 flex-1 rounded-full bg-slate-200" />
              <span className="h-1 flex-1 rounded-full bg-slate-200" />
              <span className="h-1 flex-1 rounded-full bg-slate-200" />
            </div>
          }
        />
      </div>
    </section>
  );
}

function Tile({
  icon,
  badge,
  value,
  label,
  extra,
}: {
  icon: React.ReactNode;
  badge: React.ReactNode;
  value: React.ReactNode;
  label: string;
  extra: React.ReactNode;
}) {
  return (
    <div className="card relative overflow-hidden p-5">
      <div className="flex items-center justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#eff6ff] text-[#2563eb]">
          {icon}
        </div>
        {badge}
      </div>
      <div className="mt-6">
        <div className="text-[44px] font-semibold leading-none tracking-[-0.03em]">
          {value}
        </div>
        <div className="mt-2 text-[13px] text-slate-500">{label}</div>
      </div>
      <div className="mt-4">{extra}</div>
    </div>
  );
}

/* ---------------- product screenshot carousel ---------------- */

function ScreenCarousel() {
  const [i, setI] = useState(0);
  const N = 3;
  useEffect(() => {
    const id = setInterval(() => setI((v) => (v + 1) % N), 6000);
    return () => clearInterval(id);
  }, []);
  const tabs = ["Dashboard", "Matches", "Chat"];

  return (
    <section
      id="screens"
      className="relative border-y border-slate-200 bg-slate-50"
    >
      <div className="mx-auto max-w-[1200px] px-6 py-24">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
              Продукт
            </div>
            <h2 className="mt-2 max-w-[600px] text-[36px] font-semibold tracking-tight">
              Executive-инструмент. Без лишнего.
            </h2>
          </div>
          <div className="hidden items-center gap-1 md:flex">
            <button
              onClick={() => setI((v) => (v - 1 + N) % N)}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white hover:bg-slate-50"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setI((v) => (v + 1) % N)}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white hover:bg-slate-50"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="mb-5 flex w-fit gap-1 rounded-lg border border-slate-200 bg-white p-1">
          {tabs.map((t, idx) => (
            <button
              key={t}
              onClick={() => setI(idx)}
              className="h-9 rounded-md px-4 text-[13px] font-medium transition"
              style={{
                background: i === idx ? "#0f172a" : "transparent",
                color: i === idx ? "#fff" : "#64748b",
              }}
            >
              {t}
            </button>
          ))}
        </div>

        <div
          className="lift relative overflow-hidden rounded-xl border border-slate-200 bg-white"
          style={{ aspectRatio: "16 / 9" }}
        >
          <div
            className="flex h-full transition-transform duration-500"
            style={{
              width: "300%",
              transform: `translateX(-${i * (100 / N)}%)`,
              transitionTimingFunction: "cubic-bezier(.2,.7,.2,1)",
            }}
          >
            <div className="h-full w-1/3">
              <DashboardScreen />
            </div>
            <div className="h-full w-1/3">
              <MatchesScreen />
            </div>
            <div className="h-full w-1/3">
              <ChatScreen />
            </div>
          </div>
          <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
            {[0, 1, 2].map((idx) => (
              <span
                key={idx}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: i === idx ? 24 : 6,
                  background: i === idx ? "#0f172a" : "#cbd5e1",
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function DashboardScreen() {
  return (
    <div className="flex h-full">
      <aside className="flex w-[220px] flex-col gap-1 border-r border-slate-200 bg-white p-4">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-900 text-white">
            <Sparkles size={12} />
          </span>
          <span className="text-[13px] font-semibold">CareerPilot</span>
        </div>
        <div className="mt-2 mb-1 px-2 font-mono text-[10px] uppercase tracking-wider text-slate-500">
          Workspace
        </div>
        <div className="flex h-8 items-center gap-2 rounded-md bg-slate-100 px-2 text-[13px] font-medium">
          <LayoutDashboard size={14} /> Dashboard
        </div>
        <div className="flex h-8 items-center justify-between rounded-md px-2 text-[13px] text-slate-500 hover:bg-slate-50">
          <span className="inline-flex items-center gap-2">
            <Star size={14} /> Matches
          </span>
          <span className="font-mono text-[10px] text-slate-500">17</span>
        </div>
        <div className="flex h-8 items-center gap-2 rounded-md px-2 text-[13px] text-slate-500 hover:bg-slate-50">
          <FileText size={14} /> Applications
        </div>
        <div className="flex h-8 items-center gap-2 rounded-md px-2 text-[13px] text-slate-500 hover:bg-slate-50">
          <MessageSquare size={14} /> Chat
        </div>
        <div className="mt-auto border-t border-slate-200 pt-4">
          <div className="flex items-center gap-2 px-2 py-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 font-mono text-[10px] font-medium">
              AK
            </div>
            <div className="min-w-0">
              <div className="truncate text-[12px] font-medium">А. Коровин</div>
              <div className="truncate text-[10px] text-slate-500">
                VP · Engineering
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 overflow-hidden p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <div className="font-mono text-[11px] uppercase text-slate-500">
              Обзор
            </div>
            <div className="text-[20px] font-semibold tracking-tight">
              Сегодня, 20 апреля
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="pill">
              <span className="pulse-dot" /> Автопилот включён
            </div>
            <button className="btn-secondary h-8 px-3 text-[12px]">
              Настройки
            </button>
          </div>
        </div>
        <div className="mb-5 grid grid-cols-4 gap-3">
          {[
            ["Найдено", "109"],
            ["Оценено", "31"],
            ["Рекомендовано", "17"],
            ["Отклики", "12"],
          ].map(([l, v], i) => (
            <div key={l} className="rounded-lg border border-slate-200 p-3">
              <div className="font-mono text-[10px] uppercase text-slate-500">
                {l}
              </div>
              <div
                className="mt-1 text-[22px] font-semibold tracking-tight"
                style={{ color: i === 2 ? "#2563eb" : "#0f172a" }}
              >
                {v}
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-slate-200">
          <div className="flex h-10 items-center justify-between border-b border-slate-200 px-4">
            <div className="text-[12px] font-medium">Pipeline</div>
            <div className="font-mono text-[11px] text-slate-500">7 дней</div>
          </div>
          <div className="flex h-[140px] items-end gap-2 p-4">
            {[
              [30, "14", "slate"],
              [48, "15", "slate"],
              [55, "16", "slate2"],
              [38, "17", "slate2"],
              [70, "18", "blue"],
              [85, "19", "blue"],
              [100, "20", "blue-bold"],
            ].map(([h, d, c], i) => (
              <div
                key={i}
                className="flex flex-1 flex-col items-center gap-1"
              >
                <div
                  className="w-full rounded-sm"
                  style={{
                    height: `${h}%`,
                    background:
                      c === "blue" || c === "blue-bold"
                        ? "#2563eb"
                        : c === "slate2"
                        ? "#cbd5e1"
                        : "#e2e8f0",
                  }}
                />
                <div
                  className="font-mono text-[10px]"
                  style={{
                    color: c === "blue-bold" ? "#0f172a" : "#64748b",
                    fontWeight: c === "blue-bold" ? 500 : 400,
                  }}
                >
                  {d}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MatchesScreen() {
  const rows = [
    {
      role: "VP of Engineering",
      company: "Т-Банк · Москва · hybrid",
      comp: "₽ 1.2–1.6M",
      score: 4.6,
      status: ["Рекомендовано", "#047857", "#a7f3d0", "#ecfdf5", "#10b981"],
    },
    {
      role: "Director, ML Platform",
      company: "Яндекс · Москва · remote OK",
      comp: "₽ 1.0–1.4M",
      score: 4.3,
      status: ["CV готово", "#1e3a8a", "#bfdbfe", "#eff6ff", "#2563eb"],
    },
    {
      role: "Head of AI, FinTech",
      company: "Сбер · Москва · onsite",
      comp: "₽ 900k–1.3M",
      score: 3.8,
      status: ["В очереди", "#64748b", "#e2e8f0", "#fff", "#94a3b8"],
    },
    {
      role: "VP Product, AI Tooling",
      company: "Ozon Tech · Москва · hybrid",
      comp: "₽ 1.1–1.5M",
      score: 4.1,
      status: ["На проверке", "#92400e", "#fde68a", "#fffbeb", "#f59e0b"],
    },
    {
      role: "Director, Data Platform",
      company: "Альфа-Банк · Москва · hybrid",
      comp: "₽ 950k–1.2M",
      score: 3.6,
      status: ["Новое", "#64748b", "#e2e8f0", "#fff", "#94a3b8"],
    },
  ];

  return (
    <div className="h-full overflow-hidden p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <div className="font-mono text-[11px] uppercase text-slate-500">
            Топ-совпадения
          </div>
          <div className="text-[20px] font-semibold tracking-tight">
            17 вакансий ≥ 3.5 / 5
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              className="h-8 w-56 rounded-md border border-slate-200 px-3 pr-8 text-[12px]"
              placeholder="Поиск по роли, компании…"
            />
            <Search
              className="absolute right-2 top-1/2 -translate-y-1/2"
              size={14}
              color="#64748b"
            />
          </div>
          <button className="btn-secondary h-8 px-3 text-[12px]">
            Фильтры · 3
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <div className="grid h-9 grid-cols-12 items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 font-mono text-[10px] uppercase tracking-wider text-slate-500">
          <div className="col-span-5">Роль · Компания</div>
          <div className="col-span-2">Компенсация</div>
          <div className="col-span-3">10-dim match</div>
          <div className="col-span-2 text-right">Статус</div>
        </div>
        <div className="divide-y divide-slate-200">
          {rows.map((r, i) => (
            <div
              key={i}
              className="grid h-[62px] grid-cols-12 items-center gap-3 px-4 hover:bg-slate-50/70"
            >
              <div className="col-span-5">
                <div className="text-[13.5px] font-medium tracking-tight">
                  {r.role}
                </div>
                <div className="text-[11.5px] text-slate-500">{r.company}</div>
              </div>
              <div className="col-span-2 font-mono text-[12.5px]">{r.comp}</div>
              <div className="col-span-3 flex items-center gap-2">
                <div className="flex gap-[2px]">
                  {Array.from({ length: 10 }).map((_, k) => {
                    const active = k / 10 < r.score / 5;
                    return (
                      <span
                        key={k}
                        className="w-1 rounded-sm"
                        style={{
                          height: 10 + ((k * 7) % 8),
                          background: active ? "#2563eb" : "#cbd5e1",
                        }}
                      />
                    );
                  })}
                </div>
                <span className="font-mono text-[12px] font-medium">
                  {r.score.toFixed(1)}
                </span>
              </div>
              <div className="col-span-2 text-right">
                <span
                  className="pill"
                  style={{
                    color: r.status[1] as string,
                    borderColor: r.status[2] as string,
                    background: r.status[3] as string,
                  }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: r.status[4] as string }}
                  />
                  {r.status[0]}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChatScreen() {
  return (
    <div className="flex h-full">
      <aside className="flex w-[260px] flex-col border-r border-slate-200 bg-white">
        <div className="flex h-10 items-center border-b border-slate-200 px-4 text-[12px] font-medium">
          Разговоры
        </div>
        <div className="flex flex-1 flex-col gap-1 p-2">
          <div className="rounded-md bg-slate-100 p-2.5">
            <div className="truncate text-[12.5px] font-medium">
              VP of Engineering · Т-Банк
            </div>
            <div className="mt-0.5 truncate text-[11px] text-slate-500">
              Подбери упор на Platform и FinTech…
            </div>
          </div>
          <div className="rounded-md p-2.5 hover:bg-slate-50">
            <div className="truncate text-[12.5px] font-medium">
              Director, ML Platform
            </div>
            <div className="mt-0.5 truncate text-[11px] text-slate-500">
              Какие риски в оффере Яндекса?
            </div>
          </div>
          <div className="rounded-md p-2.5 hover:bg-slate-50">
            <div className="truncate text-[12.5px] font-medium">
              Head of AI · Сбер
            </div>
            <div className="mt-0.5 truncate text-[11px] text-slate-500">
              STAR-кейс про миграцию стека
            </div>
          </div>
        </div>
      </aside>
      <div className="flex flex-1 flex-col">
        <div className="flex h-10 items-center justify-between border-b border-slate-200 px-4">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-900 font-mono text-[10px] text-white">
              AI
            </span>
            <div className="text-[12.5px] font-medium">
              VP of Engineering · Т-Банк
            </div>
          </div>
          <div className="pill text-[11px]">match 4.6 / 5</div>
        </div>
        <div className="flex-1 space-y-4 overflow-hidden p-6">
          <div className="flex justify-end">
            <div className="max-w-[72%] rounded-2xl rounded-br-md bg-slate-100 px-4 py-2.5 text-[13px]">
              Подбери акцент на Platform-экспертизе и опыт с FinTech
              регуляторикой.
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex h-7 w-7 flex-none items-center justify-center rounded-md bg-slate-900 font-mono text-[10px] text-white">
              AI
            </div>
            <div className="max-w-[78%]">
              <div className="rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3 text-[13px] leading-[1.55]">
                Готово. Переписал bullet-points в резюме под приоритеты команды
                Т-Банка:
                <div className="mt-2 space-y-1.5">
                  {[
                    "Platform-экспертиза · масштаб 200+ инженеров",
                    "SOX / 152-ФЗ compliance опыт",
                    "Миграция core-banking на микросервисы",
                  ].map((s) => (
                    <div key={s} className="flex items-start gap-2">
                      <span className="check">
                        <Check size={10} strokeWidth={3} />
                      </span>
                      <span>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-2 flex gap-2">
                <button className="btn-secondary h-7 px-2.5 text-[11.5px]">
                  Скачать CV.pdf
                </button>
                <button className="btn-secondary h-7 px-2.5 text-[11.5px]">
                  Cover letter
                </button>
                <button className="btn-secondary h-7 px-2.5 text-[11.5px]">
                  Отправить отклик
                </button>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex h-7 w-7 flex-none items-center justify-center rounded-md bg-slate-900 font-mono text-[10px] text-white">
              AI
            </div>
            <div className="max-w-[78%] rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-2.5 text-[13px]">
              <span className="inline-flex items-center gap-2 text-slate-500">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#2563eb]" />
                Анализирую культуру и пакет…
              </span>
            </div>
          </div>
        </div>
        <div className="border-t border-slate-200 p-3">
          <div className="flex h-10 items-center gap-2 rounded-md border border-slate-200 px-3">
            <input
              className="flex-1 bg-transparent text-[13px] outline-none"
              placeholder="Спросите о вакансии…"
            />
            <kbd className="kbd">⌘</kbd>
            <kbd className="kbd">↵</kbd>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- feature grid ---------------- */

function FeatureGrid() {
  return (
    <section id="features" className="mx-auto max-w-[1200px] px-6 py-28">
      <div className="mb-12 grid grid-cols-12 gap-10">
        <div className="col-span-12 lg:col-span-5">
          <div className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
            Полный автопилот
          </div>
          <h2 className="mt-2 text-[40px] font-semibold leading-[1.1] tracking-[-0.02em]">
            Нажали кнопку —
            <br />
            ходите на собеседования.
          </h2>
        </div>
        <div className="col-span-12 text-[16px] leading-[1.65] text-slate-500 lg:col-span-6 lg:col-start-7">
          Executive-поиск — это поиск сигнала в шуме. CareerPilot снимает с вас
          80% операционной работы: сканирование, оценку, подготовку материалов,
          отклики. Остаётся только встречаться с людьми.
        </div>
      </div>

      <div className="grid grid-cols-12 gap-3">
        <FeatureScan />
        <FeatureScore />
        <FeatureTailor />
        <FeatureApply />
      </div>
    </section>
  );
}

function FeatureScan() {
  return (
    <div
      className="tile card col-span-12 relative overflow-hidden p-7 lg:col-span-7"
      style={{ minHeight: 340 }}
    >
      <div className="inline-flex items-center gap-2 font-mono text-[11px] text-[#2563eb]">
        <Search size={12} /> 01 · SCAN
      </div>
      <h3 className="mt-2 text-[22px] font-semibold tracking-tight">
        AI сканирует за вас
      </h3>
      <p className="mt-2 max-w-[400px] text-[14px] leading-[1.6] text-slate-500">
        24/7 мониторинг hh.ru, LinkedIn, Telegram-каналов и 50+ карьерных
        страниц компаний. Новое — на ваш экран через 90 секунд.
      </p>
      <div className="pointer-events-none absolute right-[-40px] bottom-[-40px] h-[280px] w-[360px]">
        <svg viewBox="0 0 360 280" className="h-full w-full">
          <defs>
            <radialGradient id="radarg" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#2563eb" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
            </radialGradient>
          </defs>
          <g transform="translate(180,140)">
            <circle r="120" fill="url(#radarg)" />
            <circle r="120" fill="none" stroke="#e2e8f0" />
            <circle r="80" fill="none" stroke="#e2e8f0" />
            <circle r="40" fill="none" stroke="#e2e8f0" />
            <line x1="-120" y1="0" x2="120" y2="0" stroke="#e2e8f0" />
            <line x1="0" y1="-120" x2="0" y2="120" stroke="#e2e8f0" />
            <g>
              <path
                d="M 0 0 L 120 0 A 120 120 0 0 1 85 85 Z"
                fill="#2563eb"
                fillOpacity="0.08"
              >
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="0"
                  to="360"
                  dur="6s"
                  repeatCount="indefinite"
                />
              </path>
            </g>
            <circle cx="-60" cy="-30" r="3" fill="#2563eb" />
            <circle cx="55" cy="-70" r="3" fill="#2563eb" />
            <circle cx="90" cy="40" r="3" fill="#2563eb" />
            <circle cx="-30" cy="85" r="3" fill="#2563eb" />
            <circle cx="-95" cy="20" r="3" fill="#2563eb" />
            <circle cx="25" cy="-20" r="3" fill="#0f172a" />
          </g>
        </svg>
      </div>
      <div className="absolute right-6 top-6 font-mono text-[11px] text-slate-500">
        <div>
          hh.ru ········· <span className="text-slate-900">42</span>
        </div>
        <div>
          linkedin ····· <span className="text-slate-900">31</span>
        </div>
        <div>
          tg·channels ·· <span className="text-slate-900">28</span>
        </div>
        <div>
          corporate ···· <span className="text-slate-900">8</span>
        </div>
      </div>
    </div>
  );
}

function FeatureScore() {
  return (
    <div
      className="tile card col-span-12 relative overflow-hidden p-7 lg:col-span-5"
      style={{ minHeight: 340 }}
    >
      <div className="inline-flex items-center gap-2 font-mono text-[11px] text-[#2563eb]">
        <Brain size={12} /> 02 · SCORE
      </div>
      <h3 className="mt-2 text-[22px] font-semibold tracking-tight">
        10-мерная оценка
      </h3>
      <p className="mt-2 max-w-[340px] text-[14px] leading-[1.6] text-slate-500">
        Каждая вакансия проходит через 10 критериев: fit, рост, компенсация,
        культура, stack и ещё 5.
      </p>
      <div className="mt-6 flex items-center justify-center">
        <svg viewBox="0 0 220 220" className="h-[220px] w-[220px]">
          <g transform="translate(110,110)">
            <polygon
              points="0,-90 85,-28 53,73 -53,73 -85,-28"
              fill="none"
              stroke="#e2e8f0"
            />
            <polygon
              points="0,-60 57,-18 35,48 -35,48 -57,-18"
              fill="none"
              stroke="#e2e8f0"
            />
            <polygon
              points="0,-30 28,-9 18,24 -18,24 -28,-9"
              fill="none"
              stroke="#e2e8f0"
            />
            <g stroke="#e2e8f0">
              <line x1="0" y1="0" x2="0" y2="-90" />
              <line x1="0" y1="0" x2="52.9" y2="-72.8" />
              <line x1="0" y1="0" x2="85.6" y2="-27.8" />
              <line x1="0" y1="0" x2="85.6" y2="27.8" />
              <line x1="0" y1="0" x2="52.9" y2="72.8" />
              <line x1="0" y1="0" x2="0" y2="90" />
              <line x1="0" y1="0" x2="-52.9" y2="72.8" />
              <line x1="0" y1="0" x2="-85.6" y2="27.8" />
              <line x1="0" y1="0" x2="-85.6" y2="-27.8" />
              <line x1="0" y1="0" x2="-52.9" y2="-72.8" />
            </g>
            <polygon
              points="0,-72 45,-62 75,-24 72,23 42,58 0,66 -38,52 -70,22 -68,-22 -38,-55"
              fill="#2563eb"
              fillOpacity="0.14"
              stroke="#2563eb"
              strokeWidth="1.5"
            />
            <g fontFamily="'JetBrains Mono',monospace" fontSize="9" fill="#64748b">
              <text x="0" y="-98" textAnchor="middle">fit</text>
              <text x="60" y="-78" textAnchor="middle">рост</text>
              <text x="95" y="-28" textAnchor="start">$$$</text>
              <text x="95" y="34" textAnchor="start">культ.</text>
              <text x="58" y="88" textAnchor="middle">stack</text>
              <text x="0" y="104" textAnchor="middle">team</text>
              <text x="-58" y="88" textAnchor="middle">бренд</text>
              <text x="-95" y="34" textAnchor="end">remote</text>
              <text x="-95" y="-28" textAnchor="end">регион</text>
              <text x="-60" y="-78" textAnchor="middle">риск</text>
            </g>
          </g>
        </svg>
      </div>
      <div className="absolute bottom-5 right-6 font-mono text-[11px] text-slate-500">
        score <span className="text-slate-900">4.6 / 5.0</span>
      </div>
    </div>
  );
}

function FeatureTailor() {
  return (
    <div
      className="tile card col-span-12 relative overflow-hidden p-7 lg:col-span-5"
      style={{ minHeight: 320 }}
    >
      <div className="inline-flex items-center gap-2 font-mono text-[11px] text-[#2563eb]">
        <FileText size={12} /> 03 · TAILOR
      </div>
      <h3 className="mt-2 text-[22px] font-semibold tracking-tight">
        Tailored CV + Cover Letter
      </h3>
      <p className="mt-2 max-w-[360px] text-[14px] leading-[1.6] text-slate-500">
        Для каждого отклика — уникальное резюме и сопроводительное письмо,
        адаптированные под вакансию.
      </p>

      <div className="relative mt-6 h-[160px]">
        <div className="absolute left-2 top-2 h-[150px] w-[180px] rotate-[-4deg] rounded-md border border-slate-200 bg-white p-3 shadow-sm">
          <div className="h-2 w-16 rounded bg-slate-200" />
          <div className="mt-1.5 h-2 w-24 rounded bg-slate-100" />
          <div className="mt-3 space-y-1">
            <div className="h-1.5 w-full rounded bg-slate-100" />
            <div className="h-1.5 w-[85%] rounded bg-slate-100" />
            <div className="h-1.5 w-[70%] rounded bg-[#2563eb]/30" />
            <div className="h-1.5 w-[60%] rounded bg-slate-100" />
            <div className="h-1.5 w-[80%] rounded bg-slate-100" />
          </div>
          <div className="mt-3 font-mono text-[8px] text-slate-500">
            CV_tbank_vp_eng.pdf
          </div>
        </div>
        <div className="absolute left-[150px] top-4 h-[150px] w-[180px] rotate-[3deg] rounded-md border border-slate-200 bg-white p-3 shadow-sm">
          <div className="h-2 w-20 rounded bg-slate-200" />
          <div className="mt-1.5 h-2 w-28 rounded bg-slate-100" />
          <div className="mt-3 space-y-1">
            <div className="h-1.5 w-full rounded bg-slate-100" />
            <div className="h-1.5 w-[92%] rounded bg-[#2563eb]/30" />
            <div className="h-1.5 w-[75%] rounded bg-slate-100" />
            <div className="h-1.5 w-[65%] rounded bg-slate-100" />
            <div className="h-1.5 w-[85%] rounded bg-slate-100" />
          </div>
          <div className="mt-3 font-mono text-[8px] text-slate-500">
            cover_yandex_ml.pdf
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureApply() {
  return (
    <div
      className="tile card col-span-12 relative overflow-hidden p-7 lg:col-span-7"
      style={{ minHeight: 320 }}
    >
      <div className="inline-flex items-center gap-2 font-mono text-[11px] text-[#2563eb]">
        <Rocket size={12} /> 04 · AUTO-APPLY
      </div>
      <h3 className="mt-2 text-[22px] font-semibold tracking-tight">
        Авто-отклик
      </h3>
      <p className="mt-2 max-w-[480px] text-[14px] leading-[1.6] text-slate-500">
        Включите автопилот — система откликается, отправляет follow-up, трекает
        статусы и сообщает, когда ждёт ваш ответ.
      </p>

      <div className="mt-7 grid grid-cols-5 items-center gap-2">
        <div className="rounded-md border border-slate-200 bg-white p-3 text-center">
          <div className="font-mono text-[10px] text-slate-500">1 · scan</div>
          <div className="mt-0.5 text-[18px] font-semibold">109</div>
        </div>
        <div className="flex justify-center text-slate-300">
          <ArrowRight size={24} />
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-3 text-center">
          <div className="font-mono text-[10px] text-slate-500">2 · score</div>
          <div className="mt-0.5 text-[18px] font-semibold">31</div>
        </div>
        <div className="flex justify-center text-slate-300">
          <ArrowRight size={24} />
        </div>
        <div className="rounded-md border-2 border-[#2563eb] bg-[#eff6ff] p-3 text-center">
          <div className="font-mono text-[10px] text-[#2563eb]">3 · apply</div>
          <div className="mt-0.5 text-[18px] font-semibold text-[#2563eb]">
            17
          </div>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-md border border-slate-200">
        <div className="flex h-9 items-center justify-between border-b border-slate-200 px-3 font-mono text-[11px] text-slate-500">
          <span>autopilot.log</span>
          <span className="inline-flex items-center gap-1">
            <span className="pulse-dot" /> live
          </span>
        </div>
        <div className="space-y-0.5 p-3 font-mono text-[11px] leading-[1.7] text-slate-500">
          <div>
            <span className="text-slate-400">14:02:18</span> ·{" "}
            <span className="text-slate-900">match=4.6</span> → opened Т-Банк ·
            VP Engineering
          </div>
          <div>
            <span className="text-slate-400">14:02:21</span> · generating CV ·{" "}
            <span className="text-[#2563eb]">cv_tbank_vp_eng.pdf</span>
          </div>
          <div>
            <span className="text-slate-400">14:02:34</span> ·{" "}
            <span className="text-emerald-600">sent</span> → follow-up scheduled
            +3d
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- pricing ---------------- */

function Pricing() {
  return (
    <section id="pricing" className="border-t border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-[1200px] px-6 py-28">
        <div className="mb-14 text-center">
          <div className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
            Тарифы
          </div>
          <h2 className="mt-2 text-[40px] font-semibold tracking-[-0.02em]">
            Executive-grade. Доступно.
          </h2>
          <p className="mx-auto mt-3 max-w-[520px] text-[15px] text-slate-500">
            Начните бесплатно. Обновитесь, когда увидите первый match ≥ 4.0.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <PriceCard
            tier="Free"
            price="$0"
            cadence="/ навсегда"
            blurb="Попробовать платформу без рисков."
            cta={{ label: "Начать бесплатно", href: "/signup", variant: "secondary" }}
            features={[
              "3 AI-оценки / месяц",
              "Просмотр всех вакансий",
              "Базовый трекер откликов",
            ]}
          />
          <PriceCard
            tier="Pro"
            tierColor="#2563eb"
            price="$19"
            cadence="/ мес"
            blurb="Для активного поиска с автоматизацией."
            highlight
            cta={{ label: "Попробовать Pro", href: "/signup", variant: "primary" }}
            features={[
              "30 AI-оценок / месяц",
              "Tailored CV в PDF",
              "Авто-отклик",
              "Cover letter генерация",
              "Email-уведомления",
            ]}
          />
          <PriceCard
            tier="Premium"
            price="$39"
            cadence="/ мес"
            blurb="Максимум — для executive-поиска."
            cta={{ label: "Получить Premium", href: "/signup", variant: "secondary" }}
            features={[
              "Безлимит AI-оценок",
              "Interview prep + STAR-кейсы",
              "Company research-досье",
              "Telegram-бот",
              "Приоритетное сканирование",
            ]}
          />
        </div>

        <div className="mt-10 text-center text-[12.5px] text-slate-500">
          Оплата в рублях по курсу ЦБ · НДС включён · Отмена в один клик
        </div>
      </div>
    </section>
  );
}

function PriceCard({
  tier,
  tierColor = "#64748b",
  price,
  cadence,
  blurb,
  features,
  cta,
  highlight,
}: {
  tier: string;
  tierColor?: string;
  price: string;
  cadence: string;
  blurb: string;
  features: string[];
  cta: { label: string; href: string; variant: "primary" | "secondary" };
  highlight?: boolean;
}) {
  return (
    <div
      className={`card relative p-7 ${highlight ? "lift" : ""}`}
      style={highlight ? { borderColor: "#0f172a" } : {}}
    >
      {highlight && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-slate-900 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-white">
          Популярный
        </div>
      )}
      <div className="font-mono text-[12px] uppercase tracking-wider" style={{ color: tierColor }}>
        {tier}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-[36px] font-semibold tracking-[-0.02em]">
          {price}
        </span>
        <span className="text-[13px] text-slate-500">{cadence}</span>
      </div>
      <p className="mt-3 text-[13px] text-slate-500">{blurb}</p>
      <Link
        href={cta.href}
        className={`mt-6 h-10 w-full justify-center ${cta.variant === "primary" ? "btn-primary" : "btn-secondary"}`}
      >
        {cta.label}
      </Link>
      <div className="mt-6 space-y-2.5 border-t border-slate-200 pt-6 text-[13.5px]">
        {features.map((f) => (
          <div key={f} className="flex items-start gap-2">
            <span className="check">
              <Check size={10} strokeWidth={3} />
            </span>
            {f}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- final CTA + footer ---------------- */

function FinalCTA() {
  return (
    <section className="mx-auto max-w-[1200px] px-6 py-24">
      <div className="card lift relative overflow-hidden p-12 text-center md:p-16">
        <div className="dot-grid pointer-events-none absolute inset-0 opacity-60" />
        <div className="relative">
          <h2 className="mx-auto max-w-[720px] text-[44px] font-semibold leading-[1.05] tracking-[-0.02em]">
            Загрузите резюме.
            <br />
            Остальное — наше.
          </h2>
          <p className="mx-auto mt-5 max-w-[520px] text-[15.5px] text-slate-500">
            Без регистрации — откройте демо-кабинет и посмотрите на вакансии,
            которые AI нашёл сегодня.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/signup" className="btn-primary h-11 px-5 text-[14px]">
              Начать бесплатно <ArrowRight size={14} />
            </Link>
            <Link
              href="/dashboard"
              className="btn-secondary h-11 px-5 text-[14px]"
            >
              Открыть демо-кабинет
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-slate-200">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-6 px-6 py-10">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-900 text-white">
            <Sparkles size={12} />
          </span>
          <span className="text-[13.5px] font-semibold">CareerPilot</span>
          <span className="ml-2 text-[12.5px] text-slate-500">
            — AI-платформа поиска работы
          </span>
        </div>
        <div className="flex items-center gap-6 text-[12.5px] text-slate-500">
          <a href="#features" className="hover:text-slate-900">Возможности</a>
          <a href="#pricing" className="hover:text-slate-900">Тарифы</a>
          <a href="#" className="hover:text-slate-900">Безопасность</a>
          <a href="#" className="hover:text-slate-900">Контакты</a>
        </div>
        <div className="font-mono text-[12px] text-slate-500">
          © 2026 · v4.2.0 · Made in Moscow
        </div>
      </div>
    </footer>
  );
}
