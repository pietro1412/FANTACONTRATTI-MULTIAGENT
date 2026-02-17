import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'
import { type TeamData } from './types'

interface WaterfallChartProps {
  team: TeamData
}

interface WaterfallItem {
  name: string
  value: number
  cumulative: number
  isTotal: boolean
  color: string
}

function buildWaterfallData(team: TeamData): WaterfallItem[] {
  const items: WaterfallItem[] = []
  const initialBudget = team.budget + team.totalAcquisitionCost
    + (team.totalReleaseCosts ?? 0)
    - (team.totalIndemnities ?? 0)
    + team.tradeBudgetOut
    - team.tradeBudgetIn

  let cumulative = initialBudget

  items.push({
    name: 'Budget Iniziale',
    value: initialBudget,
    cumulative: initialBudget,
    isTotal: true,
    color: '#3b82f6',
  })

  if (team.totalAcquisitionCost > 0) {
    cumulative -= team.totalAcquisitionCost
    items.push({
      name: 'Aste',
      value: -team.totalAcquisitionCost,
      cumulative,
      isTotal: false,
      color: '#ea580c',
    })
  }

  if (team.totalReleaseCosts !== null && team.totalReleaseCosts > 0) {
    cumulative -= team.totalReleaseCosts
    items.push({
      name: 'Tagli',
      value: -team.totalReleaseCosts,
      cumulative,
      isTotal: false,
      color: '#ef4444',
    })
  }

  if (team.totalIndemnities !== null && team.totalIndemnities > 0) {
    cumulative += team.totalIndemnities
    items.push({
      name: 'Indennizzi',
      value: team.totalIndemnities,
      cumulative,
      isTotal: false,
      color: '#22c55e',
    })
  }

  if (team.tradeBudgetOut > 0) {
    cumulative -= team.tradeBudgetOut
    items.push({
      name: 'Scambi (Out)',
      value: -team.tradeBudgetOut,
      cumulative,
      isTotal: false,
      color: '#f59e0b',
    })
  }

  if (team.tradeBudgetIn > 0) {
    cumulative += team.tradeBudgetIn
    items.push({
      name: 'Scambi (In)',
      value: team.tradeBudgetIn,
      cumulative,
      isTotal: false,
      color: '#8b5cf6',
    })
  }

  // Budget attuale = what's left
  items.push({
    name: 'Budget Attuale',
    value: team.budget,
    cumulative: team.budget,
    isTotal: true,
    color: '#3b82f6',
  })

  // Ingaggi
  cumulative = team.budget - team.annualContractCost
  items.push({
    name: 'Ingaggi',
    value: -team.annualContractCost,
    cumulative,
    isTotal: false,
    color: '#f59e0b',
  })

  // Bilancio
  const balance = team.budget - team.annualContractCost
  items.push({
    name: 'BILANCIO',
    value: balance,
    cumulative: balance,
    isTotal: true,
    color: balance >= 0 ? '#22c55e' : '#ef4444',
  })

  return items
}

// Recharts waterfall uses stacked bars with invisible base
function toRechartsData(items: WaterfallItem[]) {
  return items.map((item) => {
    if (item.isTotal) {
      return {
        name: item.name,
        base: 0,
        value: Math.abs(item.value),
        fill: item.color,
        displayValue: item.value,
      }
    }
    // For non-total items, base is the cumulative before this step
    const base = item.value > 0 ? item.cumulative - item.value : item.cumulative
    return {
      name: item.name,
      base: Math.max(0, base),
      value: Math.abs(item.value),
      fill: item.color,
      displayValue: item.value,
    }
  })
}

export function WaterfallChart({ team }: WaterfallChartProps) {
  const items = buildWaterfallData(team)
  const chartData = toRechartsData(items)

  return (
    <div className="bg-surface-300/50 rounded-lg p-3 md:p-4 border border-surface-50/10">
      <div className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wider mb-3">
        Waterfall: Dove Sono Finiti i Crediti
      </div>

      {/* Desktop: recharts bar */}
      <div className="hidden md:block" style={{ height: 350 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2d3139" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#9ca3af', fontSize: 9 }}
              interval={0}
              angle={-25}
              textAnchor="end"
              height={60}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1a1c20', border: '1px solid #2d3139', borderRadius: 8, fontSize: 12 }}
              formatter={((_value: number, _name: string, props: { payload: { displayValue: number } }) => {
                const dv = props.payload.displayValue
                return [`${dv >= 0 ? '+' : ''}${dv}M`, '']
              }) as any}
            />
            <ReferenceLine y={0} stroke="#6b7280" />
            <Bar dataKey="base" stackId="a" fill="transparent" />
            <Bar dataKey="value" stackId="a" radius={[3, 3, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Mobile: compact list */}
      <div className="md:hidden space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              {item.isTotal ? (
                <span className="text-gray-400 font-medium">=</span>
              ) : item.value > 0 ? (
                <span className="text-green-400">+</span>
              ) : (
                <span className="text-danger-400">-</span>
              )}
              <span className={item.isTotal ? 'text-white font-medium' : 'text-gray-400'}>
                {item.name}
              </span>
            </div>
            <span
              className="font-medium"
              style={{ color: item.color }}
            >
              {item.isTotal ? '' : item.value > 0 ? '+' : ''}{item.value}M
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
