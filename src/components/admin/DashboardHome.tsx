'use client'

// The Operations Center overview lives in the Today view now (src/components/admin/ops/TodayView.tsx),
// reachable at /admin/dashboard?section=today. This wrapper exists only so a stray import of the old
// dashboard-home entry point keeps working instead of breaking the build.
export { TodayView as DashboardHome } from '@/components/admin/ops/TodayView'
