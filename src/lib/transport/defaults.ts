import type { TransportScheduleConfig } from './schedule'

export const DEFAULT_TRANSPORT_SCHEDULE: TransportScheduleConfig = {
  services: [
    { transferType: 'package_bus', isActive: true, scheduleMode: 'scheduled' },
    { transferType: 'hiace', isActive: true, scheduleMode: 'on_demand' },
  ],
  weeklyRules: [
    { transferType: 'package_bus', direction: 'outbound', weekday: 0, isActive: true },
    { transferType: 'package_bus', direction: 'outbound', weekday: 4, isActive: true },
    { transferType: 'package_bus', direction: 'return', weekday: 1, isActive: true },
    { transferType: 'package_bus', direction: 'return', weekday: 5, isActive: true },
  ],
  exceptions: [],
  stayPatterns: [
    {
      code: 'bus_4d3n', transferType: 'package_bus', nameAr: '٤ أيام / ٣ ليالي', nameEn: '4 days / 3 nights',
      durationDays: 4, nights: 3, returnOffsetDays: 4, departureWeekdays: [4], isActive: true, sortOrder: 0,
    },
    {
      code: 'bus_5d4n', transferType: 'package_bus', nameAr: '٥ أيام / ٤ ليالي', nameEn: '5 days / 4 nights',
      durationDays: 5, nights: 4, returnOffsetDays: 5, departureWeekdays: [0], isActive: true, sortOrder: 1,
    },
    {
      code: 'hiace_4d3n', transferType: 'hiace', nameAr: '٤ أيام / ٣ ليالي', nameEn: '4 days / 3 nights',
      durationDays: 4, nights: 3, returnOffsetDays: 4, departureWeekdays: null, isActive: true, sortOrder: 2,
    },
    {
      code: 'hiace_5d4n', transferType: 'hiace', nameAr: '٥ أيام / ٤ ليالي', nameEn: '5 days / 4 nights',
      durationDays: 5, nights: 4, returnOffsetDays: 5, departureWeekdays: null, isActive: true, sortOrder: 3,
    },
    // Migration 050: Thu + 8 → Fri and Sun + 8 → Mon are both scheduled bus returns.
    {
      code: 'bus_8d7n', transferType: 'package_bus', nameAr: '٨ أيام / ٧ ليالي', nameEn: '8 days / 7 nights',
      durationDays: 8, nights: 7, returnOffsetDays: 8, departureWeekdays: [0, 4], isActive: true, sortOrder: 2,
    },
    {
      code: 'hiace_8d7n', transferType: 'hiace', nameAr: '٨ أيام / ٧ ليالي', nameEn: '8 days / 7 nights',
      durationDays: 8, nights: 7, returnOffsetDays: 8, departureWeekdays: null, isActive: true, sortOrder: 4,
    },
  ],
  recommendedCheckInWeekdays: [1, 5],
}
