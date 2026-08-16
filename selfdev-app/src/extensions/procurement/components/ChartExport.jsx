/** Export controls: one chart to a slide, the whole dashboard to a spreadsheet.
 *
 * `ExportableCard` wraps a chart and adds a small PNG control to its corner.
 * The control removes itself from the captured image — a screenshot with an
 * export button baked into it looks like a screenshot, which is exactly what
 * this feature exists to replace.
 */

import React, { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { procurementKeys } from '../api/queryKeys'
import { downloadBlob } from '../api/responses'
import {
  dashboardRows,
  exportFilename,
  slugify,
  toCsv,
} from '../lib/dashboardExport'
import { nodeToPngBlob } from '../lib/nodeToPng'
import { Button } from '@/components/ui/button'
import { FileCheck } from './icons'

/** Rendered at twice the on-screen size: a slide is projected, and a 1× capture
 *  of an 800px card is visibly soft the moment it fills a screen. */
const PIXEL_RATIO = 2

export function ExportableCard({ title, children }) {
  const ref = useRef(null)
  const [state, setState] = useState('idle')

  const save = async () => {
    setState('working')
    try {
      const surface = getComputedStyle(ref.current.firstElementChild || ref.current)
      const blob = await nodeToPngBlob(ref.current, {
        pixelRatio: PIXEL_RATIO,
        background: surface.backgroundColor,
      })
      downloadBlob({ blob, filename: exportFilename('png', { name: slugify(title) }) })
      setState('idle')
    } catch {
      // Deliberately not a thrown error: a failed export must not take the
      // chart down with it, and the reader still has the numbers on screen.
      setState('failed')
    }
  }

  return (
    <div className="pr-exportable" ref={ref}>
      {children}
      <div className="pr-exportable__control" data-export-ignore="true">
        <Button
          size="sm"
          variant="ghost"
          isDisabled={state === 'working'}
          onPress={save}
          aria-label={`Сохранить график «${title}» как PNG`}
        >
          {state === 'working' ? 'Сохраняю…' : state === 'failed' ? 'Не вышло' : 'PNG'}
        </Button>
      </div>
    </div>
  )
}

/** One CSV for the whole dashboard, built from what the charts already hold.
 *
 * Read out of the query cache rather than refetched, so the file is exactly the
 * numbers on screen. A section the reader has not loaded is absent from the file
 * rather than exported as zeros.
 */
export function DashboardCsvButton({ params }) {
  const queryClient = useQueryClient()
  const [failed, setFailed] = useState(false)

  const save = () => {
    const get = key => queryClient.getQueryData(key)
    const rows = dashboardRows({
      funnel: get(procurementKeys.analyticsFunnel(params)),
      variants: get(procurementKeys.variantPerformance({ stage: 'FIRST_CONTACT' })),
      bottlenecks: get(procurementKeys.analyticsBottlenecks()),
      benchmark: get(procurementKeys.analyticsBenchmark(params)),
      cycleTime: get(procurementKeys.analyticsCycleTime(params)),
      supplyBase: get(procurementKeys.analyticsSupplyBase()),
      offerQuality: get(procurementKeys.analyticsOfferQuality()),
    })
    if (!rows.length) {
      setFailed(true)
      return
    }
    setFailed(false)
    downloadBlob({
      blob: new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }),
      filename: exportFilename('csv'),
    })
  }

  return (
    <Button variant="outline" size="sm" onPress={save}>
      <FileCheck size={15} />
      {failed ? 'Нечего выгружать' : 'CSV'}
    </Button>
  )
}
