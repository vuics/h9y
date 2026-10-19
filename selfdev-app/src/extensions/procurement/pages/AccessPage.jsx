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

/** What pressing "Отозвать" would actually achieve for this permission.
 *
 * Three states rather than two: a permission granted by both a platform role and
 * a procurement назначение survives the revoke, and saying nothing there implies
 * it would not.
 */
const REVOCABILITY_NOTE = {
  PARTIALLY_REVOCABLE: ' — снимется частично: роль платформы всё равно оставит это разрешение',
  PLATFORM_ONLY: ' — только через роль платформы, здесь не снимается',
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
        {REVOCABILITY_NOTE[entry.revocability] &&
          <span className="pr-note">{REVOCABILITY_NOTE[entry.revocability]}</span>}
      </li>)}</ul>
    </div>)}
  </div>
}

/** How the access model works, on the page where it is used.
 *
 * Collapsed by default: an administrator doing this for the tenth time does not
 * need it, and the person doing it for the first time has nowhere else to look.
 */
function AccessLegend({ roles }) {
  return <details className="pr-access-legend">
    <summary>Как устроен доступ</summary>

    <h4>Два источника разрешений</h4>
    <p>
      <strong>Роль платформы</strong> выдаётся вне Procurement и общая для всей
      установки — здесь она только показывается. <strong>Назначение</strong> —
      собственная запись Procurement: только её на этой странице и выдают,
      и только её отзывают.
    </p>

    <h4>Три пометки у разрешения</h4>
    <ul>
      <li><Badge variant="outline">роль платформы</Badge> — пришло из ролей платформы, здесь не снимается.</li>
      <li><Badge variant="outline">роль</Badge> — входит в набор роли выданного назначения.</li>
      <li><Badge>точечно</Badge> — добавлено отдельной галочкой сверх роли.</li>
    </ul>
    <p className="pr-note">
      Одно и то же разрешение может прийти из нескольких источников сразу. Тогда
      отзыв назначения снимет только свою часть — об этом написано прямо
      в строке разрешения.
    </p>

    <h4>Роли дополняют друг друга</h4>
    <p>
      Разрешения всех ролей объединяются, и ни одна не включает другую целиком.
      Поэтому роль обычно <em>добавляют</em>: если заменить «Закупщика» на
      «Специалиста», человек получит право подтверждать производителя, но
      потеряет право создавать карточки.
    </p>
    <ul className="pr-access-legend-roles">
      {roles.map(entry => <li key={entry.role}>
        <strong>{entry.label}</strong> <code>{entry.role}</code>
        <span className="pr-note"> — {entry.description}</span>
      </li>)}
    </ul>

    <h4>Ограничения выдачи</h4>
    <ul>
      <li>Выдать можно только то, что есть у вас самих — своё право нельзя превысить.</li>
      <li>Ключевое разделение контура: находить поставщиков может закупщик, а <em>подтверждать производителя</em> — только специалист. Автоматическая оценка это сделать не может ни при каких условиях.</li>
      <li>«Только рекомендует» снимает у роли право закрывать эскалации: человек разбирает случай и пишет рекомендацию, а решение принимает другой.</li>
      <li>Срок действия необязателен; после его истечения назначение перестаёт давать разрешения, но остаётся видимым — чтобы было понятно, почему доступ пропал.</li>
    </ul>
  </details>
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
  // No preselected role. `grantableRoles` arrives sorted, so defaulting to the
  // first one meant the form opened on Администратор — the widest grant in the
  // list, one Enter away, and the one role whose set already contains every
  // permission and therefore hid the point-permission block entirely.
  const [role, setRole] = useState('')
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
      <select
        value={role}
        /* Точечные разрешения относятся к выбранной роли: то, что отмечено для
           одной, для другой может уже входить в набор роли. */
        onChange={event => { setRole(event.target.value); setExtra([]) }}
      >
        <option value="">— выберите роль —</option>
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

    {/* Always rendered, never behind a disclosure. This section was hidden
        twice over — absent until a role was picked, and then collapsed — so the
        legend described a control the reader could not find. A heading that is
        always present and states why it is empty costs one line and answers the
        question the empty space raised. */}
    <section className="pr-access-extra">
      <h4>Точечные разрешения сверх роли {role && offered.length > 0 && `(${extra.length})`}</h4>
      {!role && <p className="pr-note">
        Сначала выберите роль — набор зависит от неё: то, что уже входит в роль,
        здесь не повторяется.
      </p>}
      {role && offered.length === 0 && <p className="pr-note">
        Эта роль уже включает всё, что вы можете выдать, — добавлять нечего.
      </p>}
      {role && offered.length > 0 && grouped(offered).map(([group, entries]) =>
        <fieldset key={group}>
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
    </section>

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

/** Who belongs to this organization, and adding someone by exact email.
 *
 * The page never lists the installation's other accounts. Adding is always an
 * invitation and is answered the same way whether the address has an account
 * or not; the person gets access on their next sign-in with that email.
 */
function MembersPanel({ vocabulary, organization, invitations }) {
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [roles, setRoles] = useState([])
  const [notice, setNotice] = useState(null)
  const refresh = () => queryClient.invalidateQueries({ queryKey: procurementKeys.all.concat('access-principals') })
  const invite = useMutation({
    mutationFn: procurementApi.inviteMember,
    onSuccess: result => { setNotice(result?.message || 'Приглашение сохранено.'); setEmail(''); setRoles([]); refresh() },
  })
  const withdraw = useMutation({ mutationFn: procurementApi.removeMember, onSuccess: refresh })
  const offered = vocabulary.roles.filter(entry => vocabulary.grantableRoles.includes(entry.role))
  const toggle = role => setRoles(current => current.includes(role)
    ? current.filter(item => item !== role)
    : [...current, role])

  return <Card>
    <CardHeader>
      <div>
        <CardTitle>Участники организации{organization ? ` «${organization.name}»` : ''}</CardTitle>
        <p className="pr-note">
          Здесь видны только участники вашей организации. Добавьте человека по
          точному email — доступ появится, когда он войдёт в систему с этим адресом.
        </p>
      </div>
    </CardHeader>
    <CardContent className="pr-access-members">
      <form
        className="pr-access-invite"
        onSubmit={event => {
          event.preventDefault()
          setNotice(null)
          invite.mutate({ email: email.trim(), roles })
        }}
      >
        <label className="pr-form-field">
          <span>Email</span>
          <Input type="email" required value={email} onChange={event => setEmail(event.target.value)} />
        </label>
        <fieldset>
          <legend className="pr-note">Роли при входе</legend>
          {offered.map(entry => <label key={entry.role}>
            <input type="checkbox" checked={roles.includes(entry.role)} onChange={() => toggle(entry.role)} />
            {' '}{entry.label}
          </label>)}
        </fieldset>
        <Button type="submit" isDisabled={invite.isPending || !email.trim()}>
          <Check size={15} />{invite.isPending ? 'Сохранение…' : 'Добавить'}
        </Button>
      </form>
      {notice && <p className="pr-note" role="status">{notice}</p>}
      {invite.isError && <Alert>
        <AlertTriangle />
        <AlertTitle>Не удалось добавить</AlertTitle>
        <AlertDescription>{mutationMessage(invite.error)}</AlertDescription>
      </Alert>}
      {invitations.length > 0 && <>
        <h4>Ожидают входа</h4>
        <ul className="pr-access-invitations">{invitations.map(item => <li key={item.email}>
          <span>
            <strong>{item.email}</strong>
            {item.pendingRoles.length > 0 && <span className="pr-note"> · {item.pendingRoles.join(', ')}</span>}
          </span>
          <Button variant="ghost" size="sm" isDisabled={withdraw.isPending} onPress={() => withdraw.mutate({ email: item.email })}>
            <Trash size={14} />Отозвать приглашение
          </Button>
        </li>)}</ul>
      </>}
      {withdraw.isError && <Alert>
        <AlertTriangle />
        <AlertTitle>Не удалось отозвать приглашение</AlertTitle>
        <AlertDescription>{mutationMessage(withdraw.error)}</AlertDescription>
      </Alert>}
    </CardContent>
  </Card>
}

const EVENT_LABELS = {
  ORGANIZATION_CREATED: 'создана организация',
  ORGANIZATION_SUSPENDED: 'организация приостановлена',
  ORGANIZATION_REACTIVATED: 'организация возобновлена',
  ECHEMI_ENABLED: 'включена Echemi',
  ECHEMI_DISABLED: 'выключена Echemi',
  AGENT_BOUND: 'привязан агент',
  MEMBER_INVITED: 'приглашён участник',
  MEMBER_JOINED: 'участник вошёл',
  MEMBER_REMOVED: 'участник удалён',
  OPERATOR_VISIT: 'оператор работал в организации',
}

/** What happened to organizations, newest first: the operator's own actions included. */
function OrganizationEvents() {
  const events = useQuery({
    queryKey: procurementKeys.organizationEvents(),
    queryFn: ({ signal }) => procurementApi.organizationEvents(signal),
  })
  return <details className="pr-access-legend">
    <summary>Журнал организаций</summary>
    {events.isLoading && <LoadingState />}
    {events.isError && <ErrorState error={events.error} onRetry={events.refetch} />}
    {events.data && (events.data.events.length === 0
      ? <p className="pr-note">Пока ничего не произошло.</p>
      : <ul className="pr-access-invitations">{events.data.events.map(item => <li key={`${item.at}-${item.kind}-${item.actor}`}>
        <span>
          <strong>{EVENT_LABELS[item.kind] || item.kind}</strong> <code>{item.organizationId}</code>
          {item.details?.email && <span className="pr-note"> · {item.details.email}</span>}
          {item.details?.agent_id && <span className="pr-note"> · агент {item.details.agent_id}</span>}
        </span>
        <span className="pr-note">{item.at ? new Date(item.at).toLocaleString('ru-RU') : ''} · {item.actor}</span>
      </li>)}</ul>)}
  </details>
}

/** The installation operator's view: every organization, and creating one. */
function OrganizationsAdmin({ organizations }) {
  const queryClient = useQueryClient()
  const refreshOrganizations = () => {
    queryClient.invalidateQueries({ queryKey: procurementKeys.organizations() })
    queryClient.invalidateQueries({ queryKey: procurementKeys.organizationEvents() })
  }
  const status = useMutation({ mutationFn: procurementApi.setOrganizationStatus, onSuccess: refreshOrganizations })
  const echemi = useMutation({ mutationFn: procurementApi.setOrganizationEchemi, onSuccess: refreshOrganizations })
  const [form, setForm] = useState({ id: '', name: '', adminEmail: '' })
  const create = useMutation({
    mutationFn: procurementApi.createOrganization,
    onSuccess: () => {
      setForm({ id: '', name: '', adminEmail: '' })
      queryClient.invalidateQueries({ queryKey: procurementKeys.organizations() })
    },
  })
  const field = name => event => setForm(current => ({ ...current, [name]: event.target.value }))
  return <Card>
    <CardHeader>
      <div>
        <CardTitle>Организации установки</CardTitle>
        <p className="pr-note">
          Видно только оператору платформы. У каждой организации своя база
          данных; данные одной недоступны другой.
        </p>
      </div>
    </CardHeader>
    <CardContent className="pr-access-members">
      <ul className="pr-access-invitations">{organizations.map(item => <li key={item.id}>
        <span>
          <strong>{item.name}</strong> <code>{item.id}</code>
          {item.status === 'SUSPENDED' && <> <Badge variant="outline">приостановлена</Badge></>}
          {item.echemi && <> <Badge variant="outline">Echemi{item.echemiInstallationAccount ? ' · аккаунт установки' : ''}</Badge></>}
        </span>
        <span className="pr-inline-actions">
          <span className="pr-note">база {item.database}{item.agentIds?.length ? ` · агентов: ${item.agentIds.length}` : ''}</span>
          {!item.echemiInstallationAccount && <Button
            variant="ghost"
            size="sm"
            isDisabled={echemi.isPending}
            onPress={() => {
              const enabled = !item.echemi
              const question = enabled
                ? `Включить Echemi для «${item.name}»? Её агент должен войти со своим аккаунтом Echemi. Окно её браузера будет видно всем, у кого есть ссылка noVNC.`
                : `Выключить Echemi для «${item.name}»?`
              if (window.confirm(question)) echemi.mutate({ id: item.id, enabled })
            }}
          >{item.echemi ? 'Выключить Echemi' : 'Включить Echemi'}</Button>}
          <Button
            variant="ghost"
            size="sm"
            isDisabled={status.isPending}
            onPress={() => {
              const suspend = item.status !== 'SUSPENDED'
              const question = suspend
                ? `Приостановить «${item.name}»? Никто из организации не сможет работать, её агенты остановятся. Данные не удаляются.`
                : `Возобновить «${item.name}»?`
              if (window.confirm(question)) status.mutate({ id: item.id, suspend })
            }}
          >{item.status === 'SUSPENDED' ? 'Возобновить' : 'Приостановить'}</Button>
        </span>
      </li>)}</ul>
      {(status.isError || echemi.isError) && <Alert>
        <AlertTriangle />
        <AlertTitle>Не удалось изменить организацию</AlertTitle>
        <AlertDescription>{mutationMessage(status.error || echemi.error)}</AlertDescription>
      </Alert>}
      <form
        className="pr-access-invite"
        onSubmit={event => { event.preventDefault(); create.mutate(form) }}
      >
        <label className="pr-form-field">
          <span>Идентификатор (латиница)</span>
          <Input required value={form.id} pattern="[a-z][a-z0-9_]{1,31}" onChange={field('id')} />
        </label>
        <label className="pr-form-field">
          <span>Название</span>
          <Input required value={form.name} onChange={field('name')} />
        </label>
        <label className="pr-form-field">
          <span>Email администратора</span>
          <Input type="email" required value={form.adminEmail} onChange={field('adminEmail')} />
        </label>
        <Button type="submit" isDisabled={create.isPending}>
          <Check size={15} />{create.isPending ? 'Создание…' : 'Создать организацию'}
        </Button>
      </form>
      {create.isSuccess && <p className="pr-note" role="status">
        Организация создана. Администратор получит доступ при следующем входе с указанным email.
      </p>}
      {create.isError && <Alert>
        <AlertTriangle />
        <AlertTitle>Не удалось создать организацию</AlertTitle>
        <AlertDescription>{mutationMessage(create.error)}</AlertDescription>
      </Alert>}
      <OrganizationEvents />
    </CardContent>
  </Card>
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
  const { organizationsEnabled } = useProcurementPermissions()
  const remove = useMutation({
    mutationFn: procurementApi.removeMember,
    onSuccess: () => { invalidate(); onClose() },
  })

  if (query.isLoading) return <LoadingState />
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />
  const principal = query.data

  return <Card className="pr-access-detail">
    <CardHeader>
      <div>
        <CardTitle>{principal.displayName}</CardTitle>
        <p className="pr-note">{principal.email} · <code>{principal.principalKey}</code></p>
      </div>
      <div className="pr-inline-actions">
        {organizationsEnabled && <Button
          variant="outline"
          size="sm"
          isDisabled={remove.isPending}
          onPress={() => {
            if (window.confirm(`Удалить ${principal.email} из организации? Все его назначения здесь будут отозваны.`)) {
              remove.mutate({ email: principal.email })
            }
          }}
        ><Trash size={14} />Удалить из организации</Button>}
        <Button variant="ghost" size="sm" onPress={onClose}>Закрыть</Button>
      </div>
    </CardHeader>
    <CardContent>
      {remove.isError && <Alert>
        <AlertTriangle />
        <AlertTitle>Не удалось удалить из организации</AlertTitle>
        <AlertDescription>{mutationMessage(remove.error)}</AlertDescription>
      </Alert>}
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
  const { canManageAccess, organizationsEnabled, organization } = useProcurementPermissions()
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
  const organizations = useQuery({
    queryKey: procurementKeys.organizations(),
    queryFn: ({ signal }) => procurementApi.organizations(signal),
    enabled: organizationsEnabled,
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

    <AccessLegend roles={vocabulary.data.roles} />

    {organizations.data?.superadmin && <OrganizationsAdmin organizations={organizations.data.organizations} />}

    {organizationsEnabled && <MembersPanel
      vocabulary={vocabulary.data}
      organization={organizations.data?.current || organization}
      invitations={principals.data.invitations || []}
    />}

    {!organizationsEnabled && !vocabulary.data.scopeAgentId && <Alert>
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
      ? <EmptyState title={organizationsEnabled ? 'В организации пока никого не найдено' : 'Пользователи не найдены'} />
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
