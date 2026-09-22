import React, { useState } from 'react'
import { Button, Card, Field, inputCls, PageHeader, Toast } from '../components/ui'
import { COLLECTIONS, load, resetAll, save } from '../lib/db'
import { seedAll } from '../lib/seed'

interface AppSettings {
  companyName: string
  currency: string
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(load(COLLECTIONS.settings, { companyName: 'FareYield Transit Ops', currency: 'INR' }))
  const [toast, setToast] = useState('')

  function handleSave() {
    save(COLLECTIONS.settings, settings)
    setToast('Settings saved.')
  }

  function handleReset() {
    resetAll(seedAll)
    window.location.reload()
  }

  return (
    <div>
      <PageHeader title="Settings" subtitle="Branding for this demo workspace, and demo-data controls." />

      <Card className="p-4 max-w-lg mb-4">
        <h3 className="font-semibold text-slate-800 mb-3">Workspace</h3>
        <Field label="Operator name">
          <input className={inputCls} value={settings.companyName} onChange={(e) => setSettings({ ...settings, companyName: e.target.value })} />
        </Field>
        <Field label="Currency">
          <input className={inputCls} value={settings.currency} disabled />
        </Field>
        <Button onClick={handleSave}>Save</Button>
      </Card>

      <Card className="p-4 max-w-lg">
        <h3 className="font-semibold text-slate-800 mb-1">Demo data</h3>
        <p className="text-sm text-slate-500 mb-3">
          Regenerate every route, trip, price history and revenue record from scratch. Any manual price overrides or saved
          pricing rules will be lost.
        </p>
        <Button variant="danger" onClick={handleReset}>
          Reset demo data
        </Button>
      </Card>

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  )
}
