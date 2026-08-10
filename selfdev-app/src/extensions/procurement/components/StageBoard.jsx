import React, { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RouterLinkButton } from '../../../components/RouterLinkButton'
import { procurementApi } from '../api/client'
import { StatusBadge } from '../components/StatusBadge'
import { AlertTriangle, CircleAlert, Refresh } from './icons'

// Which registry filter a column's "open all" link should apply.
const registryFilter = {
  SOURCING: 'SOURCING',
  NEGOTIATION: 'NEGOTIATION',
  COMPARISON: 'COMPARISON',
  ESCALATED: 'ESCALATED',
}

function StageCard({ card, onOpen }) {
  return (
    <button type="button" className="pr-case-card" onClick={() => onOpen(card.id)}>
      <div>
        <strong>{card.title}</strong>
        <span>
          CAS {card.casNumber || 'не указан'} · {card.targetVolume || 'объём не указан'}
        </span>
        {(card.proposalCount > 0 || card.assignmentCount > 0) && (
          <span className="pr-case-card__relations">
            {card.assignmentCount > 0 && `${card.assignmentCount} переговоров`}
            {card.assignmentCount > 0 && card.proposalCount > 0 && ' · '}
            {card.proposalCount > 0 && `${card.proposalCount} предложений`}
          </span>
        )}
      </div>
      {card.isDraft
        ? <StatusBadge
            status="DRAFT"
            label={`Черновик · −${card.incompleteFieldCount}`}
            compact
          />
        : <StatusBadge status={card.completeness || card.status} compact />}
    </button>
  )
}

/**
 * The stage board.
 *
 * Each column keeps its own exact total and its own pagination, so a large
 * intake in one stage cannot hide the cards in another, and a long column
 * scrolls inside itself instead of stretching the page.
 */
export function StageBoard({ stages, truncated }) {
  const navigate = useNavigate()
  const [extra, setExtra] = useState({})
  const [pageOf, setPageOf] = useState({})
  const [loading, setLoading] = useState(null)
  const [error, setError] = useState(null)

  const open = useCallback(id => navigate(`/procurement/requests/${id}`), [navigate])

  const loadMore = async stage => {
    setLoading(stage.id)
    setError(null)
    try {
      const nextPage = (pageOf[stage.id] || 1) + 1
      const response = await procurementApi.overviewBoard({
        stage: stage.id,
        page: nextPage,
        pageSize: stage.pageSize,
      })
      const column = response.stages?.[0]
      setExtra(current => ({
        ...current,
        [stage.id]: [...(current[stage.id] || []), ...(column?.cards || [])],
      }))
      setPageOf(current => ({ ...current, [stage.id]: nextPage }))
      if (column && !column.hasMore) {
        setExtra(current => ({ ...current, [`${stage.id}:done`]: true }))
      }
    } catch (loadError) {
      setError(loadError?.response?.data?.message || loadError?.message)
    } finally {
      setLoading(null)
    }
  }

  const columns = useMemo(() => (stages || []).map(stage => {
    const loaded = [...(stage.cards || []), ...(extra[stage.id] || [])]
    return {
      ...stage,
      loaded,
      // Trust the server's total; hide "load more" once everything is in.
      hasMore: !extra[`${stage.id}:done`] && loaded.length < stage.count,
    }
  }), [stages, extra])

  return (
    <>
      {truncated && (
        <p className="pr-note pr-stage-board__truncated">
          <AlertTriangle size={13} />
          Показана только часть очень большого каталога. Пользуйтесь реестром
          карточек с фильтрами для полного списка.
        </p>
      )}
      {error && (
        <p className="pr-form-error pr-stage-board__error">
          <CircleAlert size={13} />{error}
        </p>
      )}
      <div className="pr-stage-board">
        {columns.map(stage => (
          <section className="pr-stage" key={stage.id} aria-label={stage.label}>
            <header className="pr-stage__header">
              <span>{stage.label}</span>
              <Badge variant="secondary" title={`Всего карточек: ${stage.count}`}>
                {stage.count}
              </Badge>
            </header>

            <div className="pr-stage__cards" tabIndex={stage.count ? 0 : -1}>
              {stage.loaded.map(card => (
                <StageCard key={card.id} card={card} onOpen={open} />
              ))}

              {stage.hasMore && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="pr-stage__more"
                  isDisabled={loading === stage.id}
                  onPress={() => loadMore(stage)}
                >
                  <Refresh
                    size={13}
                    className={loading === stage.id ? 'pr-spin' : undefined}
                  />
                  {loading === stage.id
                    ? 'Загружаем…'
                    : `Показать ещё (${stage.count - stage.loaded.length})`}
                </Button>
              )}

              {!stage.count && <div className="pr-stage__empty">Нет карточек</div>}
            </div>

            {stage.count > 0 && (
              <footer className="pr-stage__footer">
                <span>
                  Показано {stage.loaded.length} из {stage.count}
                </span>
                <RouterLinkButton
                  to={`/procurement/requests?status=${registryFilter[stage.id] || ''}`}
                  variant="ghost"
                  size="sm"
                >
                  В реестре
                </RouterLinkButton>
              </footer>
            )}
          </section>
        ))}
      </div>
    </>
  )
}
