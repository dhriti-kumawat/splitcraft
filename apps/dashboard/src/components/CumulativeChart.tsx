import {
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { SERIES } from '../lib/chartColors';

interface Series {
  key: string;
  name: string;
}

/**
 * Cumulative conversion rate per variant (16-exp-step5-results.html). Thin 2 px lines in
 * the validated series colours, a crosshair tooltip, recessive grid, and a direct label on
 * each line's last value. The legend is HTML beside it; the table on the page has the numbers.
 */
export function CumulativeChart({
  data,
  series,
  summary,
}: {
  data: Array<Record<string, number | string | null>>;
  series: Series[];
  summary: string;
}) {
  const last = data.length - 1;
  return (
    <figure style={{ margin: 0 }} aria-label={summary}>
      <div
        style={{ display: 'flex', gap: 16, marginBottom: 8, fontSize: 13, color: 'var(--text-2)' }}
      >
        {series.map((s, i) => (
          <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span
              aria-hidden="true"
              style={{ width: 14, height: 2, borderRadius: 1, background: SERIES[i] }}
            />
            {s.name}
          </span>
        ))}
      </div>
      <div style={{ height: 240 }} aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 16, right: 56, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="var(--line-soft)" vertical={false} />
            {data.length > 5 && (
              <ReferenceArea
                x1={data[0]!.day as string}
                x2={data[2]!.day as string}
                fill="var(--ground)"
                fillOpacity={0.8}
                label={{
                  value: 'Early days are noisy',
                  position: 'insideTopLeft',
                  fill: 'var(--muted)',
                  fontSize: 11,
                }}
              />
            )}
            <XAxis
              dataKey="day"
              tick={{ fill: 'var(--muted)', fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--line-strong)' }}
              minTickGap={24}
            />
            <YAxis
              tick={{ fill: 'var(--muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
              tickLine={false}
              axisLine={false}
              width={48}
              domain={['auto', 'auto']}
              tickFormatter={(v: number) => `${v.toFixed(1)}%`}
            />
            <Tooltip
              cursor={{ stroke: 'var(--line-strong)' }}
              formatter={(v, name) => [
                typeof v === 'number' ? `${v.toFixed(2)}%` : '—',
                series.find((s) => s.key === name)?.name ?? name,
              ]}
              contentStyle={{ borderRadius: 8, border: '1px solid var(--line)', fontSize: 13 }}
              labelStyle={{ color: 'var(--ink)', fontWeight: 600 }}
            />
            {series.map((s, i) => (
              <Line
                key={s.key}
                dataKey={s.key}
                name={s.key}
                stroke={SERIES[i]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }}
                connectNulls
                isAnimationActive={false}
              >
                <LabelList
                  dataKey={s.key}
                  content={({ x, y, value, index }) =>
                    index === last && typeof value === 'number' ? (
                      <text
                        x={Number(x) + 8}
                        y={Number(y) + 4}
                        fontSize={12}
                        fontFamily="var(--font-mono)"
                        fill="var(--text-2)"
                      >
                        {value.toFixed(2)}%
                      </text>
                    ) : null
                  }
                />
              </Line>
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
