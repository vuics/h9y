import { test } from 'node:test'
import assert from 'node:assert/strict'

import { emailBodyText } from './emailText.js'

test('the text part is used when it has words', () => {
  assert.equal(emailBodyText({ text: 'Price USD 900/MT', html: '<p>other</p>' }), 'Price USD 900/MT')
})

test('an email whose letter is only in HTML is read from the HTML', () => {
  const html = '<div>Dear Dmitrii,<br>Potassium Carbonate 99%</div>'
    + '<table><tr><td>Price</td><td>USD 900/MT FOB</td></tr></table>'
    + '<img src="cid:logo.png"><a href="https://dideu.com">our site</a>'
  const text = emailBodyText({ text: '\n  \n', html })
  assert.match(text, /Dear Dmitrii,\nPotassium Carbonate 99%/)
  assert.match(text, /Price\s+USD 900\/MT FOB/)
  assert.doesNotMatch(text, /logo\.png|https:\/\/dideu\.com/)
})

test('an email with neither part is empty', () => {
  assert.equal(emailBodyText({}), '')
  assert.equal(emailBodyText({ text: '', html: false }), '')
})
