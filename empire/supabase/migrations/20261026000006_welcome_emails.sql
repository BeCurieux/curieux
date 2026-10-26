-- Progress through the five welcome emails, per sign-up.
--
-- welcome_sent counts the emails sent so far (0 to 5). The sender moves it
-- forward one step at a time with a compare-and-set, so two runs can't send
-- the same email twice, and moves it back if the send fails.

alter table public.email_signups
  add column welcome_sent smallint not null default 0 check (welcome_sent between 0 and 5),
  add column welcome_last_sent_at timestamptz;

create index email_signups_welcome_due on public.email_signups (welcome_sent)
  where unsubscribed_at is null and welcome_sent < 5;
