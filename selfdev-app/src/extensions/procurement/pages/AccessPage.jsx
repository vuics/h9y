import React, { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { procurementApi } from '../api/client'
import { procurementKeys } from '../api/queryKeys'
import { LoadingState, ErrorState, EmptyState } from '../components/AsyncState'
import { useProcurementPermissions } from '../hooks/useProcurementPermissions'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { AlertTriangle, Check, CircleAlert, Search, Trash } from '../components/icons'

const mutationMessage = error =>
  error?.response?.data?.message || error?.response?.data?.detail?.message || error?.message

const formatDate = value => (value ? new Date(value).toLocaleDateString('ru-RU') : null)

/** Group the permission catalogue the way the API described it. */
function grouped(permissions) {
  const groups = new Map()
  for (const entry of permissions) {
    if (!groups.has(entry.group)) groups.set(entry.group, [])
    groups.get(entry.group).push(entry)
  }
  return [...groups.entries()]
}

function SourceBadges({ sources }) {
  const kinds = new Set(sources.map(source => source.kind))
  return <span className="pr-access-sources">
    {kinds.has('PLATFORM_ROLE') && <Badge variant="outline">роль платформы</Badge>}
    {kinds.has('ROLE_BINDING') && <Badge variant="outline">роль</Badge>}
    {kinds.has('BINDING_PERMISSION') && <Badge>точечно</Badge>}
  </span>
}

function EffectivePermissions({ principal }) {
  if (!principal.effectivePermissions.length) {
    return <p className="pr-note">Нет ни одного разрешения в этом рабочем месте.</p>
  }
  return <div className="pr-access-effective">
    {grouped(principal.effectivePermissions).map(([group, entries]) => <div key={group}>
      <h4>{group}</h4>
      <ul>{entries.map(entry => <li key={entry.permission}>
        <code>{entry.permission}</code>
        <SourceBadges sources={entry.sources} />
        {!entry.revocableHere && <span className="pr-note"> — только через роль платформы, здесь не снимается</span>}
      </li>)}</ul>
    </div>)}
  </div>
}

/** One binding this workspace owns, with the switch that removes it. */
function BindingRow({ binding, onRevoke, busy }) {
  return <div className={`pr-access-binding${binding.expired ? ' pr-access-binding--expired' : ''}`}>
    <div>
      <strong>{binding.roleLabel}</strong> <code>{binding.role}</code>
      {binding.decisionAuthority === 'RECOMMEND_ONLY' && <Badge variant="outline">только рекомендует</Badge>}
      {binding.expired && <Badge variant="outline">истекло</Badge>}
      {!binding.appliesHere && <Badge variant="outline">другое рабочее место</Badge>}
      {binding.selfAssignment && <Badge variant="outline">самоназначение</Badge>}
      <p className="pr-note">
        Выдал: {binding.grantedBy || '—'}
        {binding.validUntil ? ` · действует до ${formatDate(binding.validUntil)}` : ''}
        {/* Shown because a binding written against an agent workspace still
            grants permissions to a reader who has no workspace of their own,
            and its origin is otherwise invisible. */}
        {binding.scopeAgentId ? ` · рабочее место агента ${binding.scopeAgentId}` : ' · вся установка'}
      </p>
      {binding.permissions.length > 0 && <p className="pr-note">
        Дополнительно: {binding.permissions.join(', ')}
      </p>}
    </div>
    <Button variant="ghost" size="sm" isDisabled={busy} onPress={() => onRevoke(binding.bindingId)}>
      <Trash size={14} />Отозвать
    </Button>
  </div>
}

/** The grant form: a role, an optional narrowing, optional extra permissions.
 *
 * The role and the permission list are both filtered by what the API said this
 * administrator may confer, so the form cannot offer a choice the API will
 * refuse a moment later.
 */
function GrantForm({ vocabulary, principal, onSubmit, pending, error }) {
  const grantable = vocabulary.grantableRoles
  const [role, setRole] = useState(grantable[0] || '')
  const [authority, setAuthority] = useState('RESOLVE_ALLOWED')
  const [extra, setExtra] = useState([])
  const [validUntil, setValidUntil] = useState('')

  const selected = vocabulary.roles.find(entry => entry.role === role)
  const rolePermissions = useMemo(() => new Set(selected?.permissions || []), [selected])
  const offered = useMemo(
    () => vocabulary.permissions.filter(entry =>
      vocabulary.grantablePermissions.includes(entry.permission) &&
      !rolePermissions.has(entry.permission)),
    [vocabulary, rolePermissions],
  )

  if (!grantable.length) {
    return <Alert>
      <CircleAlert />
      <AlertTitle>Вы не можете выдавать роли</AlertTitle>
      <AlertDescription>
        Выдать можно только те разрешения, которые есть у вас самих. Обратитесь к администратору установки.
      </AlertDescription>
    </Alert>
  }

  const toggle = permission => setExtra(current => current.includes(permission)
    ? current.filter(item => item !== permission)
    : [...current, permission])

  return <form
    className="pr-access-grant"
    onSubmit={event => {
      event.preventDefault()
      onSubmit({
        principalKey: principal.principalKey,
        role,
        decisionAuthority: authority,
        permissions: extra,
        validUntil: validUntil ? new Date(validUntil).toISOString() : null,
      })
    }}
  >
    <label className="pr-form-field">
      <span>Роль</span>
      <select value={role} onChange={event => setRole(event.target.value)}>
        {vocabulary.roles.filter(entry => grantable.includes(entry.role)).map(entry =>
          <option key={entry.role} value={entry.role}>{entry.label} — {entry.role}</option>)}
      </select>
    </label>
    {selected && <p className="pr-note">{selected.description}</p>}

    <label className="pr-form-field">
      <span>Полномочия по эскалациям</span>
      <select value={authority} onChange={event => setAuthority(event.target.value)}>
        {vocabulary.decisionAuthorities.map(entry =>
          <option key={entry.value} value={entry.value}>{entry.label}</option>)}
      </select>
    </label>

    <label className="pr-form-field">
      <span>Действует до (необязательно)</span>
      <Input type="date" value={validUntil} onChange={event => setValidUntil(event.target.value)} />
    </label>

    {offered.length > 0 && <details className="pr-access-extra">
      <summary>Точечные разрешения сверх роли ({extra.length})</summary>
      {grouped(offered).map(([group, entries]) => <fieldset key={group}>
        <legend>{group}</legend>
        {entries.map(entry => <label key={entry.permission} className="pr-access-check">
          <input
            type="checkbox"
            checked={extra.includes(entry.permission)}
            onChange={() => toggle(entry.permission)}
          />
          <span><code>{entry.permission}</code> — {entry.description}</span>
        </label>)}
      </fieldset>)}
    </details>}

    <Alert>
      <CircleAlert />
      <AlertTitle>Назначение заменяет предыдущее для этой же роли</AlertTitle>
      <AlertDescription>
        Отправляется состояние формы целиком, а не разница: точечные разрешения,
        которые здесь не отмечены, будут сняты с этой роли.
      </AlertDescription>
    </Alert>

    {error && <Alert>
      <AlertTriangle />
      <AlertTitle>Не удалось выдать доступ</AlertTitle>
      <AlertDescription>{mutationMessage(error)}</AlertDescription>
    </Alert>}

    <Button type="submit" isDisabled={pending || !role}>
      <Check size={15} />{pending ? 'Сохранение…' : 'Выдать доступ'}
    </Button>
  </form>
}

function PrincipalDetail({ principalKey, vocabulary, onClose }) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: procurementKeys.accessPrincipal(principalKey),
    queryFn: ({ signal }) => procurementApi.accessPrincipal(principalKey, signal),
  })
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: procurementKeys.accessPrincipal(principalKey) })
    queryClient.invalidateQueries({ queryKey: procurementKeys.all.concat('access-principals') })
  }
  const grant = useMutation({ mutationFn: procurementApi.grantAccess, onSuccess: invalidate })
  const revoke = useMutation({ mutationFn: procurementApi.revokeAccess, onSuccess: invalidate })

  if (query.isLoading) return <LoadingState />
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />
  const principal = query.data

  return <Card className="pr-access-detail">
    <CardHeader>
      <div>
        <CardTitle>{principal.displayName}</CardTitle>
        <p className="pr-note">{principal.email} · <code>{principal.principalKey}</code></p>
      </div>
      <Button variant="ghost" size="sm" onPress={onClose}>Закрыть</Button>
    </CardHeader>
    <CardContent>
      {principal.platformRoleNames.length > 0 && <Alert>
        <CircleAlert />
        <AlertTitle>Роли платформы: {principal.platformRoleNames.join(', ')}</AlertTitle>
        <AlertDescription>
          Эти роли выданы вне Procurement и здесь не изменяются. Разрешения,
          которые они дают, показаны ниже как «роль платформы».
        </AlertDescription>
      </Alert>}

      <h3>Назначения этого рабочего места</h3>
      {principal.bindings.length === 0
        ? <p className="pr-note">Пока ничего не выдано.</p>
        : principal.bindings.map(binding => <BindingRow
          key={binding.bindingId}
          binding={binding}
          busy={revoke.isPending}
          onRevoke={bindingId => revoke.mutate({ principalKey, bindingId })}
        />)}
      {revoke.isError && <Alert>
        <AlertTriangle />
        <AlertTitle>Не удалось отозвать</AlertTitle>
        <AlertDescription>{mutationMessage(revoke.error)}</AlertDescription>
      </Alert>}

      <h3>Выдать роль</h3>
      <GrantForm
        vocabulary={vocabulary}
        principal={principal}
        pending={grant.isPending}
        error={grant.isError ? grant.error : null}
        onSubmit={grant.mutate}
      />

      <h3>Действующие разрешения</h3>
      <EffectivePermissions principal={principal} />
    </CardContent>
  </Card>
}

