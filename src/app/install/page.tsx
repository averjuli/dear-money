import { Card } from "@/components/ui-kit";
import { Screen, ScreenHeader } from "@/components/screen";

const steps = [
  {
    title: "Откройте сайт в Safari",
    text: "Именно в Safari: другие браузеры на iPhone не умеют ставить приложения на экран «Домой».",
    icon: (
      <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm3.5 5.5-2 5-5 2 2-5z" />
    ),
  },
  {
    title: "Нажмите «Поделиться»",
    text: "Кнопка внизу экрана: квадрат со стрелкой вверх.",
    icon: <path d="M12 3v12M8 7l4-4 4 4M5 11v9h14v-9" />,
  },
  {
    title: "Выберите «На экран „Домой“»",
    text: "Пролистайте список вниз, нажмите «Добавить». Иконка Dear Money появится рядом с другими приложениями.",
    icon: <path d="M4 4h16v16H4zM12 8v8M8 12h8" />,
  },
];

export default function InstallPage() {
  return (
    <Screen>
      <ScreenHeader
        backHref="/"
        backLabel="Назад"
        title="Установить на iPhone"
      />
      <ol className="m-0 flex list-none flex-col gap-3.5 p-0">
        {steps.map((step, i) => (
          <li key={step.title}>
            <Card className="flex items-start gap-3.5 p-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-[12px] bg-accent-soft text-accent">
                <svg
                  aria-hidden="true"
                  width="26"
                  height="26"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {step.icon}
                </svg>
              </div>
              <div className="flex flex-col gap-1">
                <div className="text-base font-semibold">
                  {i + 1}. {step.title}
                </div>
                <div className="text-sm leading-snug text-ink-muted">
                  {step.text}
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ol>
    </Screen>
  );
}
