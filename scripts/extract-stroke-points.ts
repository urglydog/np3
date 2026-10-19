// Trich toa do net chuan (stroke_points) tu cac file SVG KanjiVG da co o apps/web/public/kanjivg/*.svg,
// de module On luyen tu cham K2 bang heuristic hinh hoc client-side (packages/core scoreHandwriting,
// xem supabase/migrations/20261019090000_review_auto_grade.sql + CLAUDE.md bat bien #4(c)).
//
// CHI VIET RA FILE SQL, KHONG TU CHAY (khong ket noi Supabase) - script nay chi in ra
// supabase/seed_review_stroke_points.sql, user tu soat roi ap bang `supabase db reset`/dan vao SQL Editor.
// Chay: npx tsx scripts/extract-stroke-points.ts
//
// Dinh dang luu (cot review_kanji.stroke_points, xem packages/core StrokePath):
//   [[{x,y}, ...], [{x,y}, ...], ...] - moi phan tu la 1 net, toa do da chuan hoa 0..1 theo viewBox goc
//   (viewBox KanjiVG co dinh "0 0 327 327" nen chia deu cho 327; scoreHandwriting tu chuan hoa lai theo
//   bounding box thuc khi so khop nen chia theo viewBox hay bounding box rieng cua tung kanji deu hop le,
//   o day dung viewBox cho don gian va nhat quan giua moi file).

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const KANJIVG_DIR = join(root, 'apps/web/public/kanjivg');
const OUT_FILE = join(root, 'supabase/seed_review_stroke_points.sql');

const VIEWBOX_SIZE = 327; // co dinh cho moi file da co trong apps/web/public/kanjivg (xem M1b)
const POINTS_PER_STROKE = 24; // du day de scoreHandwriting resample lai (16 diem) khong mat hinh dang

interface Point {
  x: number;
  y: number;
}

/** Tach cac lenh path "M10,20C1,2 3,4 5,6L7,8Z" thanh [{cmd:'M', args:[10,20]}, ...]. */
function tokenizeCommands(d: string): { cmd: string; args: number[] }[] {
  const out: { cmd: string; args: number[] }[] = [];
  const re = /([MmLlCcQqZz])([^MmLlCcQqZz]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d))) {
    const cmd = m[1];
    const nums = (m[2].match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number);
    if (cmd === 'Z' || cmd === 'z') {
      out.push({ cmd, args: [] });
      continue;
    }
    // Moi lenh co the lap lai nhieu bo toa do lien tiep (vd "L x1 y1 x2 y2") - tach theo arity.
    const arity = cmd === 'C' || cmd === 'c' ? 6 : cmd === 'Q' || cmd === 'q' ? 4 : 2;
    for (let i = 0; i < nums.length; i += arity) {
      out.push({ cmd, args: nums.slice(i, i + arity) });
    }
  }
  return out;
}

function cubicPoint(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const e = t * t * t;
  return { x: a * p0.x + b * p1.x + c * p2.x + e * p3.x, y: a * p0.y + b * p1.y + c * p2.y + e * p3.y };
}

function quadPoint(p0: Point, p1: Point, p2: Point, t: number): Point {
  const mt = 1 - t;
  return {
    x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
    y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
  };
}

const CURVE_SAMPLES = 12; // so diem noi suy tren moi doan cong, truoc khi resample deu ve POINTS_PER_STROKE

/** Chuyen 1 path "d" (ho tro M/L/C/Q, tuyet doi + tuong doi, Z) thanh 1 day diem tho (chua resample deu). */
function pathToRawPoints(d: string): Point[] {
  const cmds = tokenizeCommands(d);
  const pts: Point[] = [];
  let cur: Point = { x: 0, y: 0 };
  let start: Point = { x: 0, y: 0 };
  for (const { cmd, args } of cmds) {
    const rel = cmd === cmd.toLowerCase() && cmd !== 'Z' && cmd !== 'z';
    switch (cmd.toUpperCase()) {
      case 'M': {
        const [x, y] = args;
        cur = rel ? { x: cur.x + x, y: cur.y + y } : { x, y };
        start = cur;
        pts.push(cur);
        break;
      }
      case 'L': {
        const [x, y] = args;
        cur = rel ? { x: cur.x + x, y: cur.y + y } : { x, y };
        pts.push(cur);
        break;
      }
      case 'C': {
        const [x1, y1, x2, y2, x, y] = args;
        const p1 = rel ? { x: cur.x + x1, y: cur.y + y1 } : { x: x1, y: y1 };
        const p2 = rel ? { x: cur.x + x2, y: cur.y + y2 } : { x: x2, y: y2 };
        const p3 = rel ? { x: cur.x + x, y: cur.y + y } : { x, y };
        for (let i = 1; i <= CURVE_SAMPLES; i++) pts.push(cubicPoint(cur, p1, p2, p3, i / CURVE_SAMPLES));
        cur = p3;
        break;
      }
      case 'Q': {
        const [x1, y1, x, y] = args;
        const p1 = rel ? { x: cur.x + x1, y: cur.y + y1 } : { x: x1, y: y1 };
        const p2 = rel ? { x: cur.x + x, y: cur.y + y } : { x, y };
        for (let i = 1; i <= CURVE_SAMPLES; i++) pts.push(quadPoint(cur, p1, p2, i / CURVE_SAMPLES));
        cur = p2;
        break;
      }
      case 'Z':
        pts.push(start);
        cur = start;
        break;
      default:
        // Lenh khong ho tro (hiem gap trong KanjiVG da qua kanji_colorize.py) - bo qua, khong chan ca file.
        break;
    }
  }
  return pts;
}

