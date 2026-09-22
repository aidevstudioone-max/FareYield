import React, { useState } from 'react'
import { Badge, Button, Card, Field, PageHeader, Select, Slider, Toast } from '../components/ui'
import { COLLECTIONS, save } from '../lib/db'
import { DEFAULT_PRICING_CONFIG } from '../lib/pricingEngine'
import { getConfig } from '../lib/selectors'
import type { PricingConfig } from '../lib/types'

const MODE_INFO: Record<PricingConfig['algorithmMode'], string> = {
  RULE_BASED: 'Deterministic multipliers only — fully explainable, no weighting model.',
  ML_BLEND: 'Weighted ensemble of demand signals, mapped through an elasticity curve.',
  HYBRID: 'ML blend for near-term trips, rule-based floor/ceiling for far-out ones.'
}

export default function PricingRules() {
  const [config, setConfig] = useState<PricingConfig>(getConfig())
  const [toast, setToast] = useState('')

  function setWeight(key: keyof PricingConfig['weights'], v: number) {
    setConfig({ ...config, weights: { ...config.weights, [key]: v } })
  }

  function handleSave() {
    save(COLLECTIONS.pricingConfig, config)
    setToast('Pricing rules saved — new recommendations use these settings immediately.')
  }

  function handleReset() {
    setConfig(DEFAULT_PRICING_CONFIG)
    save(COLLECTIONS.pricingConfig, DEFAULT_PRICING_CONFIG)
    setToast('Reset to recommended defaults.')
  }

  return (
    <div>
      <PageHeader title="Pricing rules" subtitle="Configure how aggressively the engine reacts to demand, and how much weight each signal carries." />

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <h3 className="font-semibold text-slate-800 mb-3">Algorithm</h3>
          <Field label="Mode" hint={MODE_INFO[config.algorithmMode]}>
            <Select value={config.algorithmMode} onChange={(v) => setConfig({ ...config, algorithmMode: v as PricingConfig['algorithmMode'] })}>
              <option value="RULE_BASED">Rule-based</option>
              <option value="ML_BLEND">ML blend (recommended)</option>
              <option value="HYBRID">Hybrid</option>
            </Select>
          </Field>
          <Field label="Elasticity" hint="How aggressively the price reacts to the demand score.">
            <Slider value={config.elasticity} min={0.5} max={3} step={0.1} onChange={(v) => setConfig({ ...config, elasticity: v })} format={(n) => `${n.toFixed(1)}×`} />
          </Field>
          <Field label="Price floor" hint="Never price below this share of the base fare.">
            <Slider value={config.floorMultiplier} min={0.5} max={1} step={0.05} onChange={(v) => setConfig({ ...config, floorMultiplier: v })} format={(n) => `${Math.round(n * 100)}%`} />
          </Field>
          <Field label="Price ceiling" hint="Never price above this share of the base fare.">
            <Slider value={config.ceilingMultiplier} min={1} max={3} step={0.05} onChange={(v) => setConfig({ ...config, ceilingMultiplier: v })} format={(n) => `${Math.round(n * 100)}%`} />
          </Field>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold text-slate-800 mb-1">Signal weights</h3>
          <p className="text-xs text-slate-400 mb-3">Relative weight of each demand signal — they're normalized automatically, so they don't need to sum to 1.</p>
          {(Object.keys(config.weights) as (keyof PricingConfig['weights'])[]).map((key) => (
            <Field key={key} label={key.charAt(0).toUpperCase() + key.slice(1)}>
              <Slider value={config.weights[key]} min={0} max={1} step={0.02} onChange={(v) => setWeight(key, v)} format={(n) => n.toFixed(2)} />
            </Field>
          ))}
          <div className="flex items-center gap-2 mt-2">
            <Badge tone="indigo">Effective mode: {config.algorithmMode.replace(/_/g, ' ')}</Badge>
          </div>
        </Card>
      </div>

      <div className="flex gap-2 mt-4">
        <Button onClick={handleSave}>Save pricing rules</Button>
        <Button variant="secondary" onClick={handleReset}>
          Reset to defaults
        </Button>
      </div>

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  )
}
