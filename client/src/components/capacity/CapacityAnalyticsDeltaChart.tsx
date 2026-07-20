import { useId } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from 'recharts';
import type { AnalyticsRow } from '../../utils/capacityTrends';
import { useI18n } from '../../context/I18nContext';
import { useDataVizColors } from '../../context/DataVizColorsContext';

const CONTRACT_KEY = 'contractMinusProd';
const SCENARIO_KEY = 'scenarioMinusProd';
const CALL_OFF_KEY = 'callOffMinusProd';

type Props = {
  title: string;
  rows: AnalyticsRow[];
  hasScenario: boolean;
  hasCallOff?: boolean;
  height?: number;
  captureKey?: string;
};

export default function CapacityAnalyticsDeltaChart({
  title,
  rows,
  hasScenario,
  hasCallOff = false,
  height = 280,
  captureKey,
}: Props) {
  const { t } = useI18n();
  const vizColors = useDataVizColors();
  const exportId = useId();
  const contractLabel = t('dataViz.deltaContractMinusProd');
  const scenarioLabel = t('dataViz.deltaScenarioMinusProd');
  const callOffLabel = t('dataViz.deltaCallOffMinusProd');

  const barData = rows.map((r) => ({
    year: r.year,
    [CONTRACT_KEY]: r.deltaContractMinusProd,
    ...(hasScenario ? { [SCENARIO_KEY]: r.deltaScenarioProdMinusProd } : {}),
    ...(hasCallOff ? { [CALL_OFF_KEY]: r.deltaCallOffMinusProd } : {}),
  }));

  const wrapProps = captureKey
    ? { 'data-pdf-chart': captureKey, 'data-pdf-chart-title': title }
    : {
        'data-viz-export-block': '',
        'data-viz-export-block-type': 'chart',
        'data-viz-export-id': exportId,
        'data-viz-export-title': title,
      };

  return (
    <div
      {...wrapProps}
      style={{
        background: 'white',
        borderRadius: 8,
        padding: '1rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        border: '1px solid #eee',
        width: '100%',
      }}
    >
      <h3 style={{ margin: '0 0 12px', fontSize: '1rem' }}>{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={barData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eceff1" />
          <XAxis dataKey="year" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v} p.p.`} />
          <Tooltip
            formatter={(v, name) => [`${v != null ? v : '—'} p.p.`, String(name ?? '')]}
            labelFormatter={(y) => t('dataViz.tooltipYear', { year: y })}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <ReferenceLine y={0} stroke="#666" />
          <Bar dataKey={CONTRACT_KEY} name={contractLabel} fill={vizColors.contract} radius={[4, 4, 0, 0]} />
          {hasScenario && <Bar dataKey={SCENARIO_KEY} name={scenarioLabel} fill={vizColors.scenarioProduction} radius={[4, 4, 0, 0]} />}
          {hasCallOff && <Bar dataKey={CALL_OFF_KEY} name={callOffLabel} fill={vizColors.callOff} radius={[4, 4, 0, 0]} />}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
