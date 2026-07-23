import type { AvailabilitySlot } from "@/lib/api";

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function isValidTimeRange(startTime: string, endTime: string): boolean {
  return timeToMinutes(endTime) > timeToMinutes(startTime);
}

export function slotsInRange(
  slots: AvailabilitySlot[],
  startTime: string,
  endTime: string,
): AvailabilitySlot[] {
  if (!isValidTimeRange(startTime, endTime)) return [];

  const rangeStart = timeToMinutes(startTime);
  const rangeEnd = timeToMinutes(endTime);

  return slots.filter((slot) => {
    const slotStart = timeToMinutes(slot.start_time);
    const slotEnd = timeToMinutes(slot.end_time);
    return slotStart < rangeEnd && slotEnd > rangeStart;
  });
}

export function hasFullSlotInRange(
  slots: AvailabilitySlot[],
  startTime: string,
  endTime: string,
): boolean {
  return slotsInRange(slots, startTime, endTime).some((slot) => slot.is_full);
}
