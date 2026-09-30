import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";

/**
 * Refreshes storefront pages that show stock after it changes (payment, reservation,
 * restock). revalidatePath throws when called during a page render (the checkout
 * success page finalises orders while rendering), so failures are swallowed: the
 * pages then catch up on their normal revalidation. Also expires the cached product
 * reads behind those pages (src/lib/data/shop.ts) for the same reason.
 */
export function revalidateStorefront() {
  try {
    revalidatePath("/");
    revalidatePath("/shop", "layout");
    revalidatePath("/product/[slug]", "page");
    revalidatePath("/samples");
    revalidateTag("products", { expire: 0 });
  } catch {
    /* called during render: nothing to do */
  }
}

/** Customer-facing order pages after a status change. */
export function revalidateCustomerOrders() {
  try {
    revalidatePath("/account/orders", "layout");
  } catch {
    /* called during render */
  }
}
