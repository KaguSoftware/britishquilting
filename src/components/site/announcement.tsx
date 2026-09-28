import { AnnouncementBar } from "./announcement-bar";

const KEY = "bq-announcement-dismissed";

/**
 * Slim store-wide message from store_settings.announcement, above the fixed header.
 * The bar sits in normal flow; the header is pushed down by --announce-offset, which
 * the client part keeps equal to the visible height of the bar as the page scrolls.
 * A tiny inline script hides it before paint for visitors who already dismissed this
 * exact message (the key is the message text), so there is no flash or layout jump.
 */
export function Announcement({ message }: { message: string | null | undefined }) {
  const text = message?.trim();
  if (!text) return null;
  const js = `try{if(localStorage.getItem(${JSON.stringify(KEY)})===${JSON.stringify(text)}){document.currentScript.previousElementSibling.hidden=true;document.getElementById("bq-announce-offset").textContent=":root{--announce-offset:0px}"}}catch(e){}`;
  return (
    <>
      <style id="bq-announce-offset" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: ":root{--announce-offset:2.25rem}" }} />
      <AnnouncementBar message={text} storageKey={KEY} />
      <script dangerouslySetInnerHTML={{ __html: js }} />
    </>
  );
}
