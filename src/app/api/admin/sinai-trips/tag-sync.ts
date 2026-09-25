import { diffTripCategoryTags, isMissingTripCategoryTagsTable } from '@/lib/trip-categories'
import { getSupabaseAdmin } from '@/lib/supabase'

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>

export async function syncTripCategoryTags(
  supabase: SupabaseAdminClient,
  tripId: string,
  requestedCategoryIds: readonly string[],
  primaryCategoryId?: string | null,
  preserveExistingTags = false,
): Promise<{ warning?: string; error?: string }> {
  const { data: existingRows, error: readError } = await supabase
    .from('sinai_trip_category_tags')
    .select('category_id')
    .eq('trip_id', tripId)

  if (readError) {
    if (isMissingTripCategoryTagsTable(readError)) {
      console.warn('sinai_trip_category_tags is unavailable; skipping tag sync')
      return { warning: 'Trip category tags are unavailable until migration 033 is applied.' }
    }
    console.error('Failed to read trip category tags:', readError)
    return { error: 'Failed to read trip category tags' }
  }

  const existingCategoryIds = (existingRows ?? []).map((row) => row.category_id)
  const diff = diffTripCategoryTags(
    existingCategoryIds,
    preserveExistingTags ? existingCategoryIds : requestedCategoryIds,
    primaryCategoryId,
  )

  if (diff.insertCategoryIds.length > 0) {
    const { error } = await supabase
      .from('sinai_trip_category_tags')
      .upsert(diff.insertCategoryIds.map((category_id) => ({ trip_id: tripId, category_id })), {
        onConflict: 'trip_id,category_id',
        ignoreDuplicates: true,
      })
    if (error) {
      if (isMissingTripCategoryTagsTable(error)) {
        console.warn('sinai_trip_category_tags is unavailable; skipping tag sync')
        return { warning: 'Trip category tags are unavailable until migration 033 is applied.' }
      }
      console.error('Failed to insert trip category tags:', error)
      return { error: 'Failed to save trip category tags' }
    }
  }

  if (diff.deleteCategoryIds.length > 0) {
    const { error } = await supabase
      .from('sinai_trip_category_tags')
      .delete()
      .eq('trip_id', tripId)
      .in('category_id', diff.deleteCategoryIds)
    if (error) {
      if (isMissingTripCategoryTagsTable(error)) {
        console.warn('sinai_trip_category_tags is unavailable; skipping tag sync')
        return { warning: 'Trip category tags are unavailable until migration 033 is applied.' }
      }
      console.error('Failed to delete removed trip category tags:', error)
      return { error: 'Failed to save trip category tags' }
    }
  }

  return {}
}
