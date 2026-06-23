import React, { useState, useEffect } from 'react'
import axios from 'axios'
import {
  Form,
  Container,
  Segment,
  Loader,
  Message,
  Header,
  Icon,
  Button,
  Table,
  Checkbox,
  Popup,
  Label,
  // Dropdown,
  // Divider,
} from 'semantic-ui-react'
import { useTranslation } from 'react-i18next'
// import { isEmpty } from 'lodash'

import Menubar from './components/Menubar'
import { sleep } from './helper'
import conf from './conf'


/**
 * Converts token balance string to human-readable decimal string
 * @param {string} balance - token balance as string
 * @param {number} decimals - number of decimals
 * @returns {string} - human-readable decimal string
 */
// function tokenToDecimal(balance, decimals = 18) {
function tokenToDecimal(balance, decimals) {
  if (!decimals) return balance;
  const bigBalance = BigInt(balance);
  const factor = 10n ** BigInt(decimals);
  const integerPart = bigBalance / factor;
  const fractionPart = (bigBalance % factor).toString().padStart(decimals, '0');
  // remove trailing zeros in fractional part
  const fractionTrimmed = fractionPart.replace(/0+$/, '');
  return fractionTrimmed ? `${integerPart}.${fractionTrimmed}` : `${integerPart}`;
}

/**
 * Converts human-readable decimal string to token balance string
 * @param {string} decimalStr - human-readable decimal string
 * @param {number} decimals - number of decimals
 * @returns {string} - token balance as string
 */
// function decimalToToken(decimalStr, decimals = 18) {
function decimalToToken(decimalStr, decimals) {
  if (!decimals) return decimalStr;
  const [integerPart, fractionPart = ''] = decimalStr.split('.');
  const fractionPadded = (fractionPart + '0'.repeat(decimals)).slice(0, decimals);
  const balance = BigInt(integerPart) * (10n ** BigInt(decimals)) + BigInt(fractionPadded);
  return balance.toString();
}

// // Example usage:
// const balanceStr = "1230166026255794176";
// const decimals = 18;
//
// const decimalString = tokenToDecimal(balanceStr, decimals);
// console.log(decimalString); // "1.230166026255794176"
//
// const backToBalance = decimalToToken(decimalString, decimals);
// console.log(backToBalance); // "1230166026255794176"



