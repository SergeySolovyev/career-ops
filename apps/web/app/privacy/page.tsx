import Link from 'next/link'

/**
 * Политика обработки персональных данных по требованиям 152-ФЗ.
 *
 * Обязательно для любого сервиса, собирающего email, имя, CV, и другие PII
 * у граждан РФ. Без этой страницы Tinkoff Касса не одобрит магазин.
 *
 * Шаблон базовый — для production-launch проверить у юриста, особенно
 * раздел про cross-border data transfer (Anthropic API → США).
 */

export const metadata = {
  title: 'Политика конфиденциальности · CareerPilot',
  description:
    'Политика обработки персональных данных пользователей сервиса CareerPilot.',
}

export default function PrivacyPage() {
  const today = new Date().toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  return (
    <main className="mx-auto max-w-[760px] px-6 py-16 text-slate-900">
      <Link
        href="/"
        className="mb-8 inline-block font-mono text-[11px] uppercase tracking-wider text-slate-500 hover:text-slate-900"
      >
        ← CareerPilot
      </Link>

      <header className="mb-10">
        <div className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
          Legal · Privacy
        </div>
        <h1 className="mt-2 text-[32px] font-semibold tracking-[-0.02em]">
          Политика конфиденциальности
        </h1>
        <p className="mt-3 text-[13px] text-slate-500">
          Редакция от {today}. Действует с момента регистрации в Сервисе.
        </p>
      </header>

      <div className="space-y-8 text-[14px] leading-[1.7] text-slate-700">
        <section>
          <h2 className="mb-3 text-[18px] font-semibold text-slate-900">
            1. Кто обрабатывает данные
          </h2>
          <p>
            Оператором персональных данных является{' '}
            <strong>ИП Бирюкова Яна Владимировна</strong> (ИНН 010510099667, ОГРНИП
            326774600321772, далее — «Оператор»). Полные реквизиты — в{' '}
            <Link href="/offer" className="text-emerald-700 underline">
              публичной оферте
            </Link>
            . Связь:{' '}
            <a
              href="mailto:hello@careerpilot.app"
              className="text-emerald-700 underline"
            >
              hello@careerpilot.app
            </a>
            .
          </p>
          <p className="mt-3">
            Политика разработана в соответствии с Федеральным законом от 27.07.2006
            № 152-ФЗ «О персональных данных».
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-[18px] font-semibold text-slate-900">
            2. Какие данные собираем
          </h2>
          <p>
            При регистрации и использовании Сервиса Оператор собирает следующие
            категории данных:
          </p>
          <ul className="ml-5 mt-2 list-disc space-y-1">
            <li>
              <strong>Идентификаторы:</strong> имя, email, IP-адрес, user-agent
              браузера.
            </li>
            <li>
              <strong>Профессиональные данные:</strong> текст CV, целевые роли,
              ожидания по зарплате, география поиска, опыт работы.
            </li>
            <li>
              <strong>Платёжные:</strong> только маскированный номер карты (последние
              4 цифры) и идентификатор транзакции у CloudPayments. Полный номер карты
              и CVV никогда не передаются Оператору — обрабатываются на стороне
              CloudPayments в соответствии со стандартом PCI DSS Level 1.
            </li>
            <li>
              <strong>Учётные записи сторонних сервисов:</strong> при подключении
              hh.ru-аккаунта — cookies HH в зашифрованном виде (AES-256). Пароль HH
              никогда не сохраняется в открытом виде.
            </li>
            <li>
              <strong>Поведенческие:</strong> история сканирований, оценки вакансий,
              взаимодействия с AI-чатом.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-[18px] font-semibold text-slate-900">
            3. Цели обработки
          </h2>
          <ul className="ml-5 list-disc space-y-1">
            <li>Оказание услуг согласно публичной оферте;</li>
            <li>Биллинг и фискализация платежей;</li>
            <li>
              Персонализация рекомендаций (AI-анализ CV против вакансий);
            </li>
            <li>
              Уведомления о новых вакансиях, важных событиях аккаунта (на email);
            </li>
            <li>Безопасность (предотвращение fraud, abuse, rate-limiting);</li>
            <li>Соблюдение требований законодательства РФ.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-[18px] font-semibold text-slate-900">
            4. Передача третьим лицам
          </h2>
          <p>
            Оператор не продаёт и не передаёт персональные данные третьим лицам, за
            исключением следующих случаев:
          </p>
          <ul className="ml-5 mt-2 list-disc space-y-1">
            <li>
              <strong>Anthropic, PBC (США):</strong> для работы AI-функций (анализ
              CV, оценка вакансий, AI-чат). Передаётся текст CV и тексты вакансий
              без идентификаторов пользователя. Anthropic заявляет о невозможности
              использования данных для обучения моделей в режиме API (zero data retention).
            </li>
            <li>
              <strong>ООО «КЛАУДПЭЙМЕНТС» (CloudPayments):</strong> для проведения платежа — email,
              сумма, идентификатор подписки.
            </li>
            <li>
              <strong>Supabase Inc. (США/ЕС):</strong> провайдер базы данных
              (хостинг). Данные хранятся в зашифрованном виде в регионе ЕС.
            </li>
            <li>
              <strong>Vercel Inc. (США):</strong> хостинг приложения.
            </li>
            <li>
              <strong>HH.ru:</strong> только при использовании авто-отклика — отправляется
              сгенерированное CV и сопроводительное письмо.
            </li>
            <li>По требованию органов власти РФ — в рамках, установленных законом.</li>
          </ul>
          <p className="mt-3">
            <strong>Трансграничная передача данных:</strong> в США (Anthropic, Vercel).
            Пользователь даёт согласие на такую передачу при регистрации.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-[18px] font-semibold text-slate-900">
            5. Сроки хранения
          </h2>
          <ul className="ml-5 list-disc space-y-1">
            <li>
              <strong>Активный аккаунт:</strong> данные хранятся до удаления аккаунта
              пользователем.
            </li>
            <li>
              <strong>После удаления аккаунта:</strong> 30 дней soft-delete (на случай
              восстановления), затем полное удаление, за исключением финансовой
              отчётности (хранится 4 года в соответствии с НК РФ).
            </li>
            <li>
              <strong>Логи операций:</strong> 90 дней, затем анонимизируются.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-[18px] font-semibold text-slate-900">
            6. Права пользователя
          </h2>
          <p>В соответствии со ст. 14 152-ФЗ Пользователь вправе:</p>
          <ul className="ml-5 mt-2 list-disc space-y-1">
            <li>Получить копию всех данных о себе;</li>
            <li>Требовать исправления неточных данных;</li>
            <li>
              Требовать удаления своих данных (право быть забытым) — в течение 10
              рабочих дней;
            </li>
            <li>Отозвать согласие на обработку в любой момент;</li>
            <li>Обжаловать действия Оператора в Роскомнадзоре.</li>
          </ul>
          <p className="mt-3">
            Для реализации этих прав — письмо на{' '}
            <a
              href="mailto:hello@careerpilot.app"
              className="text-emerald-700 underline"
            >
              hello@careerpilot.app
            </a>{' '}
            с темой «Запрос по 152-ФЗ».
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-[18px] font-semibold text-slate-900">
            7. Cookies и аналитика
          </h2>
          <p>Сервис использует cookies строго для следующих целей:</p>
          <ul className="ml-5 mt-2 list-disc space-y-1">
            <li>
              <strong>Sessions:</strong> поддержание входа в аккаунт (httpOnly,
              secure, SameSite=Lax).
            </li>
            <li>
              <strong>CSRF-токены:</strong> защита от межсайтовой подделки запросов.
            </li>
          </ul>
          <p className="mt-3">
            Маркетинговые cookies, рекламные пиксели, сторонние трекеры — НЕ
            используются.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-[18px] font-semibold text-slate-900">
            8. Защита данных
          </h2>
          <ul className="ml-5 list-disc space-y-1">
            <li>TLS 1.3 для всех соединений;</li>
            <li>Пароли хешируются bcrypt (стандарт Supabase Auth);</li>
            <li>HH-cookies шифруются AES-256 с уникальным IV на запись;</li>
            <li>
              Row-Level Security в БД — пользователь видит только свои данные;
            </li>
            <li>Rate-limiting на чувствительные эндпоинты.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-[18px] font-semibold text-slate-900">
            9. Изменения политики
          </h2>
          <p>
            Оператор уведомляет об изменениях политики на этой странице минимум за 7
            календарных дней до вступления в силу. Дата последнего обновления указана
            в шапке.
          </p>
        </section>
      </div>

      <footer className="mt-16 border-t border-slate-200 pt-6 text-[12px] text-slate-500">
        <Link href="/" className="hover:text-slate-900">
          ← На главную
        </Link>
        <span className="mx-2">·</span>
        <Link href="/offer" className="hover:text-slate-900">
          Публичная оферта
        </Link>
      </footer>
    </main>
  )
}