/** Lay dung `count` diem cach deu theo do dai cung (giong resamplePath o packages/core/src/review.ts). */
function resample(path: readonly Point[], count: number): Point[] {
  if (path.length === 0) return Array.from({ length: count }, () => ({ x: 0, y: 0 }));
  if (path.length === 1) return Array.from({ length: count }, () => ({ x: path[0].x, y: path[0].y }));
  const segLens: number[] = [];
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const dist = Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
    segLens.push(dist);
    total += dist;
  }
  if (total === 0) return Array.from({ length: count }, () => ({ x: path[0].x, y: path[0].y }));
  const out: Point[] = [];
  for (let k = 0; k < count; k++) {
    const target = count === 1 ? 0 : (total * k) / (count - 1);
    let acc = 0;
    let seg = 0;
    while (seg < segLens.length - 1 && acc + segLens[seg] < target) {
      acc += segLens[seg];
      seg++;
    }
    const segLen = segLens[seg] || 1;
    const t = Math.max(0, Math.min(1, (target - acc) / segLen));
    const a = path[seg];
    const b = path[seg + 1];
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return out;
}

function normalize(p: Point): Point {
  return { x: Number((p.x / VIEWBOX_SIZE).toFixed(4)), y: Number((p.y / VIEWBOX_SIZE).toFixed(4)) };
}

/** Trich toan bo net cua 1 file SVG KanjiVG, theo dung thu tu id kvg:xxxx-s1, -s2, ... */
function extractStrokes(svg: string): Point[][] {
  const matches = [...svg.matchAll(/<path[^>]*\bid="kvg:[0-9a-f]+-s(\d+)"[^>]*\bd="([^"]+)"/gi)];
  matches.sort((a, b) => Number(a[1]) - Number(b[1]));
  return matches.map(([, , d]) => resample(pathToRawPoints(d), POINTS_PER_STROKE).map(normalize));
}

function hexFromFileName(file: string): string {
  return file.replace(/\.svg$/i, '');
}

function main() {
  const files = readdirSync(KANJIVG_DIR).filter((f) => f.endsWith('.svg'));
  const lines: string[] = [
    '-- Sinh tu dong boi scripts/extract-stroke-points.ts - KHONG sua tay, chay lai script neu can doi.',
    '-- Nap toa do net chuan (stroke_points) cho scoreHandwriting (K2 auto-grade, CLAUDE.md #4c).',
    '-- An toan chay lai nhieu lan: chi update theo unicode_hex, khong dung du lieu ca nhan.',
    '-- KHONG TU CHAY FILE NAY - soat thu cong roi moi ap vao DB local/cloud.',
    '',
  ];
  let ok = 0;
  let skipped = 0;
  for (const file of files.sort()) {
    const hex = hexFromFileName(file);
    const svg = readFileSync(join(KANJIVG_DIR, file), 'utf8');
    const strokes = extractStrokes(svg);
    if (strokes.length === 0) {
      skipped++;
      console.warn(`Bo qua ${file}: khong tim duoc net nao (kiem tra lai cau truc SVG).`);
      continue;
    }
    const json = JSON.stringify(strokes).replace(/'/g, "''");
    lines.push(`update review_kanji set stroke_points = '${json}'::jsonb where unicode_hex = '${hex}';`);
    ok++;
  }
  writeFileSync(OUT_FILE, lines.join('\n') + '\n', 'utf8');
  console.log(`Da ghi ${ok} dong update vao ${OUT_FILE} (bo qua ${skipped} file loi).`);
}

main();
