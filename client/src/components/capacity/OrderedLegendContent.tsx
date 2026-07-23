import { DefaultLegendContent } from 'recharts';

/**
 * Legenda w zadanej kolejności dataKey (Recharts często odwraca kolejność serii).
 * Opcjonalnie: klik przełącza widoczność (hiddenKeys + onItemClick).
 */
export function OrderedLegendContent(props: {
  orderKeys: string[];
  hiddenKeys?: Iterable<string>;
  onItemClick?: (dataKey: string) => void;
  [key: string]: unknown;
}) {
  const { orderKeys, hiddenKeys, onItemClick, payload, ...rest } = props;
  const hidden = new Set(
    hiddenKeys == null ? [] : Array.isArray(hiddenKeys) ? hiddenKeys : Array.from(hiddenKeys)
  );
  const items = (Array.isArray(payload) ? payload : []) as Array<{
    dataKey?: unknown;
    value?: unknown;
    inactive?: boolean;
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
      ordered.push({ ...item, inactive: hidden.has(key) || Boolean(item.inactive) });
      used.add(key);
    }
  }
  for (const item of items) {
    const key = String(item.dataKey ?? item.value ?? '');
    if (!used.has(key)) {
      ordered.push({ ...item, inactive: hidden.has(key) || Boolean(item.inactive) });
    }
  }
  return (
    <DefaultLegendContent
      {...(rest as object)}
      payload={ordered as never}
      onClick={(entry: { dataKey?: unknown }) => {
        const key = String(entry?.dataKey ?? '');
        if (key && onItemClick) onItemClick(key);
      }}
    />
  );
}
