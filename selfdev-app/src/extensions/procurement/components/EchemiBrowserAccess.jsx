import React, { useState } from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button, LinkButton } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, Check, Copy, ExternalLink } from './icons'

/** The shared noVNC session: where to watch, and what it takes to get in.
 *
 * `compact` drops the card around it so the same link and the same password —
 * one implementation, not two — can sit inside a block that already has its
 * own heading, such as a campaign's marketplace requests.
 */
export function EchemiBrowserAccess({ access, error, loading, compact = false }) {
  const [copied, setCopied] = useState(false)

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(access.password)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const body = <>
      {loading && <p className="pr-note">Получаем параметры доступа…</p>}
      {/* Asked of the process that owns the browser, so it is the truth about
          this deployment rather than about the API's environment. Shown before
          anything is started: without it the only way to learn the browser
          cannot sign in was to run something and read the failure two minutes
          later. */}
      {access?.accountConfigured === false && <Alert>
        <AlertTriangle />
        <AlertTitle>У браузера нет учётной записи Echemi</AlertTitle>
        <AlertDescription>
          Форму заявки заполнить не получится: площадка потребует вход, и агент остановится на странице логина.
          Задайте агенту опции Procurement → Echemi Account (ключи Vault ECHEMI_ACCOUNT_EMAIL и ECHEMI_ACCOUNT_PASSWORD)
          и перезапустите его — учётная запись читается один раз при старте.
        </AlertDescription>
      </Alert>}
      {error && <Alert><AlertTriangle /><AlertTitle>Параметры доступа недоступны</AlertTitle><AlertDescription>{error.response?.data?.message || error.message}</AlertDescription></Alert>}
      {access && <div className="pr-echemi-browser-access__content">
        <div>
          <p className="pr-note">Откройте noVNC в новой вкладке, чтобы видеть, что агент делает в браузере прямо сейчас. Это общий пароль MVP; не пересылайте его пользователям без разрешения ECHEMI_OPERATE.</p>
          {access.passwordRequired
            ? <div className="pr-echemi-password"><span>Пароль x11vnc</span><code>{access.password}</code><Button variant="outline" onPress={copyPassword}>{copied ? <Check /> : <Copy />}{copied ? 'Скопировано' : 'Копировать'}</Button></div>
            : <Badge variant="outline">Пароль не требуется</Badge>}
        </div>
        <LinkButton href={access.url} target="_blank" rel="noreferrer"><ExternalLink />Открыть браузер Echemi</LinkButton>
      </div>}
  </>

  if (compact) return <div className="pr-echemi-browser-access is-compact">{body}</div>

  return <Card className="pr-echemi-browser-access">
    <CardHeader><div><CardTitle>Ручной браузер Echemi</CardTitle><span>Общая noVNC-сессия для проверки страницы и формы</span></div></CardHeader>
    <CardContent>{body}</CardContent>
  </Card>
}
