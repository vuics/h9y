import React, { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { DefinitionGrid } from './DetailLayout'
import { StatusBadge } from './StatusBadge'
import { Check, ExternalLink } from './icons'

const SYNONYM_PREVIEW = 8

const matchBadge = value => value === true
  ? <StatusBadge status="MATCHED" compact />
  : value === false
    ? <StatusBadge status="MISMATCH" compact />
    : <StatusBadge status="UNKNOWN" compact />

const resolvedByLabel = {
  cas_number: 'Найдено по CAS-номеру',
  substance_name: 'Найдено по названию',
}

/** The PubChem record, and the one way past it.
 *
 * PubChem is evidence, not the register. A technical grade, a polymer or a
 * supplier's trade name can be a real, correctly numbered substance that no
 * public record spells the way the customer does — and until confirmation
 * existed such a card was blocked for good, because the only route out of
 * "нужна проверка" was to edit the CAS or the name into something PubChem
 * recognised, which is to say into a different substance.
 *
 * So the objection is waived on a named person's word and stays on screen
 * afterwards: what was overruled, by whom and why. A card that simply went
 * green would be claiming PubChem agreed.
 */
export function PubChemResult({ normalization, override, canConfirm, onConfirm, isConfirming }) {
  const [showAllSynonyms, setShowAllSynonyms] = useState(false)
  const [reason, setReason] = useState('')
  const synonyms = normalization.synonyms || []
  const visible = showAllSynonyms ? synonyms : synonyms.slice(0, SYNONYM_PREVIEW)
  const isSubstance = normalization.recordType === 'SUBSTANCE'

  return (
    <div className="pr-normalization">
      <h3>
        Результат PubChem
        {normalization.sourceUrl && (
          <a href={normalization.sourceUrl} target="_blank" rel="noreferrer">
            <ExternalLink size={13} />Открыть в PubChem
          </a>
        )}
      </h3>

      <DefinitionGrid items={[
        { label: 'Preferred name', value: normalization.preferredName },
        { label: 'IUPAC', value: normalization.iupacName },
        { label: 'PubChem CID', value: normalization.cid },
        { label: 'PubChem SID', value: normalization.sid },
        { label: 'Формула', value: normalization.molecularFormula },
        { label: 'Молекулярная масса', value: normalization.molecularWeight },
        { label: 'Точная масса', value: normalization.exactMass },
        { label: 'Заряд', value: normalization.charge ?? null },
        { label: 'CAS подтверждён', value: matchBadge(normalization.casMatchesPubchem) },
        { label: 'Название подтверждено', value: matchBadge(normalization.nameMatchesPubchem) },
        { label: 'Как найдено', value: resolvedByLabel[normalization.resolvedBy] || normalization.resolvedBy },
      ]} />

      {isSubstance && (
        <p className="pr-note">
          Вещество переменного состава: в PubChem у него нет записи Compound, только
          депонированные записи Substance
          {normalization.sids?.length > 1 && ` (учтено записей: ${normalization.sids.length})`}.
          Формула, молекулярная масса и структурные идентификаторы относятся к
          определённой структуре и для такой записи не приводятся.
        </p>
      )}

      {(normalization.inchiKey || normalization.canonicalSmiles || normalization.inchi) && (
        <dl className="pr-structure-ids">
          {normalization.inchiKey && <><dt>InChIKey</dt><dd><code>{normalization.inchiKey}</code></dd></>}
          {normalization.canonicalSmiles && <><dt>SMILES</dt><dd><code>{normalization.canonicalSmiles}</code></dd></>}
          {normalization.inchi && <><dt>InChI</dt><dd><code>{normalization.inchi}</code></dd></>}
        </dl>
      )}

      {synonyms.length > 0 && (
        <div className="pr-synonyms">
          <h4>Синонимы <span>{synonyms.length}</span></h4>
          <ul>{visible.map(item => <li key={item}>{item}</li>)}</ul>
          {synonyms.length > SYNONYM_PREVIEW && (
            <button type="button" onClick={() => setShowAllSynonyms(value => !value)}>
              {showAllSynonyms ? 'Свернуть' : `Показать все ${synonyms.length}`}
            </button>
          )}
          <p className="pr-note">
            Синонимы помогают опознать вещество, когда поставщик называет его иначе.
          </p>
        </div>
      )}

      {normalization.reviewReasons?.length > 0 && (
        <ul className="pr-normalization__reasons">
          {normalization.reviewReasons.map(item => <li key={item}>{item}</li>)}
        </ul>
      )}

      {override
        ? <div className="pr-normalization__override">
          <strong><Check size={13} />Подтверждено вручную</strong>
          <p>{override.reason}</p>
          {override.waivedReasons?.length > 0 && <ul className="pr-normalization__reasons">
            {override.waivedReasons.map(item => <li key={item}>{item}</li>)}
          </ul>}
          <p className="pr-note">
            Подтвердил {override.confirmedBy || 'специалист'}
            {override.confirmedAt && ` · ${new Date(override.confirmedAt).toLocaleString('ru-RU')}`}.
            Изменение CAS-номера, наименования или повторная сверка снимут подтверждение.
          </p>
        </div>
        : canConfirm && normalization.reviewReasons?.length > 0 && <div className="pr-normalization__confirm">
          <p className="pr-note">
            Если это техническая марка, полимер или торговое наименование — PubChem
            может не подтвердить его никогда. Подтвердите вещество под свою
            ответственность, и карточка пойдёт дальше.
          </p>
          <Textarea
            value={reason}
            aria-label="Основание для подтверждения"
            placeholder="На чём основано: спецификация поставщика, CoA, реестр…"
            onChange={event => setReason(event.target.value)}
          />
          <Button
            variant="outline"
            isDisabled={reason.trim().length < 3 || isConfirming}
            onPress={() => onConfirm(reason.trim())}
          >
            <Check />{isConfirming ? 'Подтверждаем…' : 'Подтвердить под свою ответственность'}
          </Button>
        </div>}

      <p className="pr-note">Источник: {normalization.source}</p>
    </div>
  )
}
