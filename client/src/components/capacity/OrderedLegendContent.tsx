import { DefaultLegendContent } from 'recharts';

/**
 * Legenda w zadanej kolejności dataKey (Recharts często odwraca kolejność serii).
 */
export function OrderedLegendContent(props: { orderKeys: string[]; [key: string]: unknown }) {
  const { orderKeys, payload, ...rest } = props;
  const items = (Array.isArray(payload) ? payload : []) as Array<{
    dataKey?: unknown;
    value?: unknown;
  }>;
  const byKey = new Map<string, (typeof items)[number]>();
  for (const item of items) {
    const key = String(item.dataKey ?? item.value ?? '');
    if (key) byKey.set(key, item);
  }
  const ordered: typeof items = [];
  const used = new Set<string>();
  for (const key of orderKeys) {
    const item = byKey.get(key);
    if (item) {
      ordered.push(item);
      used.add(key);
    }
  }
  for (const item of items) {
    const key = String(item.dataKey ?? item.value ?? '');
    if (!used.has(key)) ordered.push(item);
  }
  return <DefaultLegendContent {...(rest as object)} payload={ordered as never} />;
}
