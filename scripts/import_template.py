#!/usr/bin/env python3
"""Nạp assets/n3-template.json vào Postgres/Supabase. Chạy lại nhiều lần vẫn an toàn (upsert theo code).

Dùng:  DATABASE_URL=postgresql://... python3 import_template.py [đường_dẫn_json] [--publish]
Cần quyền ghi bảng template_* (dùng service role / tài khoản quản trị, KHÔNG dùng khóa của người dùng).
Cài:   pip install psycopg2-binary
"""
import json, os, sys
import psycopg2

def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    publish = '--publish' in sys.argv
    path = args[0] if args else os.path.join(os.path.dirname(__file__), '..', 'assets', 'n3-template.json')
    dsn = os.environ.get('DATABASE_URL')
    if not dsn:
        sys.exit('Thiếu biến môi trường DATABASE_URL')
    tpl = json.load(open(path, encoding='utf-8'))
    with psycopg2.connect(dsn) as conn, conn.cursor() as cur:
        cur.execute("""
          insert into templates (slug,title,version,locale,hours_disclaimer,is_published)
          values (%s,%s,%s,%s,%s,%s)
          on conflict (slug) do update set title=excluded.title, version=excluded.version,
            hours_disclaimer=excluded.hours_disclaimer, is_published = templates.is_published or excluded.is_published
          returning id""", (tpl['slug'], tpl['title'], tpl['version'], tpl['locale'], tpl.get('hours_disclaimer'), publish))
        tid = cur.fetchone()[0]
        phase_id = {}
        for p in tpl['phases']:
            cur.execute("""insert into template_phases (template_id,code,title,goal,sort) values (%s,%s,%s,%s,%s)
              on conflict (template_id,code) do update set title=excluded.title, goal=excluded.goal, sort=excluded.sort
              returning id""", (tid, p['code'], p['title'], p['goal'], p['sort']))
            phase_id[p['code']] = cur.fetchone()[0]
        res_id = {}
        for r in tpl['resources']:
            cur.execute("""insert into template_resources
              (template_id,code,kind,title,purpose,price_vnd,tier,lead_time_days,buy_url,is_affiliate,note)
              values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
              on conflict (template_id,code) do update set kind=excluded.kind, title=excluded.title, purpose=excluded.purpose,
                price_vnd=excluded.price_vnd, tier=excluded.tier, lead_time_days=excluded.lead_time_days, note=excluded.note
              returning id""",
              (tid, r['code'], r['kind'], r['title'], r['purpose'], r['price_vnd'], r['tier'], r['lead_time_days'],
               r.get('buy_url'), r.get('is_affiliate', False), r.get('note')))
            res_id[r['code']] = cur.fetchone()[0]
        for t in tpl['tasks']:
            cur.execute("""insert into template_tasks
              (template_id,phase_id,code,milestone,name,deliverable,tool_note,est_hours,writing_target,sort,origin,optional)
              values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
              on conflict (template_id,code) do update set phase_id=excluded.phase_id, milestone=excluded.milestone, name=excluded.name,
                deliverable=excluded.deliverable, tool_note=excluded.tool_note, est_hours=excluded.est_hours,
                writing_target=excluded.writing_target, sort=excluded.sort, origin=excluded.origin, optional=excluded.optional
              returning id""",
              (tid, phase_id[t['phase']], t['code'], t['milestone'], t['name'], t['deliverable'], t['tool_note'],
               t['est_hours'], t['writing_target'], t['sort'], t['origin'], t['optional']))
            task_id = cur.fetchone()[0]
            cur.execute("delete from template_task_resources where task_id=%s", (task_id,))
            for rc in t['resources']:
                cur.execute("insert into template_task_resources (task_id,resource_id) values (%s,%s)", (task_id, res_id[rc]))
        print(f"Đã nạp: {len(tpl['phases'])} phase, {len(tpl['tasks'])} task, {len(tpl['resources'])} tài nguyên (published={publish})")

if __name__ == '__main__':
    main()
