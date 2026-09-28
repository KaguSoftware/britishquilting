import { Disclosure } from "@/components/ui/disclosure";
import type { Bucket, Slice, TopProduct } from "@/lib/data/finance";
import type { BucketUnit } from "@/lib/finance/calc";
import { cn, formatPence } from "@/lib/utils";

const REV = "var(--color-aubergine-700)";
const PROFIT = "var(--color-gold-500)";

const short = (p: number) => {
  const v = Math.abs(p) / 100;
  const s = v >= 10000 ? `£${Math.round(v / 1000)}k` : v >= 1000 ? `£${(v / 1000).toFixed(1)}k` : `£${Math.round(v)}`;
  return p < 0 ? `−${s}` : s;
};

function niceMax(v: number) {
  if (v <= 0) return 100;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

const labelFor = (key: string, unit: BucketUnit) => {
  const d = new Date(`${key}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-GB", unit === "month" ? { month: "short", timeZone: "UTC" } : { day: "numeric", month: "short", timeZone: "UTC" }).format(d);
};

/** Paired columns per bucket: revenue before VAT and profit. Profit can dip below the line. */
export function RevenueProfitChart({ buckets, unit }: { buckets: Bucket[]; unit: BucketUnit }) {
  return (
    <figure>
      <Legend unit={unit} />
      {/* Phones get a narrower canvas so axis text stays readable at 390px. */}
      <Plot buckets={buckets} unit={unit} w={360} h={220} className="h-auto w-full sm:hidden" />
      <Plot buckets={buckets} unit={unit} w={720} h={240} className="hidden h-64 w-full sm:block" />
      <BucketTable buckets={buckets} unit={unit} />
    </figure>
  );
}

function Legend({ unit }: { unit: BucketUnit }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-ink-soft">
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-[2px]" style={{ background: REV }} /> Revenue before VAT
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-[2px]" style={{ background: PROFIT }} /> Profit
      </span>
      <span className="ml-auto text-stone-500">By {unit}</span>
    </div>
  );
}

function Plot({ buckets, unit, w, h, className }: { buckets: Bucket[]; unit: BucketUnit; w: number; h: number; className: string }) {
  const padL = 44;
  const padB = 22;
  const top = niceMax(Math.max(0, ...buckets.map((b) => Math.max(b.revenue, b.profit))));
  const low = Math.min(0, ...buckets.map((b) => Math.min(b.revenue, b.profit)));
  const bottom = low < 0 ? -niceMax(-low) : 0;
  const plotH = h - padB - 8;
  const y = (v: number) => 8 + ((top - v) / (top - bottom)) * plotH;
  const n = Math.max(buckets.length, 1);
  const slot = (w - padL) / n;
  const bar = Math.max(2, Math.min(18, (slot - 4) / 2 - 1));
  const ticks = [top, top / 2, 0, ...(bottom < 0 ? [bottom] : [])];
  const unitWord = unit;
  const every = Math.ceil(n / (w < 500 ? 4 : 6));
  return (
      <svg viewBox={`0 0 ${w} ${h}`} className={className} role="img" aria-label={`Revenue and profit by ${unitWord}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={w} y1={y(t)} y2={y(t)} stroke="var(--color-ink)" strokeOpacity={t === 0 ? 0.35 : 0.08} vectorEffect="non-scaling-stroke" />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" className="fill-stone-500 text-[12px] tabular-nums">
              {short(t)}
            </text>
          </g>
        ))}
        {buckets.map((b, i) => {
          const cx = padL + slot * i + slot / 2;
          const col = (v: number, x: number, fill: string) => {
            const y0 = y(0);
            const y1 = y(v);
            const hh = Math.abs(y1 - y0);
            return <rect x={x} y={Math.min(y0, y1)} width={bar} height={Math.max(hh, v === 0 ? 0 : 1)} rx={Math.min(3, bar / 2)} fill={fill} />;
          };
          return (
            <g key={b.key}>
              {col(b.revenue, cx - bar - 1, REV)}
              {col(b.profit, cx + 1, PROFIT)}
              {i % every === 0 && (
                <text x={cx} y={h - 6} textAnchor="middle" className="fill-stone-500 text-[12px]">
                  {labelFor(b.key, unit)}
                </text>
              )}
              <rect x={padL + slot * i} y={0} width={slot} height={h - padB} fill="transparent">
                <title>{`${unit === "week" ? "Week of " : ""}${labelFor(b.key, unit)}: revenue ${formatPence(b.revenue)}, profit ${formatPence(b.profit)}`}</title>
              </rect>
            </g>
          );
        })}
      </svg>
  );
}

