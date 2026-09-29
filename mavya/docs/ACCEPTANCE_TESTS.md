# Acceptance Tests — Ovyko v0.1

## M0

### Security
- Parent A cannot read Parent B family data.
- Owner A cannot read Organisation B.
- Instructor A cannot read Organisation B.
- Direct API requests cannot bypass RLS.
- No sensitive child fields are sent to analytics.

### Auth
- unauthenticated user is redirected to sign-in
- role determines app shell
- logout terminates session

## M1

### Parent demo path
1. Open family home.
2. See Ava's Wednesday swimming lesson.
3. Tap `Can't make it`.
4. Confirm absence.
5. See make-up options.
6. Select Saturday 9:00.
7. Confirm booking.
8. See success state.
9. Open Ava.
10. See progress.

### Business demo path
1. Open dashboard.
2. See 4 temporary vacancies.
3. Tap `Fill 4 open spots`.
4. See eligible family candidates.
5. Open Dolphin 3.
6. See occupancy/absence information.

### Instructor demo path
1. Open instructor home.
2. Open Dolphin 3.
3. Mark a child present/absent.
4. Open Ava.
5. Update Kick 10m to achieved.
6. See success confirmation.

## Quality
- parent screens work at 390px
- instructor tap targets are comfortable
- no broken navigation in core path
- no dead primary CTA
- keyboard/focus handling acceptable
- contrast acceptable
- no generic placeholder copy in shipped demo
