export default function MatchesPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Новые матчи</h1>
      <p className="mt-1 text-muted-foreground">
        Вакансии, подобранные AI специально для вас
      </p>

      <div className="mt-8 space-y-4">
        {/* Placeholder vacancy card */}
        <div className="rounded-xl border border-border p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-green-100 px-2 py-0.5 text-sm font-semibold text-green-700">
                  4.7/5
                </span>
                <h3 className="text-lg font-semibold">Лидер направления по AI</h3>
              </div>
              <p className="mt-1 text-muted-foreground">Сбер</p>
              <div className="mt-2 flex gap-4 text-sm text-muted-foreground">
                <span>400-600K руб</span>
                <span>Москва</span>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <h4 className="text-sm font-medium">Почему подходит:</h4>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li>• AI + банкинг = ваш профиль</li>
              <li>• 20 лет финрынков — seniority match</li>
              <li>• Research papers — доказательство экспертизы</li>
            </ul>
          </div>

          <div className="mt-6 flex gap-3">
            <button className="rounded-md bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
              Откликнуться
            </button>
            <button className="rounded-md border border-border px-6 py-2 text-sm font-semibold hover:bg-secondary">
              Пропустить
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
