type Photo = { storage_path: string; sort_order: number; variant_id?: string | null };

/**
 * Photos to show for a colour: that colour's own photos first, then the photos shared by
 * every colour. Other colours' photos are left out. Pass null for a product without colours.
 */
export function photosFor<T extends Photo>(images: T[], colourId: string | null): T[] {
  return images
    .filter((i) => !i.variant_id || i.variant_id === colourId)
    .sort((a, b) => Number(!a.variant_id) - Number(!b.variant_id) || a.sort_order - b.sort_order);
}
