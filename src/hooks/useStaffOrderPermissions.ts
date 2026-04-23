/**
 * Reads order-related permissions for the currently logged-in staff member from
 * localStorage. The owner / "admin" role always returns full permissions.
 *
 * Notes:
 * - When there is no staff session (e.g. restaurant owner accessing the panel
 *   without logging in as a staff member yet), we default to TRUE so the panel
 *   keeps working as before.
 * - Values are stored at login time (StaffLogin.tsx).
 */
export function useStaffOrderPermissions() {
  const role = (typeof window !== "undefined" && localStorage.getItem("staff_role")) || "";
  const isAdmin = role === "admin";

  const readBool = (key: string): boolean => {
    if (typeof window === "undefined") return true;
    const raw = localStorage.getItem(key);
    if (raw === null) return true; // default permissive (owner / pre-existing sessions)
    return raw === "true";
  };

  return {
    role,
    isAdmin,
    canManageOrders: isAdmin || readBool("staff_can_manage_orders"),
    receivesOrderNotifications: isAdmin || readBool("staff_receives_order_notifications"),
  };
}
