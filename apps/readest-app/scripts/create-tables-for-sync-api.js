const { Client } = require('pg');
const yargs = require('yargs');

const argv = yargs
  .option('pg-url', {
    alias: 'u',
    type: 'string',
    description: 'PostgreSQL connection URL (e.g., postgres://postgres:<password>@db.<project-id>.supabase.co:5432/postgres)',
    demandOption: true,
  })
  .help()
  .alias('help', 'h')
  .example('node $0 --pg-url postgres://postgres:<password>@db.<project-id>.supabase.co:5432/postgres', 'Setup Supabase schema and create default account')
  .argv;

const client = new Client({
  connectionString: argv.pgUrl,
});

const sqlQuery = `
create table public.books (
  user_id uuid not null,
  book_hash text not null,
  format text null, -- 'EPUB' | 'PDF' | 'MOBI' | 'CBZ' | 'FB2' | 'FBZ'
  title text null,
  author text null,
  "group" text null,
  tags text[] null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  deleted_at timestamp with time zone null,
  uploaded_at timestamp with time zone null,
  progress integer[] null,
  group_id text null,
  group_name text null,
  constraint books_pkey primary key (user_id, book_hash),
  constraint books_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_books ON public.books
  FOR SELECT to authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY insert_books ON public.books
  FOR INSERT to authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY update_books ON public.books
  FOR UPDATE to authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY delete_books ON public.books
  FOR DELETE to authenticated USING ((select auth.uid()) = user_id);

create table public.book_configs (
  user_id uuid not null,
  book_hash text not null,
  location text null,
  progress jsonb null,
  search_config jsonb null,
  view_settings jsonb null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  deleted_at timestamp with time zone null,
  constraint book_configs_pkey primary key (user_id, book_hash),
  constraint book_configs_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

ALTER TABLE public.book_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_book_configs ON public.book_configs
  FOR SELECT to authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY insert_book_configs ON public.book_configs
  FOR INSERT to authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY update_book_configs ON public.book_configs
  FOR UPDATE to authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY delete_book_configs ON public.book_configs
  FOR DELETE to authenticated USING ((select auth.uid()) = user_id);


create table public.book_notes (
  user_id uuid not null,
  book_hash text not null,
  id text not null,
  type text null,
  cfi text null,
  text text null,
  style text null,
  color text null,
  note text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  deleted_at timestamp with time zone null,
  constraint book_notes_pkey primary key (user_id, book_hash, id),
  constraint book_notes_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

ALTER TABLE public.book_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_book_notes ON public.book_notes
  FOR SELECT to authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY insert_book_notes ON public.book_notes
  FOR INSERT to authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY update_book_notes ON public.book_notes
  FOR UPDATE to authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY delete_book_notes ON public.book_notes
  FOR DELETE to authenticated USING ((select auth.uid()) = user_id);

-- Create the files table
create table public.files (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  book_hash text null,
  file_key text not null,
  file_size bigint not null,
  created_at timestamp with time zone null default now(),
  deleted_at timestamp with time zone null,
  constraint files_pkey primary key (id),
  constraint files_file_key_key unique (file_key),
  constraint files_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

-- Add an index for efficient querying by user_id and deleted_at
create index idx_files_user_id_deleted_at
on public.files (user_id, deleted_at);

create index idx_files_file_key
on public.files (file_key);

create index idx_files_file_key_deleted_at
on public.files (file_key, deleted_at);

-- Enable RLS on the files table
alter table public.files enable row level security;

create policy "Users can view their own active files"
on public.files
for select
using (
  auth.uid() = user_id and deleted_at is null
);


create policy "Users can soft-delete their own files"
on public.files
for update
using (
  auth.uid() = user_id
)
with check (
  deleted_at is null or deleted_at > now()
);

create policy "Users can delete their own files permanently"
on public.files
for delete
using (
  auth.uid() = user_id
);

`;

async function setupSupabase() {
  try {
    // 连接数据库
    await client.connect();
    console.log('Connected to PostgreSQL');

    // 执行 SQL
    await client.query(sqlQuery);
    console.log('Tables, RLS, and default account created successfully');

    // 关闭连接
    await client.end();
    console.log('Setup completed');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

setupSupabase();