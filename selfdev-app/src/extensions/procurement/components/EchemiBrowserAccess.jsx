import React, { useState } from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, Check, Copy, ExternalLink } from './icons'

export function EchemiBrowserAccess({ access, error, loading }) {
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

  return <Card className="pr-echemi-browser-access">
    <CardHeader><div><CardTitle>Ручной браузер Echemi</CardTitle><span>Общая noVNC-сессия для проверки страницы и формы</span></div></CardHeader>
    <CardContent>
      {loading && <p className="pr-note">Получаем параметры доступа…</p>}
      {error && <Alert><AlertTriangle /><AlertTitle>Параметры доступа недоступны</AlertTitle><AlertDescription>{error.response?.data?.message || error.message}</AlertDescription></Alert>}
      {access && <div className="pr-echemi-browser-access__content">
        <div>
          <p className="pr-note">Откройте noVNC в новой вкладке. Это общий пароль MVP; не пересылайте его пользователям без разрешения ECHEMI_OPERATE.</p>
          {access.passwordRequired
            ? <div className="pr-echemi-password"><span>Пароль x11vnc</span><code>{access.password}</code><Button variant="outline" onPress={copyPassword}>{copied ? <Check /> : <Copy />}{copied ? 'Скопировано' : 'Копировать'}</Button></div>
            : <Badge variant="outline">Пароль не требуется</Badge>}
        </div>
        <a className="pr-echemi-browser-link" href={access.url} target="_blank" rel="noreferrer"><ExternalLink />Открыть браузер Echemi</a>
      </div>}
    </CardContent>
  </Card>
}
