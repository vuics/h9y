import React, { useState } from 'react'
import { useMutation } from '@tanstack/react-query'

import { procurementApi } from '../api/client'
import { importFilePayload, validateImportFile } from '../api/imports'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { AlertTriangle, CircleAlert, FileCheck } from './icons'

const mutationMessage = error =>
  error?.response?.data?.message || error?.message || 'Не удалось выполнить операцию.'

export function UploadPanel({ onUploaded, canWrite }) {
  const [file, setFile] = useState(null)
  const validation = file ? validateImportFile(file) : null
  const upload = useMutation({
    mutationFn: async () => procurementApi.createCardImport(await importFilePayload(file)),
    onSuccess: onUploaded,
  })

  if (!canWrite) {
    return (
      <Alert>
        <AlertTriangle />
        <AlertTitle>Недостаточно прав</AlertTitle>
        <AlertDescription>Для массового импорта требуется CARD_WRITE.</AlertDescription>
      </Alert>
    )
  }

  return (
    <Card>
      <CardHeader><CardTitle>Файл со списком веществ</CardTitle></CardHeader>
      <CardContent>
        <form
          className="pr-card-form"
          onSubmit={event => { event.preventDefault(); if (!validation && file) upload.mutate() }}
        >
          <label className="pr-form-field pr-form-field--wide">
            <span>Excel, CSV, Word, PDF или изображение таблицы</span>
            <Input
              type="file"
              accept=".xlsx,.xls,.csv,.tsv,.md,.txt,.docx,.doc,.pdf,.png,.jpg,.jpeg,.webp"
              onChange={event => { setFile(event.target.files?.[0] || null); upload.reset() }}
            />
            <small>
              До 15 МБ. Структуру таблицы система определит сама — заголовки могут быть
              на русском или английском, лишние столбцы допустимы.
            </small>
          </label>

          {file && (
            <div className="pr-upload-list pr-form-field--wide">
              <div>
                <strong>{file.name}</strong>
                <span>{(file.size / 1024).toFixed(1)} КБ</span>
              </div>
            </div>
          )}
          {validation && <p className="pr-form-error pr-form-field--wide">{validation}</p>}
          {upload.isError && (
            <Alert className="pr-form-field--wide">
              <CircleAlert />
              <AlertTitle>Файл не принят</AlertTitle>
              <AlertDescription>{mutationMessage(upload.error)}</AlertDescription>
            </Alert>
          )}

          <div className="pr-form-actions">
            <Button type="submit" isDisabled={!file || Boolean(validation) || upload.isPending}>
              <FileCheck />
              {upload.isPending ? 'Загружаем и распознаём…' : 'Разобрать файл'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
