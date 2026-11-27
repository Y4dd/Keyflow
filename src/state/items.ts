// Recording an attempt at an item (P2-T1): schedule its card from the rating, then save the card
// and the attempt's log. Grading the attempt into a rating is P2-T4's.

import type { Grade } from 'ts-fsrs'
import { newItem, review, type AttemptResult, type Item } from '../practice/items.ts'
import { saveReview } from '../storage/db.ts'

/**
 * Resolves to the item as rescheduled. A practised item counts as unlocked from now if it
 * wasn't already: one with no row yet (drills are picked at random until P2-T6) gets one, and a
 * locked one is unlocked.
 */
export async function recordAttempt(
  id: string,
  rating: Grade,
  attempt: AttemptResult,
  now = new Date(),
): Promise<Item> {
  return saveReview(id, (stored) => {
    const item = stored ?? newItem(id, now)
    return review({ ...item, unlocked: item.unlocked ?? now }, rating, attempt, now)
  })
}
