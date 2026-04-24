import { addMinutes, format, isAfter, isBefore, parseISO } from "date-fns";

export const ACTIVE_RESERVATION_STATUSES = new Set(["confirmed", "pending"]);
export const INACTIVE_RESERVATION_STATUSES = new Set([
  "cancelled",
  "no_show",
  "arrived",
  "completed",
  "expired",
]);

export interface ReservationLike {
  id?: string;
  table_id: string | null;
  reservation_date: string;
  reservation_time: string | null;
  status: string | null;
}

const WINDOW_BEFORE_MINUTES = 30;
const WINDOW_AFTER_MINUTES = 120;

export const isReservationStatusActive = (status: string | null | undefined) =>
  !!status && ACTIVE_RESERVATION_STATUSES.has(status);

export const parseReservationDateTime = (reservation: ReservationLike) => {
  if (!reservation.reservation_date || !reservation.reservation_time) return null;
  const time = reservation.reservation_time.slice(0, 5);
  const parsed = parseISO(`${reservation.reservation_date}T${time}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const isReservationActiveForTable = (
  reservation: ReservationLike,
  tableId: string,
  now = new Date()
) => {
  if (reservation.table_id !== tableId) return false;
  if (!isReservationStatusActive(reservation.status)) return false;
  if (reservation.reservation_date !== format(now, "yyyy-MM-dd")) return false;

  const reservationDate = parseReservationDateTime(reservation);
  if (!reservationDate) return false;

  const windowStart = addMinutes(reservationDate, -WINDOW_BEFORE_MINUTES);
  const windowEnd = addMinutes(reservationDate, WINDOW_AFTER_MINUTES);
  return isAfter(now, windowStart) && isBefore(now, windowEnd);
};

export const isReservationExpired = (reservation: ReservationLike, now = new Date()) => {
  if (!isReservationStatusActive(reservation.status)) return false;
  const today = format(now, "yyyy-MM-dd");
  if (reservation.reservation_date < today) return true;
  if (reservation.reservation_date > today) return false;

  const reservationDate = parseReservationDateTime(reservation);
  if (!reservationDate) return false;
  return isBefore(addMinutes(reservationDate, WINDOW_AFTER_MINUTES), now);
};

export const buildActiveReservationByTable = <T extends ReservationLike>(
  reservations: T[],
  now = new Date()
) => {
  const map = new Map<string, T>();

  reservations
    .filter((reservation) => reservation.table_id && isReservationActiveForTable(reservation, reservation.table_id, now))
    .sort((a, b) => (a.reservation_time || "").localeCompare(b.reservation_time || ""))
    .forEach((reservation) => {
      if (reservation.table_id && !map.has(reservation.table_id)) {
        map.set(reservation.table_id, reservation);
      }
    });

  return map;
};