export default function Wallet () {
  const { t } = useTranslation('Wallet')
  const [ responseError, setResponseError ] = useState('')
  const [ loading, setLoading ] = useState(false)
  const [ account, setAccount ] = useState({})
  const [ approvals, setApprovals ] = useState([])
  const [ transferData, setTransferData ] = useState(null)
  const [ collectData, setCollectData ] = useState(null)
  const [ approvalData, setApprovalData ] = useState(null)
  const [ showInactive, setShowInactive ] = useState(false)
  const [ showApprovals, setShowApprovals ] = useState(false)
  const [ showTransfers, setShowTransfers ] = useState(false)
  const [ transfers, setTransfers ] = useState([])
  const [ showMint, setShowMint ] = useState(false)
  const [ showTransferTo, setShowTransferTo ] = useState(true)
  const [ showTransferFrom, setShowTransferFrom ] = useState(true)

  // console.log('approvalData:', approvalData)

  const getAccount = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${conf.api.url}/firefly/account`, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
      })
      // console.log('res:', res)
      console.log('res.data:', res.data)
      // setAddress(res.data.address)
      setAccount(res.data)
    } catch (err) {
      console.error('get account error:', err);
      return setResponseError(err?.response?.data?.message || t('Error getting account.'))
    } finally {
      setLoading(false)
    }
  }

  const getApprovals = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${conf.api.url}/firefly/approvals`, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
      })
      // console.log('res:', res)
      console.log('res.data:', res.data)
      setApprovals(res.data.approvals)
    } catch (err) {
      console.error('get approval error:', err);
      return setResponseError(err?.response?.data?.message || t('Error getting approvals.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    getAccount()
  }, [])

  useEffect(() => {
    getApprovals()
  }, [showApprovals])

  const listTransfers = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${conf.api.url}/firefly/transfer`, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
      })
      console.log('res:', res)
      setTransfers(res.data)
    } catch (err) {
      console.error('list transfers error:', err);
      return setResponseError(err?.response?.data?.message || t('Error listing transfers.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    listTransfers()
  }, [showTransfers])

  const transfer = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { pool, to, tokenIndex, amount, type, decimals } = transferData
      const res = await axios.post(`${conf.api.url}/firefly/transfer`, {
        pool, to, tokenIndex,
        amount: type === 'fungible' ? decimalToToken(amount, decimals) : amount,
      }, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
      })
      console.log('res:', res)
      setTransferData(null)
      await sleep(1000)
      await getAccount()
    } catch (err) {
      console.error('transfer error:', err);
      return setResponseError(err?.response?.data?.message || t('Error transferring tokens.'))
    } finally {
      setLoading(false)
    }
  }

  const collect = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { pool, from, amount, decimals, type, tokenIndex } = collectData
      const res = await axios.post(`${conf.api.url}/firefly/collect`, {
        pool,
        from,
        amount: type === 'fungible' ? decimalToToken(amount, decimals) : '1',
        tokenIndex,
      }, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
      })
      console.log('res:', res)
      setCollectData(null)
      await sleep(1000)
      await getAccount()
    } catch (err) {
      console.error('collect error:', err);
      return setResponseError(err?.response?.data?.message || t('Error collecting tokens.'))
    } finally {
      setLoading(false)
    }
  }

  const approve = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { pool, operator, allowance, approved, decimals } = approvalData
      console.log('approvalData:', approvalData)
      console.log('approved:', approved)
      const res = await axios.post(`${conf.api.url}/firefly/approvals`, {
        pool,
        operator,
        allowance: decimalToToken(allowance, decimals),
        approved,
      }, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
      })
      console.log('res:', res)
      setApprovalData(null)
      await sleep(1000)
      await getApprovals()
    } catch (err) {
      console.error('approval error:', err);
      return setResponseError(err?.response?.data?.message || t('Error approving.'))
    } finally {
      setLoading(false)
    }
  }


  return (<>
    <Container fluid>
      <Menubar />
    </Container>

    <Container style={{ marginTop: '1rem' }}>

      <Loader active={loading} inline='centered' />
      { responseError &&
        <Message
          negative
          style={{ textAlign: 'left'}}
          icon='exclamation circle'
          header={t('error')}
          content={responseError}
          onDismiss={() => setResponseError('')}
        />
      }

      <Segment secondary>
        <Header as='h3'>
          {t('Wallet')}
        </Header>

        <Form>
          <Segment stacked>
            <div>
              <b>{t('Address')}:</b>
              {' '}
              {account?.address}
            </div>
            <br/>

            <b>{t('Balance')}:</b>

            <Table unstackable>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>{t('Type')}</Table.HeaderCell>
                  <Table.HeaderCell>{t('Symbol')}</Table.HeaderCell>
                  <Table.HeaderCell>{t('Amount')}</Table.HeaderCell>
                  <Table.HeaderCell>{t('Token Index')}</Table.HeaderCell>
                  <Table.HeaderCell>{t('URI')}</Table.HeaderCell>
                  <Table.HeaderCell textAlign='right'>{t('Actions')}</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {account?.balances?.map(b => {
                  const { pool, balance, tokenIndex, uri } = b
                  const foundPool = account?.pools?.find(p => p.id === pool)
                  const { symbol, decimals, type } = foundPool
                  const amount = decimals ? tokenToDecimal(balance, decimals) : balance

                  return (
                    <Table.Row key={`${pool}:${tokenIndex}`}>
                      <Table.Cell width='1'>
                        <Popup
                          content={type === 'fungible' ? t('fungible') : t('nonfungible')}
                          trigger={
                            <Icon name={type === 'fungible' ? 'cubes' : 'cube'} />
                          } 
                        />
                      </Table.Cell>
                      <Table.Cell>
                        {symbol}
                      </Table.Cell>
                      <Table.Cell>
                        {amount}
                      </Table.Cell>
                      <Table.Cell>
                        {tokenIndex}
                      </Table.Cell>
                      <Table.Cell>
                        {uri}
                      </Table.Cell>
                      <Table.Cell textAlign='right'>
                        <Button
                          compact
                          icon
                          onClick={() => setTransferData({
                            pool,
                            symbol,
                            type,
                            to: '',
                            amount: type === 'fungible' ? '' : balance,
                            max: amount,
                            tokenIndex: tokenIndex || '',
                            decimals,
                          })}
                        >
                          <Icon name='send' />
                          {t('Transfer')}
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  )
                })}
              </Table.Body>
            </Table>
          </Segment>
        </Form>
        <br/>

        { transferData && (
          <Segment>
            <Header as='h3'>
              {t('Transfer Tokens')}
            </Header>
            <Form>
              <Form.Group>
                <Form.Input
                  width='2'
                  placeholder={t('Pool')}
                  name='pool'
                  value={transferData.symbol}
                  onChange={(e, { name, value }) => setTransferData(d => ({ ...d, [name]: value }))}
                  readOnly
                />
                <Form.Input
                  width='8'
                  fluid
                  placeholder={t('Amount')}
                  name='amount'
                  value={transferData.amount}
                  onChange={(e, { name, value }) => setTransferData(d => ({ ...d, [name]: value }))}
                  disabled={transferData.type !== 'fungible'}
                />
                <Form.Button
                  width='2'
                  fluid
                  type="button"
                  onClick={() => setTransferData(d => ({ ...d, amount: d.max }))}
                  disabled={transferData.type !== 'fungible'}
                >
                  {t('Max')}
                </Form.Button>
                <Form.Input
                  width='6'
                  fluid
                  placeholder={t('Token Index')}
                  name='tokenIndex'
                  value={transferData.tokenIndex}
                  disabled={transferData.type !== 'nonfungible'}
                  readOnly
                />
              </Form.Group>
              <Form.Input
                placeholder={t('To recipient address')}
                name='to'
                value={transferData.to}
                onChange={(e, { name, value }) => setTransferData(d => ({ ...d, [name]: value }))}
              />
              <Button.Group>
                <Button type='button' positive icon
                 onClick={transfer}
                >
                  <Icon name='send' />
                  {t('Submit')}
                </Button>
                <Button.Or/>
                <Button type='button' negative icon
                  onClick={() => setTransferData(null)}
                >
                  <Icon name='cancel' />
                  {t('Cancel')}
                </Button>
              </Button.Group>
            </Form>
          </Segment>
        )}

        <Button icon
          onClick={() => setCollectData(collectData ? null : { from: '', amount: '' })}
        >
          <Icon name={ collectData ? 'caret down' : 'caret right' } />
          {t('Collect Tokens')}
        </Button>

        { collectData && (
          <Segment>
            <Header as='h3'>
              {t('Collect Tokens')}
            </Header>
            <Form>
              <Form.Dropdown
                fluid
                selection
                placeholder={t('Pool')}
                name='pool'
                value={collectData.pool}
                options={ account?.pools?.map(p => ({ key: p.id, text: p.symbol, value: p.id })) }
                onChange={(e, { name, value }) => {
                  const foundPool = account?.pools?.find(p => p.id === value)
                  const { decimals, type } = foundPool
                  setCollectData(d => ({ ...d, [name]: value, decimals, type }))
                }}
              />
              <Form.Input
                fluid
                placeholder={t('Amount')}
                name='amount'
                value={collectData.amount}
                onChange={(e, { name, value }) => setCollectData(d => ({ ...d, [name]: value }))}
                disabled={collectData.type !== 'fungible'}
              />
              <Form.Input
                placeholder={t('From address')}
                name='from'
                value={collectData.from}
                onChange={(e, { name, value }) => setCollectData(d => ({ ...d, [name]: value }))}
              />
              <Form.Input
                fluid
                placeholder={t('Token Index')}
                name='tokenIndex'
                value={collectData.tokenIndex}
                onChange={(e, { name, value }) => setCollectData(d => ({ ...d, [name]: value }))}
                disabled={collectData.type !== 'nonfungible'}
              />
              <Button.Group>
                <Button type='button' positive icon
                 onClick={collect}
                >
                  <Icon name='send' />
                  {t('Submit')}
                </Button>
                <Button.Or/>
                <Button type='button' negative icon
                  onClick={() => setCollectData(null)}
                >
                  <Icon name='cancel' />
                  {t('Cancel')}
                </Button>
              </Button.Group>
            </Form>
          </Segment>
        )}

        <Button icon
          onClick={() => setShowApprovals(!showApprovals)}
        >
          <Icon name={ showApprovals ? 'caret down' : 'caret right' } />
          {t('Show approvals')}
        </Button>

        { showApprovals && (
          <Segment>
            <Header as='h3'>
              {t('Approvals to Collect from Your Wallet')}
            </Header>

            <Button icon
              onClick={() => setApprovalData(approvalData ? null : { allowance: '0', approved: false })}
            >
              {t('Add Approval')}
            </Button>

            { approvalData && (
              <Segment>
                <Header as='h3'>
                  {t('Add Approval')}
                </Header>
                <Form>
                  <Form.Input
                    placeholder={t('Operator Address')}
                    name='operator'
                    value={approvalData.operator}
                    onChange={(e, { name, value }) => setApprovalData(d => ({ ...d, [name]: value }))}
                  />

                  <Form.Dropdown
                    fluid
                    selection
                    placeholder={t('Pool')}
                    name='pool'
                    value={approvalData.pool}
                    options={ account?.pools?.map(p => ({ key: p.id, text: p.symbol, value: p.id })) }
                    onChange={(e, { name, value }) => {
                      const foundPool = account?.pools?.find(p => p.id === value)
                      const { decimals, type } = foundPool
                      setApprovalData(d => ({ ...d, [name]: value, decimals, type }))
                    }}
                  />

                  <Form.Input
                    fluid
                    placeholder={t('Allowance')}
                    name='allowance'
                    value={approvalData.allowance}
                    onChange={(e, { name, value }) => setApprovalData(d => ({ ...d, [name]: value }))}
                  />

                  <Form.Checkbox
                    label={t('Approved')}
                    onChange={(e, { checked }) => setApprovalData(d => ({ ...d, approved: checked }))}
                    checked={approvalData.approved}
                  />

                  <Button.Group>
                    <Button type='button' positive icon
                     onClick={approve}
                    >
                      <Icon name='send' />
                      {t('Submit')}
                    </Button>
                    <Button.Or/>
                    <Button type='button' negative icon
                      onClick={() => setApprovalData(null)}
                    >
                      <Icon name='cancel' />
                      {t('Cancel')}
                    </Button>
                  </Button.Group>
                </Form>
              </Segment>
            )}
            {' '}
            <Checkbox
              label={t('Show inactive approvals')}
              onChange={(e, data) => setShowInactive(data.checked)}
              checked={showInactive}
            />

            <Table celled padded>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>{t('Operator')}</Table.HeaderCell>
                  <Table.HeaderCell>{t('Symbol')}</Table.HeaderCell>
                  <Table.HeaderCell>{t('Active')}</Table.HeaderCell>
                  <Table.HeaderCell>{t('Approved')}</Table.HeaderCell>
                  <Table.HeaderCell>{t('Allowance')}</Table.HeaderCell>
                  <Table.HeaderCell>{t('Created')}</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>

              { approvals?.map(approval => {
                if (!showInactive && !approval.active) { return; }
                const foundPool = account?.pools?.find(p => p.id === approval.pool)
                const { symbol, decimals } = foundPool

                return (
                  <Table.Row key={approval.localId}>
                    <Table.Cell>
                      {approval.operator}
                    </Table.Cell>
                    <Table.Cell>
                      {symbol}
                    </Table.Cell>
                    <Table.Cell>
                      {approval.active ? t('Yes') : t('No')}
                    </Table.Cell>
                    <Table.Cell>
                      {approval.approved ? t('Yes') : t('No')}
                    </Table.Cell>
                    <Table.Cell>
                      {approval.info.value && tokenToDecimal(approval.info.value, decimals)}
                    </Table.Cell>
                    <Table.Cell>
                      {approval.created}
                    </Table.Cell>
                  </Table.Row>
                )
              })}
              </Table.Body>
            </Table>
          </Segment>
        )}

        <Button icon
          onClick={() => setShowTransfers(!showTransfers)}
        >
          <Icon name={ showTransfers ? 'caret down' : 'caret right' } />
          {t('List transfers')}
        </Button>
      </Segment>
    </Container>


    { showTransfers && (<>
      <br/>
      <Container fluid>
        <Segment>
          <Header as='h3'>
            {t('Your Wallet Transfers')}
          </Header>

          <Checkbox
            label={t('Mint')}
            onChange={(e, data) => setShowMint(data.checked)}
            checked={showMint}
          />
          {' '}
          <Checkbox
            label={t('Transfers from your wallet')}
            onChange={(e, data) => setShowTransferFrom(data.checked)}
            checked={showTransferFrom}
          />
          {' '}
          <Checkbox
            label={t('Transfers to your wallet')}
            onChange={(e, data) => setShowTransferTo(data.checked)}
            checked={showTransferTo}
          />

          <Table celled padded>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>{t('Local ID')}</Table.HeaderCell>
                <Table.HeaderCell>{t('Type')}</Table.HeaderCell>
                <Table.HeaderCell>{t('From ➔ To (key is bold)')}</Table.HeaderCell>
                <Table.HeaderCell>{t('Symbol')}</Table.HeaderCell>
                <Table.HeaderCell>{t('Amount')}</Table.HeaderCell>
                <Table.HeaderCell>{t('Token Index')}</Table.HeaderCell>
                <Table.HeaderCell>{t('URI')}</Table.HeaderCell>
                <Table.HeaderCell>{t('Date & Time')}</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>

            { transfers?.map(transfer => {
              if (!showMint && transfer.type === 'mint') { return; }
              if (!showTransferFrom && transfer.type === 'transfer' && transfer.from === account?.address) { return; }
              if (!showTransferTo && transfer.type === 'transfer' && transfer.to === account?.address) { return; }

              const foundPool = account?.pools?.find(p => p.id === transfer.pool)
              const { symbol, decimals, type } = foundPool

              return (
                <Table.Row key={transfer.localId}>
                  <Table.Cell>
                    {transfer.localId}
                  </Table.Cell>
                  <Table.Cell>
                    {transfer.type}
                  </Table.Cell>
                  <Table.Cell>
                    <span style={{ fontWeight: transfer.from === transfer.key ? 'bold' : 'normal' }}>
                      {transfer.from}
                    </span>
                    {' ➔ '}
                    <span style={{ fontWeight: transfer.to === transfer.key ? 'bold' : 'normal' }}>
                      {transfer.to}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <Label>
                      {symbol}
                    </Label>
                  </Table.Cell>
                  <Table.Cell>
                    {type === 'fungible' ? tokenToDecimal(transfer.amount, decimals) : transfer.amount}
                  </Table.Cell>
                  <Table.Cell>
                    {transfer.tokenIndex}
                  </Table.Cell>
                  <Table.Cell>
                    {transfer.uri}
                  </Table.Cell>
                  <Table.Cell>
                    {transfer.created}
                  </Table.Cell>
                </Table.Row>
              )
            })}
            </Table.Body>
          </Table>
        </Segment>
      </Container>
    </>)}
  </>)
}
