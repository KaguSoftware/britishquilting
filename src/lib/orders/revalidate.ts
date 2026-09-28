import "server-only";
import { revalidatePath } from "next/cache";

/**
 * Refreshes storefront pages that show stock after it changes (payment, reservation,
 * restock). revalidatePath throws when called during a page render (the checkout
 * success page finalises orders while rendering), so failures are swallowed: the
 * pages then catch up on their normal revalidation.
 */
export function revalidateStorefront() {
  try {
    revalidatePath("/shop", "layout");
    revalidatePath("/product/[slug]", "page");
    revalidatePath("/samples");
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
