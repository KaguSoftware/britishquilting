import { AnnouncementBar } from "./announcement-bar";

/**
 * Slim store-wide bar from store_settings.announcement_messages, above the fixed header.
 * With "together" on, every message is shown at once, still, in one band; with it off, the
 * same band scrolls as a marquee. Visitors can't close it: only the owner can hide it,
 * by removing every message in admin settings. The bar sits in normal flow; the header is
 * pushed down by --announce-offset, which the client part keeps equal to the visible
 * height of the bar as the page scrolls.
 */
export function Announcement({ messages, together }: { messages: string[] | null | undefined; together: boolean }) {
  const list = (messages ?? []).map((m) => m.trim()).filter(Boolean);
  if (list.length === 0) return null;
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: ":root{--announce-offset:2.25rem}" }} />
      <AnnouncementBar messages={list} together={together} />
    </>
  );
}
