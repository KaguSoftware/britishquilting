import SiteLayout from "./(site)/layout";
import SiteNotFound from "./(site)/not-found";

/** Unmatched URLs fall through to the root; give them the full site chrome. */
export default function NotFound() {
  return (
    <SiteLayout>
      <SiteNotFound />
    </SiteLayout>
  );
}
