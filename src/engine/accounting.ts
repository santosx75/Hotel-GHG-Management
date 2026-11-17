import type { ActivityMetrics, CalcLine, CostLine, PropertyInputs, S3Status, Totals } from '../types';
import { ENERGY_CONTENT, safeDiv, sum } from './util';

export const S3_NAMES: Record<number, string> = {
  1: 'Purchased goods and services', 2: 'Capital goods', 3: 'Fuel- and energy-related activities', 4: 'Upstream transportation and distribution', 5: 'Waste generated in operations',
  6: 'Business travel', 7: 'Employee commuting', 8: 'Upstream leased assets', 9: 'Downstream transportation and distribution', 10: 'Processing of sold products',
  11: 'Use of sold products', 12: 'End-of-life treatment of sold products', 13: 'Downstream leased assets', 14: 'Franchises', 15: 'Investments',
};

export interface S3Row { cat: number; name: string; status: S3Status; kg: number; lineCount: number; justification: string; auto: boolean }

/** Screening matrix: calculated categories are derived from lines; others come from the user's screening. */
export function scope3Matrix(p: PropertyInputs, lines: CalcLine[]): S3Row[] {
  return Array.from({ length: 15 }, (_, i) => {
    const cat = i + 1;
    const ls = lines.filter((l) => l.scope === 'S3' && l.s3cat === cat);
    const kg = sum(ls.map((l) => l.kg));
    const screen = p.boundary.scope3.find((s) => s.cat === cat);
    const anyMissing = ls.some((l) => l.status === 'missing');
    if (ls.length > 0) {
      const estimatedShare = kg > 0 ? sum(ls.filter((l) => ['estimated', 'assumed'].includes(l.status)).map((l) => l.kg)) / kg : 1;
      return { cat, name: S3_NAMES[cat], status: anyMissing ? 'missing' : estimatedShare > 0.5 ? 'estimated' : 'included', kg, lineCount: ls.length, justification: screen?.justification ?? 'Calculated from activity data in this model.', auto: true };
    }
    return { cat, name: S3_NAMES[cat], status: screen?.status ?? 'not_assessed', kg: 0, lineCount: 0, justification: screen?.justification ?? 'Not yet screened.', auto: false };
  });
}

export function isPartialInventory(rows: S3Row[], lines: CalcLine[]) {
  return rows.some((r) => r.status === 'not_assessed' || r.status === 'missing') || lines.some((l) => l.status === 'missing' && l.views.includes('corporate'));
}

/** Operating cost as borne by the business: VAT added where not recoverable. */
export function costTotal(c: CostLine, vatRecoverable: boolean) {
  return c.total * (vatRecoverable ? 1 : 1 + c.vatRate);
}

export function computeTotals(p: PropertyInputs, act: ActivityMetrics, lines: CalcLine[], costs: CostLine[], energy: Record<string, { total: number[] }>, waterMains: number[], wasteKg: Record<string, number>): Totals {
  const by = (pred: (l: CalcLine) => boolean) => sum(lines.filter(pred).map((l) => l.kg));
  const scope1 = by((l) => l.scope === 'S1');
  const s2 = lines.filter((l) => l.scope === 'S2');
  const scope2LB = sum(s2.map((l) => l.kg));
  const scope2MB = s2.length === 0 ? 0 : s2.some((l) => l.kgMB == null) ? null : sum(s2.map((l) => l.kgMB as number));
  const s3 = lines.filter((l) => l.scope === 'S3' && l.views.includes('corporate'));
  const scope3 = sum(s3.map((l) => l.kg));
  const scope3ByCat: Record<number, number> = {};
  for (const l of s3) scope3ByCat[l.s3cat!] = (scope3ByCat[l.s3cat!] ?? 0) + l.kg;
  const corporateLB = scope1 + scope2LB + scope3;
  const corporateMB = scope2MB == null ? null : scope1 + scope2MB + scope3;
  const hcmi = by((l) => l.views.includes('hcmi'));
  const visitor = by((l) => l.views.includes('visitor'));
  const lca = by((l) => l.views.includes('lca'));
  const guestTravel = by((l) => l.department === 'Guest travel' && l.views.includes('visitor') && !l.activityId.includes('nonco2'));
  const guestTravelNonCO2 = by((l) => l.activityId === 'gt-aviation-nonco2');
  const biogenicCO2 = by((l) => l.activityId.startsWith('biogenic-'));
  const outsideScopes = by((l) => l.scope === 'OUT');
  let energyKWh = 0;
  for (const [c, f] of Object.entries(energy)) energyKWh += sum(f.total) * (ENERGY_CONTENT[c]?.kWhPerUnit ?? 1);
  const electricityKWh = energy.electricity ? sum(energy.electricity.total) : 0;
  const opexEUR = sum(costs.map((c) => costTotal(c, p.finance.vatRecoverable)));
  const opexFixedEUR = sum(costs.map((c) => c.fixed * (p.finance.vatRecoverable ? 1 : 1 + c.vatRate)));
  const occRN = sum(act.occupiedRoomNights);
  const gn = sum(act.guestNights);
  const meetingShare = p.building.conditionedAreaM2 > 0 ? Math.min(1, p.activity.meetingAreaM2 / p.building.conditionedAreaM2) : 0;
  const rows = scope3Matrix(p, lines);
  return {
    scope1, scope2LB, scope2MB, scope3, scope3ByCat, outsideScopes, biogenicCO2, corporateLB, corporateMB, hcmi, visitor, lca, guestTravel, guestTravelNonCO2,
    energyKWh, electricityKWh, waterM3: sum(waterMains), wasteKg: sum(Object.values(wasteKg)), opexEUR, opexFixedEUR,
    partialInventory: isPartialInventory(rows, lines),
    perOccupiedRoomNight: safeDiv(corporateLB, occRN),
    perGuestNight: safeDiv(corporateLB, gn),
    hcmiPerOccupiedRoom: safeDiv(hcmi * (1 - meetingShare), occRN),
    hcmiPerMeetingM2Hour: p.activity.meetingAreaM2 > 0 && p.activity.meetingRoomHoursPerYear > 0 ? safeDiv(hcmi * meetingShare, p.activity.meetingAreaM2 * p.activity.meetingRoomHoursPerYear) : null,
    perRevenueEUR: p.finance.revenueEUR != null && p.finance.revenueEUR > 0 ? safeDiv(corporateLB, p.finance.revenueEUR) : null,
  };
}
