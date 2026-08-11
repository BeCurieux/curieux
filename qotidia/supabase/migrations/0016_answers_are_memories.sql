-- An answer is a memory.
--
-- Notice → Ask → Remember only closes if the remembering puts the answer
-- back where the noticing can find it. An answer stored on the question row
-- alone was read exactly once, by the book generator, and was invisible to
-- the analysis, the clustering, the look-back, next year's questions, and
-- the export — which promises a family everything they kept.
--
-- That made the most considered sentences in the archive the only
-- second-class ones. A parent writes "Bun Bun. He came from Nana and he goes
-- everywhere" precisely because we asked. That is not a footnote to a
-- memory; it is one.

alter table follow_up_questions
  add column answer_memory_id uuid references memories(id) on delete set null;

comment on column follow_up_questions.answer_memory_id is
  'The memory created from this answer. Editing the answer updates that row '
  'rather than adding a second one. Null for questions answered before this '
  'migration and for questions never answered.';

create index follow_up_questions_answer_memory_idx
  on follow_up_questions (answer_memory_id) where answer_memory_id is not null;
