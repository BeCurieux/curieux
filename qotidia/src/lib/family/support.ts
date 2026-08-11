// How long we may look, when a family asks us to.
//
// The number was written out four times — in the action that creates the
// grant, on the button that offers it, in the privacy explainer, and now in
// a numbered promise. Four independent copies of a retention period is how a
// commitment quietly stops being true: somebody lengthens the grant for a
// support case, and three pages carry on telling families it expires sooner
// than it does.
//
// It lives here because it is a fact about the family's account, not about
// the form that creates one.

/**
 * Hours a support grant lasts before expiring on its own.
 *
 * Two days is the shape of the promise: long enough to survive a reply
 * overnight and a timezone, short enough that forgetting to revoke it is not
 * the same as leaving the door open. Nothing renews it; a second look needs
 * a second grant, which the family makes deliberately and the activity log
 * records separately.
 */
export const SUPPORT_ACCESS_HOURS = 48;
