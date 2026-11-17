import type { ActivityMetrics, PropertyInputs } from '../types';
import { DAYS_IN_MONTH, clamp01, map12, sum, zeros } from './util';

/**
 * Activity metrics. These quantities are never interchangeable:
 *  - available room-nights = rooms × open days × (1 − out-of-order rate)
 *  - occupied room-nights = Σ types available × occupancy
 *  - guest-nights = occupied room-nights × guests per occupied room
 *  - stays (room-stays) = occupied room-nights ÷ average length of stay (steady-state approximation)
 *  - departures = stays; arriving guests = guest-nights ÷ length of stay
 *  - stayover room-nights = occupied room-nights − departures
 */
export function computeActivity(p: PropertyInputs): ActivityMetrics {
  const a = p.activity;
  const los = Math.max(1, a.avgLengthOfStayNights);
  const available = zeros();
  const occupied = zeros();
  const guestNights = zeros();
  for (const rt of a.roomTypes) {
    for (let m = 0; m < 12; m++) {
      const open = Math.min(a.monthlyOpenDays[m], DAYS_IN_MONTH[m]);
      const avail = rt.count * open * (1 - clamp01(a.outOfOrderRate));
      const occ = clamp01(a.monthlyOccupancy[m] * rt.occupancyIndex);
      available[m] += avail;
      occupied[m] += avail * occ;
      guestNights[m] += avail * occ * rt.guestsPerOccupiedRoom;
    }
  }
  const stays = occupied.map((o) => o / los);
  const arrivingGuests = guestNights.map((g) => g / los);
  const stayover = occupied.map((o, m) => Math.max(0, o - stays[m]));
  const openDays = a.monthlyOpenDays.map((d, m) => Math.min(d, DAYS_IN_MONTH[m]));
  const occupancyRate = map12((m) => (available[m] > 0 ? occupied[m] / available[m] : 0));
  const rooms = sum(a.roomTypes.map((r) => r.count));
  const beds = sum(a.roomTypes.map((r) => r.count * r.beds));
  const guestroomAreaM2 = a.guestroomAreaM2Override ?? sum(a.roomTypes.map((r) => r.count * r.areaM2));

  const totalOpen = sum(openDays);
  const covers = {
    breakfast: guestNights.map((g) => g * clamp01(a.breakfastUptake)),
    mainMeals: guestNights.map((g, m) => g * clamp01(a.dinnerUptake) + a.externalCoversPerOpenDay * openDays[m]),
    roomService: occupied.map((o) => o * a.roomServiceOrdersPerOccRoomNight),
    banquet: openDays.map((d) => (totalOpen > 0 ? (a.eventAttendeesPerYear * d) / totalOpen : 0)),
    staff: openDays.map((d) => (totalOpen > 0 ? (a.staffFTE * a.workingDaysPerFTE * a.staffMealsPerFTEDay * d) / totalOpen : 0)),
    bar: openDays.map((d) => a.barCustomersPerOpenDay * d),
  };

  return { availableRoomNights: available, occupiedRoomNights: occupied, guestNights, stays, arrivingGuests, stayoverRoomNights: stayover, openDays, occupancyRate, rooms, beds, guestroomAreaM2, covers };
}
