/** Chart primitives, in the shadcn shape, over Recharts.
 *
 * `ChartContainer` turns a config object into CSS custom properties, so a series
 * is coloured by name (`var(--color-replied)`) rather than by a hex literal
 * repeated at every mark. That is what keeps a chart theme-aware: the tokens are
 * redefined for dark mode in one place and every mark follows.
 */

import * as React from "react"
import { ResponsiveContainer, Tooltip, Legend } from "recharts"

import { cn } from "@/lib/utils"

const ChartContext = React.createContext(null)

function useChart() {
  const context = React.useContext(ChartContext)
  if (!context) throw new Error("useChart must be used inside a <ChartContainer />")
  return context
}

/** Emit `--color-<key>` for every configured series. */
function ChartStyle({ id, config }) {
  const entries = Object.entries(config).filter(([, item]) => item.color)
  if (!entries.length) return null
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `[data-chart="${id}"]{${entries
          .map(([key, item]) => `--color-${key}:${item.color};`)
          .join("")}}`,
      }}
    />
  )
}

function ChartContainer({ id, className, children, config, ...props }) {
  const generated = React.useId()
  const chartId = `chart-${id || generated.replace(/:/g, "")}`
  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        data-slot="chart"
        className={cn(
          "tw:flex tw:aspect-video tw:justify-center tw:text-xs",
          "tw:[&_.recharts-cartesian-grid_line]:stroke-border/60",
          "tw:[&_.recharts-cartesian-axis-line]:stroke-border",
          "tw:[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground",
          "tw:[&_.recharts-surface]:outline-hidden",
          className
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <ResponsiveContainer>{children}</ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
}

const ChartTooltip = Tooltip

/** The tooltip body: a swatch, the configured label, and the value. */
function ChartTooltipContent({
  active,
  payload,
  label,
  labelFormatter,
  formatter,
  hideLabel = false,
  className,
}) {
  const { config } = useChart()
  if (!active || !payload?.length) return null
  const heading = labelFormatter ? labelFormatter(label, payload) : label
  return (
    <div
      className={cn(
        "tw:grid tw:min-w-[9rem] tw:items-start tw:gap-1.5 tw:rounded-lg tw:border tw:border-border/50 tw:bg-background tw:px-2.5 tw:py-1.5 tw:text-xs tw:shadow-xl",
        className
      )}
    >
      {!hideLabel && heading != null && (
        <div className="tw:font-medium">{heading}</div>
      )}
      <div className="tw:grid tw:gap-1.5">
        {payload.map((item, index) => {
          const key = String(item.dataKey ?? item.name ?? index)
          const itemConfig = config[key] || {}
          const color = item.color || item.payload?.fill
          return (
            <div key={key} className="tw:flex tw:w-full tw:items-center tw:gap-2">
              <span
                className="tw:h-2.5 tw:w-2.5 tw:shrink-0 tw:rounded-[3px]"
                style={{ backgroundColor: color }}
              />
              <span className="tw:text-muted-foreground">
                {itemConfig.label || item.name}
              </span>
              <span className="tw:ml-auto tw:font-mono tw:font-medium tw:tabular-nums tw:text-foreground">
                {formatter ? formatter(item.value, key, item) : item.value}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const ChartLegend = Legend

function ChartLegendContent({ payload, className }) {
  const { config } = useChart()
  if (!payload?.length) return null
  // Recharts hands the payload back in its own render order, which for a
  // stacked bar is not the order the series were declared in: an ordered scale
  // — age buckets, severity tiers — then reads as shuffled. The config is the
  // authoritative order, so the legend follows it.
  const order = Object.keys(config)
  const ordered = [...payload].sort((a, b) => {
    const left = order.indexOf(String(a.dataKey ?? a.value))
    const right = order.indexOf(String(b.dataKey ?? b.value))
    return (left < 0 ? order.length : left) - (right < 0 ? order.length : right)
  })
  return (
    <div className={cn("tw:flex tw:flex-wrap tw:items-center tw:justify-center tw:gap-x-4 tw:gap-y-1.5 tw:pt-3", className)}>
      {ordered.map(item => {
        const key = String(item.dataKey ?? item.value)
        return (
          <div key={key} className="tw:flex tw:items-center tw:gap-1.5">
            <span
              className="tw:h-2.5 tw:w-2.5 tw:shrink-0 tw:rounded-[3px]"
              style={{ backgroundColor: item.color }}
            />
            <span className="tw:text-muted-foreground">
              {config[key]?.label || item.value}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
  ChartTooltip,
  ChartTooltipContent,
  useChart,
}
