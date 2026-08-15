import React from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SelectField } from './SelectField'
import { AlertTriangle, FileCheck } from './icons'

/** The irreversible step: turn selected rows into procurement cards.
 *
 * The draft count is stated separately because a draft cannot be sent to a
 * supplier — the specialist should know how much follow-up work they are
 * creating before confirming.
 */
export function ImportConfirmPanel({
  duplicatePolicy,
  onDuplicatePolicyChange,
  selectedCount,
  draftCount,
  isPending,
  onConfirm,
}) {
  return (
    <Card>
      <CardHeader><CardTitle>Создание карточек</CardTitle></CardHeader>
      <CardContent>
        <div className="pr-card-form">
          <SelectField
            label="Если вещество уже есть в карточке"
            selectedKey={duplicatePolicy}
            onSelectionChange={onDuplicatePolicyChange}
            hint={(
              <small>
                Совпадение определяется по каноническому CAS-номеру, а при его
                отсутствии — по нормализованному наименованию.
              </small>
            )}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem id="SKIP">Пропустить существующие</SelectItem>
              <SelectItem id="CREATE">Создать карточку всё равно</SelectItem>
            </SelectContent>
          </SelectField>

          <Alert className="pr-form-field--wide">
            <AlertTriangle />
            <AlertTitle>Это необратимый шаг</AlertTitle>
            <AlertDescription>
              Будет создано карточек: {selectedCount}, из них черновиков:{' '}
              {draftCount}. Черновик нельзя отправить поставщику: RFQ станет доступен
              после заполнения обязательных полей.
            </AlertDescription>
          </Alert>

          <div className="pr-form-actions">
            <Button isDisabled={isPending || selectedCount === 0} onPress={onConfirm}>
              <FileCheck />
              {isPending ? 'Создаём карточки…' : `Создать ${selectedCount} карточек`}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
