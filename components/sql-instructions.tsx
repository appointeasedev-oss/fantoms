"use client"

import { useMemo, useState } from "react"

export default function SqlInstructions({
  supabaseUrl,
  onContinue,
  onBack,
}: {
  supabaseUrl: string
  onContinue: () => void
  onBack: () => void
}) {
  const [copied, setCopied] = useState(false)

  const sql = useMemo(
    () => `-- Fantoms schema (run once). Includes tenant_key for multi-tenant separation.
create extension if not exists "uuid-ossp";

create table if not exists public.quizzes (
  id uuid primary key default uuid_generate_v4(),
  tenant_key text not null,
  title text not null,
  description text,
  status text default 'active', -- 'active' | 'inactive'
  created_at timestamptz default now()
);

create table if not exists public.questions (
  id uuid primary key default uuid_generate_v4(),
  tenant_key text not null,
  quiz_id uuid references public.quizzes(id) on delete cascade,
  prompt text not null,
  solution_text text,
  solution_video_url text
);

create table if not exists public.options (
  id uuid primary key default uuid_generate_v4(),
  tenant_key text not null,
  question_id uuid references public.questions(id) on delete cascade,
  option_text text not null,
  is_correct boolean not null default false
);

create table if not exists public.quiz_users (
  id uuid primary key default uuid_generate_v4(),
  tenant_key text not null,
  user_id text unique not null, -- generated like name_1234
  name text,
  password text,
  created_at timestamptz default now()
);

create table if not exists public.quiz_attempts (
  id uuid primary key default uuid_generate_v4(),
  tenant_key text not null,
  quiz_id uuid references public.quizzes(id) on delete cascade,
  quiz_user_id uuid references public.quiz_users(id),
  score int default 0,
  completed_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.quiz_answers (
  id uuid primary key default uuid_generate_v4(),
  tenant_key text not null,
  attempt_id uuid references public.quiz_attempts(id) on delete cascade,
  question_id uuid references public.questions(id) on delete cascade,
  selected_option_id uuid references public.options(id) on delete set null,
  is_correct boolean not null
);

-- Indexes
create index if not exists idx_quizzes_tenant on public.quizzes(tenant_key);
create index if not exists idx_questions_quiz on public.questions(quiz_id);
create index if not exists idx_options_question on public.options(question_id);
create index if not exists idx_users_tenant on public.quiz_users(tenant_key);
create index if not exists idx_attempts_quiz on public.quiz_attempts(quiz_id);
create index if not exists idx_answers_attempt on public.quiz_answers(attempt_id);

-- Enforce at most one correct option per question
create unique index if not exists uniq_correct_option_per_question
  on public.options(question_id)
  where is_correct = true;

-- RLS (permissive for demo)
alter table public.quizzes enable row level security;
alter table public.questions enable row level security;
alter table public.options enable row level security;
alter table public.quiz_users enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.quiz_answers enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'quizzes' and policyname = 'quizzes_all') then
    create policy quizzes_all on public.quizzes for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'questions' and policyname = 'questions_all') then
    create policy questions_all on public.questions for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'options' and policyname = 'options_all') then
    create policy options_all on public.options for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'quiz_users' and policyname = 'quiz_users_all') then
    create policy quiz_users_all on public.quiz_users for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'quiz_attempts' and policyname = 'quiz_attempts_all') then
    create policy quiz_attempts_all on public.quiz_attempts for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'quiz_answers' and policyname = 'quiz_answers_all') then
    create policy quiz_answers_all on public.quiz_answers for all using (true) with check (true);
  end if;
end$$;`,
    [],
  )

  return (
    <section className="rounded-xl p-5 backdrop-blur-sm border border-white/10 bg-white/5">
      <h1 className="text-xl font-medium mb-1">One-time SQL setup</h1>
      <p className="text-xs text-white/70 mb-4">
        Open your Supabase project at:{" "}
        <a className="underline" href={supabaseUrl} target="_blank" rel="noreferrer">
          {supabaseUrl}
        </a>
        , go to SQL editor, and run the script below. This creates tables and permissive policies so the anon key can be
        used by Fantoms. You can tighten policies later. Ensure that the schema is aligned and that each question has at
        most one correct option. The tenant_key column is essential for multi-tenant separation.
      </p>

      <div className="relative">
        <pre className="max-h-72 overflow-auto text-xs bg-black/60 border border-white/10 rounded-lg p-3 whitespace-pre-wrap">
          {sql}
        </pre>
        <button
          className="absolute top-2 right-2 px-2 py-1 rounded bg-white text-black text-xs"
          onClick={async () => {
            await navigator.clipboard.writeText(sql)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <div className="mt-5 flex gap-2">
        <button className="flex-1 px-3 py-2 rounded-lg border border-white/20 text-white" onClick={onBack}>
          Back
        </button>
        <button className="flex-1 px-3 py-2 rounded-lg bg-white text-black" onClick={onContinue}>
          I ran this SQL
        </button>
      </div>
    </section>
  )
}
