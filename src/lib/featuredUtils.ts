export interface FeaturedScheduleEntry {
  day: number; // 0=Sunday, 6=Saturday
  start: string; // "HH:mm"
  end: string; // "HH:mm"
}

/**
 * Checks if a featured product should be visible right now based on:
 * 1. is_featured === true
 * 2. featured_active !== false (null treated as true for backwards compat)
 * 3. If featured_schedule exists, current day/time must match at least one entry
 */
export function isFeaturedVisible(product: {
  is_featured?: boolean;
  featured_active?: boolean | null;
  featured_schedule?: FeaturedScheduleEntry[] | null;
  promotional_price?: number | null;
}): boolean {
  // Must be marked as featured (or have promotional price for kiosk)
  if (!product.is_featured && product.promotional_price == null) return false;

  // If it's a featured product, check active toggle
  if (product.is_featured) {
    if (product.featured_active === false) return false;

    // Check schedule if present
    if (product.featured_schedule && Array.isArray(product.featured_schedule) && product.featured_schedule.length > 0) {
      const now = new Date();
      const currentDay = now.getDay(); // 0=Sunday
      const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      const matchesSchedule = product.featured_schedule.some(
        (entry) => entry.day === currentDay && currentTime >= entry.start && currentTime <= entry.end
      );

      if (!matchesSchedule) return false;
    }
  }

  return true;
}