export default function AccessPage() {
  const { canManageAccess } = useProcurementPermissions()
  const [search, setSearch] = useState('')
  const [applied, setApplied] = useState('')
  const [selected, setSelected] = useState(null)

  const vocabulary = useQuery({
    queryKey: procurementKeys.accessVocabulary(),
    queryFn: ({ signal }) => procurementApi.accessVocabulary(signal),
    enabled: canManageAccess,
  })
  const principals = useQuery({
    queryKey: procurementKeys.accessPrincipals({ search: applied }),
    queryFn: ({ signal }) => procurementApi.accessPrincipals({ search: applied }, signal),
    enabled: canManageAccess,
  })

  if (!canManageAccess) {
    return <EmptyState
      title="Управление доступом недоступно"
      description="Нужно разрешение EXPERT_REGISTRY_MANAGE. Его держит роль администратора."
    />
  }
  if (vocabulary.isLoading || principals.isLoading) return <LoadingState />
  if (vocabulary.isError) return <ErrorState error={vocabulary.error} onRetry={vocabulary.refetch} />
  if (principals.isError) return <ErrorState error={principals.error} onRetry={principals.refetch} />

  const rows = principals.data.principals

  return <div className="pr-stack">
    <div className="pr-section-heading">
      <div>
        <h2>Доступ</h2>
        <p>{vocabulary.data.roleNote}</p>
      </div>
    </div>

    {!vocabulary.data.scopeAgentId && <Alert>
      <CircleAlert />
      <AlertTitle>Назначения действуют во всей установке</AlertTitle>
      <AlertDescription>
        У этой учётной записи нет развёрнутого Procurement Agent, поэтому роль
        выдаётся без привязки к рабочему месту.
      </AlertDescription>
    </Alert>}

    <form
      className="pr-inline-actions"
      onSubmit={event => { event.preventDefault(); setApplied(search.trim()) }}
    >
      <Input
        value={search}
        placeholder="Поиск по email или имени"
        onChange={event => setSearch(event.target.value)}
      />
      <Button type="submit" variant="outline"><Search size={15} />Найти</Button>
    </form>

    {principals.data.truncated && <p className="pr-note">
      Показаны не все пользователи — уточните поиск.
    </p>}

    {rows.length === 0
      ? <EmptyState title="Пользователи не найдены" />
      : <div className="pr-access-list">{rows.map(row => <button
        type="button"
        key={row.principalKey}
        className={`pr-access-row${selected === row.principalKey ? ' pr-access-row--selected' : ''}`}
        onClick={() => setSelected(row.principalKey)}
      >
        <span>
          <strong>{row.displayName}</strong>
          <span className="pr-note">{row.email}</span>
        </span>
        <span className="pr-access-row__roles">
          {row.bindings.filter(binding => !binding.expired).map(binding =>
            <Badge key={binding.bindingId}>{binding.roleLabel}</Badge>)}
          {row.platformRoles.map(role => <Badge key={role} variant="outline">{role}</Badge>)}
          {row.bindings.length === 0 && row.platformRoles.length === 0 &&
            <span className="pr-note">без доступа</span>}
        </span>
      </button>)}</div>}

    {selected && <PrincipalDetail
      principalKey={selected}
      vocabulary={vocabulary.data}
      onClose={() => setSelected(null)}
    />}
  </div>
}
