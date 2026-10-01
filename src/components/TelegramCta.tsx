import { TelegramIcon } from "./icons";

export function TelegramCta({ url }: { url: string }) {
  return (
    <section className="rounded-2xl bg-gradient-to-r from-sky-600 to-blue-700 p-6 text-white sm:p-8">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <TelegramIcon className="h-10 w-10 shrink-0" />
          <div>
            <h2 className="font-serif text-2xl font-bold">Get the latest news directly on Telegram</h2>
            <p className="text-sm text-white/85">Every new story, summarized and linked to the original source.</p>
          </div>
        </div>
        {url ? (
          <a href={url} target="_blank" rel="noopener noreferrer" className="btn bg-white text-blue-700 hover:bg-white/90">Join Telegram</a>
        ) : (
          <span className="text-sm text-white/70">Telegram link not configured</span>
        )}
      </div>
    </section>
  );
}
