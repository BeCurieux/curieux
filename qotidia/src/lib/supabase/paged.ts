// Reading every row, rather than the first thousand.
//
// PostgREST caps a response at its configured `max-rows` — a thousand by
// default — and says nothing whatsoever about having done so. There is no
// truncation flag, no warning and no error. A select that reads "every
// asset belonging to this family" comes back looking complete, and is not.
//
// In a list view that is survivable. In the two places that have to be
// exhaustive it is not, and both of them are about somebody's photographs:
//
//   The migration, which would leave the rest of a family's archive in the
//   old bucket under a summary saying it had finished.
//
//   The erasure, which would leave those files exactly where they are,
//   under a promise that they were deleted — while the rows that said where
//   they lived are gone, so nothing can ever find them again.
//
// Paging needs a stable order or pages overlap and skip, which is why every
// caller orders by a unique column before slicing.

/** What one page of a PostgREST select comes back as. */
export interface PageResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

export const PAGE = 1000;

/**
 * Read a select to the end, a page at a time.
 *
 * `label` names the table in the error, because "could not read" with no
 * subject is the kind of message that sends somebody into a debugger to
 * learn something the error could have told them.
 */
export async function readAllPages<T>(
  label: string,
  page: (from: number, to: number) => PromiseLike<PageResult<T>>
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(`could not read ${label}: ${error.message}`);
    const batch = data ?? [];
    rows.push(...batch);
    // A short page is the last page; asking again costs a round trip to be
    // told the same thing.
    if (batch.length < PAGE) return rows;
  }
}
