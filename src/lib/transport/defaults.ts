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
  ],
  recommendedCheckInWeekdays: [1, 5],
}
