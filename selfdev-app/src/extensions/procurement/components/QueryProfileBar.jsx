import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MAX_PROFILE_NAME_LENGTH, profileNameProblem } from '../lib/sourcingProfiles'
import { Pencil, Plus, Trash } from './icons'
import { SelectField } from './SelectField'

const refusalOf = error => error?.response?.data?.detail?.message || error?.response?.data?.message || error?.message

/** Which purchase profile a search runs with, and the profiles themselves.
 *
 * Only one of the three actions is open at a time, each in place of the buttons:
 * the list below stays in view, because it is what a new profile copies and what
 * a deleted one takes with it.
 */
export function QueryProfileBar({ settings, canEdit, disabled, planProfileDeleted, onSelect }) {
  const [action, setAction] = useState(null)
  const [name, setName] = useState('')
  const [problem, setProblem] = useState(null)
  const current = settings.profiles.find(item => item.id === settings.profileId)
  const isDefaultProfile = settings.profileId === settings.defaultProfileId
  const busy = settings.createProfile.isPending || settings.updateProfile.isPending || settings.deleteProfile.isPending

  const open = (next, initialName = '') => {
    setAction(next)
    setName(initialName)
    setProblem(null)
  }
  const close = () => open(null)

  const submit = async event => {
    event.preventDefault()
    const ownId = action === 'rename' ? settings.profileId : null
    const invalid = profileNameProblem(name, settings.profiles, ownId)
    if (invalid) return setProblem(invalid)
    try {
      if (action === 'create') {
        const saved = await settings.createProfile.mutateAsync({ name, copyFrom: settings.profileId })
        onSelect(saved.createdProfileId)
      } else {
        await settings.updateProfile.mutateAsync({ profileId: settings.profileId, name })
      }
      close()
    } catch (error) {
      setProblem(refusalOf(error))
    }
  }
  const remove = async () => {
    try {
      await settings.deleteProfile.mutateAsync(settings.profileId)
      onSelect(null)
      close()
    } catch (error) {
      setProblem(refusalOf(error))
    }
  }

  return <>
    <div className="pr-query-profile">
      <SelectField
        label="Профиль закупки"
        selectedKey={settings.profileId}
        isDisabled={disabled}
        onSelectionChange={profileId => { close(); onSelect(profileId) }}
      >
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>{settings.profiles.map(profile => <SelectItem key={profile.id} id={profile.id} textValue={profile.name}>
          {profile.name}{profile.id === settings.defaultProfileId ? ' (по умолчанию)' : ''}
        </SelectItem>)}</SelectContent>
      </SelectField>
      {canEdit && !action && <>
        <Button variant="outline" size="sm" isDisabled={disabled} onPress={() => open('create')}><Plus size={14} />Новый профиль</Button>
        <Button variant="ghost" size="sm" isDisabled={disabled} onPress={() => open('rename', current?.name || '')}><Pencil size={14} />Переименовать</Button>
        {!isDefaultProfile && <Button
          variant="ghost"
          size="sm"
          isDisabled={disabled || settings.saveDefaultProfile.isPending}
          onPress={() => settings.saveDefaultProfile.mutate(settings.profileId)}
        >Сделать профилем по умолчанию</Button>}
        <Button
          variant="ghost"
          size="sm"
          isDisabled={disabled || isDefaultProfile}
          aria-label={isDefaultProfile ? 'Удалить профиль: недоступно для профиля по умолчанию' : 'Удалить профиль'}
          onPress={() => open('delete')}
        ><Trash size={14} />Удалить</Button>
      </>}
    </div>
    <p className="pr-query-profile-note">
      Профиль определяет запросы, источники, глубину поиска и проверку сайта. Для одного запуска их можно изменить, не меняя профиль.
      {canEdit && isDefaultProfile && !action && ' Профиль по умолчанию нельзя удалить: сначала сделайте профилем по умолчанию другой.'}
    </p>
    {planProfileDeleted && <p className="pr-query-profile-note">
      Профиль, с которым запущена эта закупка, удалён. Она ищет прежними запросами; если сохранить настройки, перейдёт на выбранный здесь профиль.
    </p>}
    {(action === 'create' || action === 'rename') && <form className="pr-query-profile-form" onSubmit={submit}>
      <label className="pr-form-field">
        <span>{action === 'create' ? 'Название нового профиля' : 'Новое название профиля'}</span>
        <Input
          autoFocus
          value={name}
          maxLength={MAX_PROFILE_NAME_LENGTH + 20}
          onChange={event => { setName(event.target.value); setProblem(null) }}
        />
        {action === 'create' && <small>Запросы скопируются из профиля «{current?.name}», их можно будет изменить.</small>}
      </label>
      <Button type="submit" size="sm" isDisabled={busy}>{action === 'create' ? 'Создать' : 'Сохранить'}</Button>
      <Button variant="outline" size="sm" isDisabled={busy} onPress={close}>Отмена</Button>
    </form>}
    {action === 'delete' && <div className="pr-query-profile-form">
      <p className="pr-query-profile-note">
        Удалить профиль «{current?.name}» и его список запросов? Уже запущенные закупки продолжат искать своими запросами. Отменить удаление нельзя.
      </p>
      <Button variant="destructive" size="sm" isDisabled={busy} onPress={remove}>Удалить профиль</Button>
      <Button variant="outline" size="sm" isDisabled={busy} onPress={close}>Отмена</Button>
    </div>}
    {problem && <small className="pr-import-missing" role="alert">{problem}</small>}
    {settings.saveDefaultProfile.error && <small className="pr-import-missing" role="alert">Профиль по умолчанию не сохранён.</small>}
  </>
}
