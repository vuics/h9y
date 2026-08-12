import React, { useState } from 'react'

import { DefinitionGrid } from './DetailLayout'
import { StatusBadge } from './StatusBadge'
import { ExternalLink } from './icons'

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

export function PubChemResult({ normalization }) {
  const [showAllSynonyms, setShowAllSynonyms] = useState(false)
  const synonyms = normalization.synonyms || []
  const visible = showAllSynonyms ? synonyms : synonyms.slice(0, SYNONYM_PREVIEW)

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
        { label: 'Формула', value: normalization.molecularFormula },
        { label: 'Молекулярная масса', value: normalization.molecularWeight },
        { label: 'Точная масса', value: normalization.exactMass },
        { label: 'Заряд', value: normalization.charge ?? null },
        { label: 'CAS подтверждён', value: matchBadge(normalization.casMatchesPubchem) },
        { label: 'Название подтверждено', value: matchBadge(normalization.nameMatchesPubchem) },
        { label: 'Как найдено', value: resolvedByLabel[normalization.resolvedBy] || normalization.resolvedBy },
      ]} />

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
          {normalization.reviewReasons.map(reason => <li key={reason}>{reason}</li>)}
        </ul>
      )}

      <p className="pr-note">Источник: {normalization.source}</p>
    </div>
  )
}
