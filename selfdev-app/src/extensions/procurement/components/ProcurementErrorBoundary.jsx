import React from 'react'
import { AlertTriangle } from './icons'
import { Button } from './ui/button'

export class ProcurementErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Procurement extension rendering failed', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    return <main className="procurement-shell pr-boundary"><AlertTriangle size={32} /><h1>Procurement временно недоступен</h1><p>Ошибка изолирована внутри рабочего пространства. Остальные разделы приложения продолжают работать.</p><Button onClick={() => { this.setState({ error: null }); window.location.assign('/procurement') }}>Перезагрузить Procurement</Button></main>
  }
}