function BucketTable({ buckets, unit }: { buckets: Bucket[]; unit: BucketUnit }) {
  return (
      <Disclosure summary="Show as a table" className="mt-2 text-xs text-ink-soft" buttonClassName="text-xs text-stone-500 hover:text-ink">
        <table className="mt-2 w-full tabular-nums">
          <thead>
            <tr className="text-left text-stone-500">
              <th className="py-1 font-normal">{unit === "week" ? "Week of" : unit === "month" ? "Month" : "Day"}</th>
              <th className="py-1 text-right font-normal">Revenue</th>
              <th className="py-1 text-right font-normal">Profit</th>
            </tr>
          </thead>
          <tbody>
            {buckets.filter((b) => b.revenue || b.profit).map((b) => (
              <tr key={b.key} className="border-t border-ink/8">
                <td className="py-1">{labelFor(b.key, unit)}</td>
                <td className="py-1 text-right">{formatPence(b.revenue)}</td>
                <td className="py-1 text-right">{formatPence(b.profit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Disclosure>
  );
}

/** Ranked horizontal bars, each drawn as its own small SVG track so it stays crisp at any width. */
export function BarList({
  rows,
  format = formatPence,
  empty = "Nothing sold in this period yet.",
  color = REV,
}: {
  rows: { key: string; label: string; value: number; sub?: string }[];
  format?: (v: number, r: { key: string; label: string; value: number; sub?: string }) => string;
  empty?: string;
  color?: string;
}) {
  if (!rows.length) return <p className="py-6 text-sm text-stone-500">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  const total = rows.reduce((a, r) => a + Math.max(r.value, 0), 0);
  return (
    <ol className="space-y-3">
      {rows.map((r) => {
        const pct = Math.max(0, r.value / max);
        return (
          <li key={r.key}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-ink">{r.label}</span>
              <span className="shrink-0 tabular-nums text-ink">
                {format(r.value, r)}
                {total > 0 && <span className="ml-2 text-xs text-stone-500">{Math.round((Math.max(r.value, 0) / total) * 100)}%</span>}
              </span>
            </div>
            <svg viewBox="0 0 100 6" preserveAspectRatio="none" className="mt-1.5 h-1.5 w-full" aria-hidden>
              <rect x="0" y="0" width="100" height="6" fill="var(--color-cream-200)" />
              <rect x="0" y="0" width={Math.max(pct * 100, r.value > 0 ? 0.8 : 0)} height="6" fill={color} />
            </svg>
          </li>
        );
      })}
    </ol>
  );
}

export function SplitBar({ slices }: { slices: Slice[] }) {
  const total = slices.reduce((a, s) => a + s.value, 0);
  if (!total) return <p className="py-6 text-sm text-stone-500">Nothing sold in this period yet.</p>;
  const colors = ["var(--color-aubergine-700)", "var(--color-gold-500)", "var(--color-aubergine-300)", "var(--color-stone-500)"];
  let x = 0;
  return (
    <div>
      <svg viewBox="0 0 100 10" preserveAspectRatio="none" className="h-4 w-full" role="img" aria-label={slices.map((s) => `${s.label} ${formatPence(s.value)}`).join(", ")}>
        {slices.map((s, i) => {
          const wdt = (s.value / total) * 100;
          const r = <rect key={s.key} x={x} y="0" width={Math.max(wdt - (i < slices.length - 1 ? 0.4 : 0), 0)} height="10" fill={colors[i % colors.length]} />;
          x += wdt;
          return r;
        })}
      </svg>
      <ul className="mt-3 space-y-1.5 text-sm">
        {slices.map((s, i) => (
          <li key={s.key} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-[2px]" style={{ background: colors[i % colors.length] }} />
            <span className="flex-1 text-ink">{s.label}</span>
            <span className="tabular-nums">{formatPence(s.value)}</span>
            <span className="w-10 text-right text-xs tabular-nums text-stone-500">{Math.round((s.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TopProducts({ byRevenue, byQty }: { byRevenue: TopProduct[]; byQty: TopProduct[] }) {
  const qty = (v: number, u: string) => `${Number(v.toFixed(2)).toLocaleString("en-GB")} ${u}`;
  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div>
        <h3 className="mb-3 text-sm font-medium text-ink-soft">By takings</h3>
        <BarList rows={byRevenue.map((p) => ({ key: p.key, label: p.name, value: p.revenue }))} />
      </div>
      <div>
        <h3 className="mb-3 text-sm font-medium text-ink-soft">By amount sold</h3>
        <BarList
          color="var(--color-gold-500)"
          rows={byQty.map((p) => ({ key: p.key, label: p.name, value: p.qty, sub: p.unit }))}
          format={(v, r) => qty(v, r.sub ?? "")}
        />
        <p className={cn("mt-3 text-xs text-stone-500", !byQty.length && "hidden")}>Metres for cut fabric, whole rolls and units otherwise.</p>
      </div>
    </div>
  );
}
