-- Roadmap Planner: schema Postgres (Supabase). Thiết kế đa người dùng ngay từ đầu (user_id + RLS),
-- dù bản đầu chỉ có một người dùng, để sau này mở cho mọi người không phải đổi cấu trúc.
-- Mọi cột ngày là DATE (không có giờ) vì lịch học tính theo ngày. Múi giờ nằm ở plans.timezone.

-- ============ DANH MỤC DÙNG CHUNG (chỉ đọc với người dùng, ghi bằng service role) ============
create table templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  version text not null,
  locale text not null default 'vi',
  hours_disclaimer text,
  is_published boolean not null default false,
  source_note text,                              -- nguồn biên soạn (giáo trình nào, ai duyệt)
  created_at timestamptz not null default now()
);

create table template_phases (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references templates(id) on delete cascade,
  code text not null,
  title text not null,
  goal text,
  sort int not null,
  unique (template_id, code),
  unique (template_id, sort)
);

create table template_resources (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references templates(id) on delete cascade,
  code text not null,
  kind text not null,
  title text not null,
  purpose text,
  price_vnd int not null default 0 check (price_vnd >= 0),
  price_checked_at date,                         -- ngày kiểm tra giá lần cuối (bắt buộc hiển thị "giá tham khảo")
  tier text not null check (tier in ('core','optional')),
  free_alternative text,
  lead_time_days int not null default 5 check (lead_time_days >= 0),  -- thời gian chờ giao hàng
  buy_url text,
  is_affiliate boolean not null default false,   -- true thì UI phải ghi rõ "link affiliate"
  note text,
  unique (template_id, code),
  check (buy_url is null or buy_url ~ '^https://')
);

create table template_tasks (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references templates(id) on delete cascade,
  phase_id uuid not null references template_phases(id) on delete restrict,
  code text not null,
  milestone text,
  name text not null,
  deliverable text,
  tool_note text,
  est_hours numeric(6,2) not null check (est_hours > 0),
  writing_target int not null default 0 check (writing_target >= 0),
  sort int not null,
  origin text not null default 'v4.1',
  optional boolean not null default false,
  unique (template_id, code),
  unique (template_id, sort)
);

create table template_task_resources (
  task_id uuid not null references template_tasks(id) on delete cascade,
  resource_id uuid not null references template_resources(id) on delete cascade,
  primary key (task_id, resource_id)
);

-- ============ DỮ LIỆU CỦA TỪNG NGƯỜI DÙNG ============
create table plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  template_id uuid not null references templates(id),
  start_date date not null,
  hours_per_day numeric(4,2) not null check (hours_per_day > 0 and hours_per_day <= 16),
  days_per_week smallint not null check (days_per_week between 1 and 7),
  include_optional boolean not null default false,
  timezone text not null default 'Asia/Ho_Chi_Minh',
  created_at timestamptz not null default now()
);
create index plans_user_idx on plans(user_id);

create table plan_task_state (
  plan_id uuid not null references plans(id) on delete cascade,
  task_id uuid not null references template_tasks(id),
  status text not null default 'todo' check (status in ('todo','in_progress','done','skipped')),
  writing_reps int not null default 0 check (writing_reps >= 0),
  kana_accuracy numeric(4,3) check (kana_accuracy between 0 and 1),
  speaking_minutes int not null default 0 check (speaking_minutes >= 0),
  pinned_start date,                              -- "Hoãn", "Ghim", "Nghỉ" đều lưu thành ngày ghim
  done_on date,
  updated_at timestamptz not null default now(),
  primary key (plan_id, task_id)
);

create table plan_resource_state (
  plan_id uuid not null references plans(id) on delete cascade,
  resource_id uuid not null references template_resources(id),
  status text not null default 'none' check (status in ('none','owned','ordered','received','not_needed')),
  opted_in boolean not null default true,         -- tài nguyên 'optional' mặc định false khi tạo plan
  ordered_on date,
  eta date,
  primary key (plan_id, resource_id)
);

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_success_at timestamptz,
  disabled_at timestamptz
);
create index push_subscriptions_user_idx on push_subscriptions(user_id);

-- Hộp thư gửi đi (outbox): worker chỉ đọc bảng này; dedupe_key bảo đảm chạy lại không gửi trùng
create table reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references plans(id) on delete cascade,
  kind text not null check (kind in ('study_daily','task_due','buy_book')),
  dedupe_key text not null,
  fire_at timestamptz not null,
  title text not null,
  body text not null,
  deep_link text not null default '/',
  status text not null default 'pending' check (status in ('pending','sent','failed','cancelled')),
  attempts smallint not null default 0,
  sent_at timestamptz,
  unique (plan_id, kind, dedupe_key)
);
create index reminders_due_idx on reminders(fire_at) where status = 'pending';

create table ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  purpose text not null,
  input_hash text not null,
  prompt_tokens int,
  output_tokens int,
  ok boolean not null default true
);
create index ai_usage_user_day_idx on ai_usage(user_id, created_at);

-- ============ BẢO MẬT HÀNG (RLS) ============
alter table templates              enable row level security;
alter table template_phases        enable row level security;
alter table template_resources     enable row level security;
alter table template_tasks         enable row level security;
alter table template_task_resources enable row level security;
alter table plans                  enable row level security;
alter table plan_task_state        enable row level security;
alter table plan_resource_state    enable row level security;
alter table push_subscriptions     enable row level security;
alter table reminders              enable row level security;
alter table ai_usage               enable row level security;

-- Danh mục: người đăng nhập chỉ đọc bản đã xuất bản; ghi bằng service role (bỏ qua RLS)
create policy templates_read on templates for select to authenticated using (is_published);
create policy phases_read on template_phases for select to authenticated
  using (exists (select 1 from templates t where t.id = template_id and t.is_published));
create policy resources_read on template_resources for select to authenticated
  using (exists (select 1 from templates t where t.id = template_id and t.is_published));
create policy tasks_read on template_tasks for select to authenticated
  using (exists (select 1 from templates t where t.id = template_id and t.is_published));
create policy task_res_read on template_task_resources for select to authenticated
  using (exists (select 1 from template_tasks tt join templates t on t.id = tt.template_id
                 where tt.id = task_id and t.is_published));

-- Dữ liệu cá nhân: chỉ chủ sở hữu. (select auth.uid()) để Postgres đánh giá một lần cho cả truy vấn.
create policy plans_owner on plans for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy task_state_owner on plan_task_state for all to authenticated
  using (exists (select 1 from plans p where p.id = plan_id and p.user_id = (select auth.uid())))
  with check (exists (select 1 from plans p where p.id = plan_id and p.user_id = (select auth.uid())));
create policy res_state_owner on plan_resource_state for all to authenticated
  using (exists (select 1 from plans p where p.id = plan_id and p.user_id = (select auth.uid())))
  with check (exists (select 1 from plans p where p.id = plan_id and p.user_id = (select auth.uid())));
create policy push_owner on push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy reminders_read_own on reminders for select to authenticated
  using (user_id = (select auth.uid()));          -- chỉ đọc; worker ghi bằng service role
create policy ai_usage_read_own on ai_usage for select to authenticated
  using (user_id = (select auth.uid()));          -- ghi bằng service role ở server
