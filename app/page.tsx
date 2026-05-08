'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase, getUserName, USERS, type Message, type Operation, type Insight } from '@/lib/supabase'
import { Sprout, CheckCircle, XCircle, RefreshCw, Send, ChevronDown, ChevronUp, Pencil, X } from 'lucide-react'

type Tab = 'conversations' | 'knowledge' | 'concepts' | 'insights' | 'gantt'

type Concept = {
  id: number; category: string; topic: string; content: string
  variety: string | null; valid_from: string | null; approved: boolean
  superseded_by: number | null; source: string | null; created_at: string; message_id: number | null
}

type Plot = { id: number; name: string; area_dunam: number; variety: string }

type EditData = {
  operation_type: string; season_year: string; date_start: string; date_end: string
  timing_desc: string; plot_ids: string; variety: string; executor: string
  notes: string; cost_total: string; cost_per_dunam: string
}

const BLANK_EDIT: EditData = {
  operation_type: '', season_year: '', date_start: '', date_end: '',
  timing_desc: '', plot_ids: '', variety: '', executor: '',
  notes: '', cost_total: '', cost_per_dunam: '',
}

const OP_TYPES = ['ריסוס', 'דישון', 'השקיה', 'גיזום', 'קטיף', 'דילול', 'חיגור', 'טיפול_קרקע', 'בדיקה', 'ייעוץ', 'אחר']

const CAT_COLOR: Record<string, string> = {
  'השקיה': '#06b6d4', 'גיזום': '#f59e0b', 'ריסוס': '#ea580c',
  'דישון': '#0ea5e9', 'קטיף': '#16a34a', 'אחר': '#6b7280',
}

const OP_COLOR: Record<string, string> = {
  'קטיף': '#16a34a', 'דילול': '#7c3aed', 'ריסוס': '#ea580c',
  'דישון': '#0ea5e9', 'השקיה': '#06b6d4', 'גיזום': '#f59e0b',
  'חיגור': '#e11d48', 'טיפול_קרקע': '#78716c', 'בדיקה': '#64748b',
  'ייעוץ': '#8b5cf6', 'אחר': '#6b7280',
}

// Consistent color for any free-text type not in OP_COLOR
function opColor(type: string): string {
  if (OP_COLOR[type]) return OP_COLOR[type]
  let hash = 0
  for (let i = 0; i < type.length; i++) hash = type.charCodeAt(i) + ((hash << 5) - hash)
  return `hsl(${Math.abs(hash) % 360}, 60%, 45%)`
}

const MONTHS_HE = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ']

const inputStyle: React.CSSProperties = {
  background: '#0a0f0a', border: '1px solid #1a2f1a', color: '#86efac',
  borderRadius: 6, padding: '5px 8px', fontFamily: 'inherit', fontSize: 13,
  outline: 'none', width: '100%',
}

// Season Y: March 1 (Y-1) → May 1 (Y), spans 14 months
function seasonBounds(year: number) {
  return {
    start: new Date(year - 1, 2, 1).getTime(), // March 1, Y-1
    end:   new Date(year,     4, 1).getTime(),  // May 1, Y
  }
}

function opBarPos(dateStart: string | null, dateEnd: string | null, seasonYear: number) {
  if (!dateStart) return null
  const { start: sStart, end: sEnd } = seasonBounds(seasonYear)
  const sLen = sEnd - sStart
  const s = new Date(dateStart).getTime()
  const e = dateEnd ? new Date(dateEnd).getTime() : s
  const left  = Math.max(0,   (s - sStart) / sLen * 100)
  const right = Math.min(100, (e + 86400000 - sStart) / sLen * 100)
  const width = Math.max(0.8, right - left)
  if (right < 0 || left > 100) return null
  return { left, width }
}

// Returns lane index per op so overlapping ops stack vertically
function computeLanes(ops: any[]): number[] {
  if (ops.length === 0) return []
  const result = new Array(ops.length).fill(0)
  const laneEnds: number[] = []
  const indexed = ops.map((op, i) => ({ op, i }))
    .sort((a, b) => (a.op.date_start || '').localeCompare(b.op.date_start || ''))
  for (const { op, i } of indexed) {
    const start = op.date_start ? new Date(op.date_start).getTime() : 0
    const end   = op.date_end   ? new Date(op.date_end  ).getTime() : start
    let lane = 0
    while (lane < laneEnds.length && laneEnds[lane] >= start) lane++
    result[i] = lane
    laneEnds[lane] = end
  }
  return result
}

// ── Defined outside Dashboard so React never remounts them on re-render ───────

type EditFormProps = {
  id: number
  editData: EditData
  setEditData: React.Dispatch<React.SetStateAction<EditData>>
  saving: boolean
  onSave: (id: number) => void
  onCancel: () => void
  plots?: Plot[]
}

function EditForm({ id, editData, setEditData, saving, onSave, onCancel, plots = [] }: EditFormProps) {
  function field(key: keyof EditData) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setEditData(d => ({ ...d, [key]: e.target.value }))
  }
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div>
          <div style={{ color: '#4a6a4a', fontSize: 11, marginBottom: 4 }}>סוג פעולה</div>
          <input list="op-types-list" value={editData.operation_type} onChange={field('operation_type')} style={inputStyle} placeholder="בחר או הקלד סוג פעולה" />
          <datalist id="op-types-list">
            {OP_TYPES.map(t => <option key={t} value={t} />)}
          </datalist>
        </div>
        <div>
          <div style={{ color: '#4a6a4a', fontSize: 11, marginBottom: 4 }}>עונה</div>
          <input value={editData.season_year} onChange={field('season_year')} style={inputStyle} placeholder="2025" />
        </div>
        <div>
          <div style={{ color: '#4a6a4a', fontSize: 11, marginBottom: 4 }}>תאריך התחלה</div>
          <input type="date" value={editData.date_start} onChange={field('date_start')} style={inputStyle} />
        </div>
        <div>
          <div style={{ color: '#4a6a4a', fontSize: 11, marginBottom: 4 }}>תאריך סיום</div>
          <input type="date" value={editData.date_end} onChange={field('date_end')} style={inputStyle} />
        </div>
        <div style={{ gridColumn: '1/-1' }}>
          <div style={{ color: '#4a6a4a', fontSize: 11, marginBottom: 4 }}>תזמון (אם אין תאריך)</div>
          <input value={editData.timing_desc} onChange={field('timing_desc')} style={inputStyle} placeholder="לדוגמה: אפריל 2025" />
        </div>
        <div style={{ gridColumn: '1/-1' }}>
          <div style={{ color: '#4a6a4a', fontSize: 11, marginBottom: 6 }}>חלקות</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {plots.map(p => {
              const selected = editData.plot_ids.split(',').map(s => parseInt(s.trim())).includes(p.id)
              return (
                <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 13, color: selected ? '#86efac' : '#4a6a4a' }}>
                  <input type="checkbox" checked={selected} onChange={e => {
                    const ids = editData.plot_ids.split(',').map(s => s.trim()).filter(Boolean)
                    const pid = String(p.id)
                    const newIds = e.target.checked ? [...ids, pid] : ids.filter(s => s !== pid)
                    setEditData(d => ({ ...d, plot_ids: newIds.filter(Boolean).join(',') }))
                  }} style={{ accentColor: '#16a34a' }} />
                  {p.name}
                </label>
              )
            })}
          </div>
        </div>
        <div>
          <div style={{ color: '#4a6a4a', fontSize: 11, marginBottom: 4 }}>זן</div>
          <input value={editData.variety} onChange={field('variety')} style={inputStyle} />
        </div>
        <div>
          <div style={{ color: '#4a6a4a', fontSize: 11, marginBottom: 4 }}>מבצע</div>
          <input value={editData.executor} onChange={field('executor')} style={inputStyle} />
        </div>
        <div>
          <div style={{ color: '#4a6a4a', fontSize: 11, marginBottom: 4 }}>עלות כוללת (₪)</div>
          <input type="number" value={editData.cost_total} onChange={field('cost_total')} style={inputStyle} />
        </div>
        <div>
          <div style={{ color: '#4a6a4a', fontSize: 11, marginBottom: 4 }}>עלות לדונם (₪)</div>
          <input type="number" value={editData.cost_per_dunam} onChange={field('cost_per_dunam')} style={inputStyle} />
        </div>
        <div style={{ gridColumn: '1/-1' }}>
          <div style={{ color: '#4a6a4a', fontSize: 11, marginBottom: 4 }}>הערות</div>
          <textarea value={editData.notes} onChange={field('notes')} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn" onClick={() => onSave(id)} disabled={saving}
          style={{ background: '#1e3a5f', color: '#93c5fd', border: '1px solid #2563eb44', display: 'flex', alignItems: 'center', gap: 6 }}>
          <CheckCircle size={13} /> {saving ? 'שומר...' : 'שמור שינויים'}
        </button>
        <button className="btn" onClick={onCancel}
          style={{ background: '#1a1a1a', color: '#6a6a6a', border: '1px solid #33333344', display: 'flex', alignItems: 'center', gap: 6 }}>
          <X size={13} /> ביטול
        </button>
      </div>
    </div>
  )
}

function OpReadView({ op, showSource = false }: { op: any; showSource?: boolean }) {
  const plotDisplay = op.plot_names || op.plot_ids
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 12 }}>
      <div className="field-row"><span className="field-label">סוג:</span><span className="field-value">{op.operation_type}</span></div>
      {op.season_year && <div className="field-row"><span className="field-label">עונה:</span><span className="field-value">{op.season_year}</span></div>}
      {(op.date_start || op.timing_desc) && <div className="field-row"><span className="field-label">תאריך:</span><span className="field-value">{op.date_start || op.timing_desc}</span></div>}
      {op.date_end && op.date_end !== op.date_start && <div className="field-row"><span className="field-label">עד:</span><span className="field-value">{op.date_end}</span></div>}
      {plotDisplay && <div className="field-row"><span className="field-label">חלקות:</span><span className="field-value">{plotDisplay}</span></div>}
      {op.variety && <div className="field-row"><span className="field-label">זן:</span><span className="field-value">{op.variety}</span></div>}
      {op.executor && <div className="field-row"><span className="field-label">מבצע:</span><span className="field-value">{op.executor}</span></div>}
      {op.supplier_name && <div className="field-row"><span className="field-label">ספק:</span><span className="field-value">{op.supplier_name}</span></div>}
      {op.cost_total != null && <div className="field-row"><span className="field-label">עלות:</span><span className="field-value">{Number(op.cost_total).toLocaleString()} ₪</span></div>}
      {op.cost_per_dunam != null && <div className="field-row"><span className="field-label">לדונם:</span><span className="field-value">{op.cost_per_dunam} ₪</span></div>}
      {op.notes && <div className="field-row" style={{ gridColumn: '1/-1' }}><span className="field-label">הערות:</span><span className="field-value">{op.notes}</span></div>}
      {showSource && op.source && <div className="field-row"><span className="field-label">מקור:</span><span style={{ color: '#4a6a4a', fontSize: 12 }}>{op.source}</span></div>}
    </div>
  )
}

const CONCEPT_CATEGORIES = ['השקיה', 'ריסוס', 'דישון', 'גיזום', 'קטיף', 'אחר']

type ConceptEditData = { category: string; topic: string; content: string; variety: string; valid_from: string }
const BLANK_CONCEPT: ConceptEditData = { category: '', topic: '', content: '', variety: '', valid_from: '' }

type ConceptCardProps = {
  c: Concept
  isDup: boolean
  isEditing: boolean
  editData: ConceptEditData
  setEditData: React.Dispatch<React.SetStateAction<ConceptEditData>>
  savingConcept: boolean
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
  onApprove: () => void
  onDelete: () => void
}

function ConceptCard({ c, isDup, isEditing, editData, setEditData, savingConcept, onEdit, onSave, onCancel, onApprove, onDelete }: ConceptCardProps) {
  const color = CAT_COLOR[c.category] || '#6b7280'
  return (
    <div style={{ background: '#0f1a0f', border: `1px solid ${isDup ? '#ca8a0433' : '#1a2f1a'}`, borderRadius: 10, padding: 16, marginBottom: 10 }}>
      {isEditing ? (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <div style={{ color: '#4a6a4a', fontSize: 11, marginBottom: 4 }}>קטגוריה</div>
              <input list="concept-cats" value={editData.category} onChange={e => setEditData(d => ({ ...d, category: e.target.value }))} style={inputStyle} />
              <datalist id="concept-cats">{CONCEPT_CATEGORIES.map(c => <option key={c} value={c} />)}</datalist>
            </div>
            <div>
              <div style={{ color: '#4a6a4a', fontSize: 11, marginBottom: 4 }}>תקף מ-</div>
              <input value={editData.valid_from} onChange={e => setEditData(d => ({ ...d, valid_from: e.target.value }))} style={inputStyle} placeholder="2025" />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <div style={{ color: '#4a6a4a', fontSize: 11, marginBottom: 4 }}>נושא</div>
              <input value={editData.topic} onChange={e => setEditData(d => ({ ...d, topic: e.target.value }))} style={inputStyle} />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <div style={{ color: '#4a6a4a', fontSize: 11, marginBottom: 4 }}>תוכן</div>
              <textarea value={editData.content} onChange={e => setEditData(d => ({ ...d, content: e.target.value }))} rows={5} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <div style={{ color: '#4a6a4a', fontSize: 11, marginBottom: 4 }}>זן</div>
              <input value={editData.variety} onChange={e => setEditData(d => ({ ...d, variety: e.target.value }))} style={inputStyle} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={onSave} disabled={savingConcept}
              style={{ background: '#1e3a5f', color: '#93c5fd', border: '1px solid #2563eb44', display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle size={13} /> {savingConcept ? 'שומר...' : 'שמור'}
            </button>
            <button className="btn" onClick={onCancel}
              style={{ background: '#1a1a1a', color: '#6a6a6a', border: '1px solid #33333344', display: 'flex', alignItems: 'center', gap: 6 }}>
              <X size={13} /> ביטול
            </button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ background: color + '22', color, border: `1px solid ${color}44`, borderRadius: 20, padding: '2px 10px', fontSize: 11 }}>{c.category}</span>
              {isDup && <span style={{ background: '#ca8a0422', color: '#fbbf24', border: '1px solid #ca8a0433', borderRadius: 20, padding: '2px 8px', fontSize: 11 }}>כפול</span>}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {c.valid_from && <span style={{ color: '#4a6a4a', fontSize: 11 }}>מ-{c.valid_from}</span>}
              {c.variety    && <span style={{ color: '#4a6a4a', fontSize: 11 }}>{c.variety}</span>}
            </div>
          </div>
          <div style={{ color: '#4ade80', fontWeight: 500, fontSize: 14, marginBottom: 6 }}>{c.topic}</div>
          <div style={{ color: '#86efac', fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>{c.content}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {!c.approved && (
              <button className="btn" onClick={onApprove}
                style={{ background: '#16a34a22', color: '#4ade80', border: '1px solid #16a34a44', display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle size={13} /> אשר
              </button>
            )}
            <button className="btn" onClick={onEdit}
              style={{ background: '#1e2a3f', color: '#93c5fd', border: '1px solid #2563eb33', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Pencil size={13} /> ערוך
            </button>
            <button className="btn" onClick={onDelete}
              style={{ background: '#2a0a0a', color: '#f87171', border: '1px solid #7f1d1d44', display: 'flex', alignItems: 'center', gap: 6 }}>
              <XCircle size={13} /> מחק
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default function Dashboard() {
  const [tab, setTab]           = useState<Tab>('conversations')
  const [messages, setMessages] = useState<Message[]>([])
  const [operations, setOperations] = useState<Operation[]>([])
  const [plots, setPlots]       = useState<Plot[]>([])
  const [insights, setInsights] = useState<Insight[]>([])
  const [concepts, setConcepts] = useState<Concept[]>([])
  const [loading, setLoading]   = useState(true)
  const [selectedPhone, setSelectedPhone] = useState('all')
  const [expandedMsg, setExpandedMsg]     = useState<number | null>(null)
  const [question, setQuestion] = useState('')
  const [sending, setSending]   = useState(false)
  const [stats, setStats]       = useState({ messages: 0, records: 0, pending: 0, insights: 0, concepts: 0 })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editData, setEditData]   = useState<EditData>(BLANK_EDIT)
  const [saving, setSaving]       = useState(false)
  const [ganttYear, setGanttYear] = useState(2026)
  const [editingConceptId, setEditingConceptId] = useState<number | null>(null)
  const [conceptEditData, setConceptEditData]   = useState<ConceptEditData>(BLANK_CONCEPT)
  const [savingConcept, setSavingConcept]       = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [m, pendingRes, approvedRes, plotsRes, plotLinksRes, iRes, cRes] = await Promise.all([
      supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('operations').select('*').eq('approved', false).order('created_at', { ascending: false }),
      supabase.from('gantt_operations').select('*').order('date_start', { ascending: true }),
      supabase.from('plots').select('id, name').order('id'),
      supabase.from('operation_plots').select('operation_id, plot_id'),
      supabase.from('insights').select('*').order('created_at', { ascending: false }),
      supabase.from('knowledge_concepts').select('*').is('superseded_by', null).order('category').order('topic'),
    ])

    // Build lookup: plot_id → name
    const plotNameById: Record<number, string> = {}
    for (const p of (plotsRes.data || [])) plotNameById[p.id] = p.name

    // Build lookup: operation_id → { names: "ב' עליון, ב' תחתון", ids: "1,2" }
    const opPlotInfo: Record<number, { names: string; ids: string }> = {}
    for (const l of (plotLinksRes.data || [])) {
      const name = plotNameById[l.plot_id] || String(l.plot_id)
      if (!opPlotInfo[l.operation_id]) opPlotInfo[l.operation_id] = { names: '', ids: '' }
      opPlotInfo[l.operation_id].names += (opPlotInfo[l.operation_id].names ? ', ' : '') + name
      opPlotInfo[l.operation_id].ids   += (opPlotInfo[l.operation_id].ids   ? ','  : '') + l.plot_id
    }

    if (m.data) setMessages(m.data)
    const allOps = [
      ...(pendingRes.data  || []).map((o: any) => ({
        ...o, approved: false,
        plot_names: opPlotInfo[o.id]?.names || null,
        plot_ids:   opPlotInfo[o.id]?.ids   || '',
      })),
      ...(approvedRes.data || []).map((o: any) => ({
        ...o, approved: true,
        // Prefer freshly-computed names from operation_plots over view value
        plot_names: opPlotInfo[o.id]?.names || o.plot_names || null,
        plot_ids:   opPlotInfo[o.id]?.ids   || o.plot_ids   || '',
      })),
    ]
    setOperations(allOps)
    if (plotsRes.data) setPlots(plotsRes.data)
    if (iRes.data) setInsights(iRes.data)
    if (cRes.data) setConcepts(cRes.data)
    setStats({
      messages: m.data?.length || 0,
      records:  (approvedRes.data || []).length,
      pending:  (pendingRes.data  || []).length,
      insights: (iRes.data || []).filter((x: Insight) => !x.reviewed).length,
      concepts: (cRes.data || []).filter((x: any) => !x.approved).length,
    })
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  function startEdit(op: any) {
    setEditingId(op.id)
    setEditData({
      operation_type: op.operation_type || '',
      season_year:    op.season_year    || '',
      date_start:     op.date_start     || '',
      date_end:       op.date_end       || '',
      timing_desc:    op.timing_desc    || '',
      plot_ids:       op.plot_ids       || '',
      variety:        op.variety        || '',
      executor:       op.executor       || '',
      notes:          op.notes          || '',
      cost_total:     op.cost_total     != null ? String(op.cost_total)     : '',
      cost_per_dunam: op.cost_per_dunam != null ? String(op.cost_per_dunam) : '',
    })
  }

  async function saveEdit(id: number) {
    setSaving(true)
    await supabase.from('operations').update({
      operation_type: editData.operation_type || null,
      season_year:    editData.season_year    || null,
      date_start:     editData.date_start     || null,
      date_end:       editData.date_end       || null,
      timing_desc:    editData.timing_desc    || null,
      variety:        editData.variety        || null,
      executor:       editData.executor       || null,
      notes:          editData.notes          || null,
      cost_total:     editData.cost_total     ? parseFloat(editData.cost_total)     : null,
      cost_per_dunam: editData.cost_per_dunam ? parseFloat(editData.cost_per_dunam) : null,
      updated_at:     new Date().toISOString(),
    }).eq('id', id)

    const newPlotIds = editData.plot_ids
      .split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n > 0)
    await supabase.from('operation_plots').delete().eq('operation_id', id)
    if (newPlotIds.length > 0)
      await supabase.from('operation_plots').insert(newPlotIds.map(pid => ({ operation_id: id, plot_id: pid })))

    setEditingId(null)
    setSaving(false)
    await fetchAll()
  }

  async function approveOperation(id: number) {
    await supabase.from('operations').update({ approved: true }).eq('id', id)
    await fetchAll()
  }

  async function deleteOperation(id: number) {
    if (!confirm('למחוק פעולה זו לצמיתות?')) return
    await supabase.from('operations').delete().eq('id', id)
    await fetchAll()
  }

  async function approveConcept(id: number) {
    await supabase.from('knowledge_concepts').update({ approved: true }).eq('id', id)
    await fetchAll()
  }

  async function deleteConcept(id: number) {
    if (!confirm('למחוק קונספט זה?')) return
    await supabase.from('knowledge_concepts').delete().eq('id', id)
    await fetchAll()
  }

  function startConceptEdit(c: Concept) {
    setEditingConceptId(c.id)
    setConceptEditData({
      category:   c.category   || '',
      topic:      c.topic      || '',
      content:    c.content    || '',
      variety:    c.variety    || '',
      valid_from: c.valid_from || '',
    })
  }

  async function saveConceptEdit() {
    if (!editingConceptId) return
    setSavingConcept(true)
    await supabase.from('knowledge_concepts').update({
      category:   conceptEditData.category   || null,
      topic:      conceptEditData.topic      || null,
      content:    conceptEditData.content    || null,
      variety:    conceptEditData.variety    || null,
      valid_from: conceptEditData.valid_from || null,
    }).eq('id', editingConceptId)
    setEditingConceptId(null)
    setSavingConcept(false)
    await fetchAll()
  }

  async function markInsightReviewed(id: number) {
    await supabase.from('insights').update({ reviewed: true }).eq('id', id)
    setInsights(i => i.map(x => x.id === id ? { ...x, reviewed: true } : x))
    setStats(s => ({ ...s, insights: s.insights - 1 }))
  }

  async function sendQuestion() {
    if (!question.trim()) return
    setSending(true)
    await supabase.from('pending_questions').insert([{ asked_by: 'dashboard', question }])
    setQuestion('')
    setSending(false)
    alert('השאלה נשמרה — הסוכן ישאל את אביק בשיחה הבאה')
  }

  const filteredMessages = selectedPhone === 'all' ? messages : messages.filter(m => m.from_phone === selectedPhone)
  const pendingOps  = operations.filter(o => !o.approved)
  const approvedOps = operations.filter(o => o.approved)

  // Filter by season_year field — date range is only used for bar positioning
  const seasonOps    = approvedOps.filter(o => String((o as any).season_year) === String(ganttYear))
  const ganttDated   = seasonOps.filter(o => !!o.date_start)
  const ganttUndated = seasonOps.filter(o => !o.date_start)

  // Shared props passed down to the external EditForm
  const editFormProps = { editData, setEditData, saving, onSave: saveEdit, onCancel: () => setEditingId(null), plots }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0f0a', fontFamily: "'IBM Plex Sans', sans-serif", direction: 'rtl' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0a0f0a; }
        ::-webkit-scrollbar-thumb { background: #1a2f1a; border-radius: 2px; }
        .card { background: #0f1a0f; border: 1px solid #1a2f1a; border-radius: 12px; }
        .btn { cursor: pointer; border: none; border-radius: 8px; padding: 8px 16px; font-size: 13px; font-weight: 500; transition: all 0.15s; font-family: inherit; }
        .btn:hover { opacity: 0.85; }
        .btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .msg-bubble { padding: 10px 14px; border-radius: 10px; max-width: 75%; word-break: break-word; font-size: 14px; line-height: 1.6; }
        .avik-bubble   { background: #0f2a0f; border: 1px solid #16a34a33; color: #86efac; align-self: flex-start; }
        .bot-bubble    { background: #1a1a2e; border: 1px solid #7c3aed33; color: #c4b5fd; align-self: flex-end; }
        .manager-bubble{ background: #0f1a2f; border: 1px solid #2563eb33; color: #93c5fd; align-self: flex-start; }
        .tab { cursor: pointer; padding: 8px 20px; border-radius: 8px; font-size: 14px; font-weight: 500; transition: all 0.15s; border: 1px solid transparent; background: none; font-family: inherit; }
        .tab.active { background: #16a34a22; border-color: #16a34a44; color: #4ade80; }
        .tab:not(.active) { color: #4a6a4a; }
        .tab:not(.active):hover { color: #6a8a6a; }
        .field-row { display: flex; gap: 8px; margin-bottom: 6px; font-size: 13px; }
        .field-label { color: #4a6a4a; min-width: 72px; flex-shrink: 0; }
        .field-value { color: #86efac; }
        .record-card { background: #0f1a0f; border-radius: 10px; padding: 16px; margin-bottom: 12px; }
        .stat-num { font-size: 32px; font-weight: 600; font-family: 'IBM Plex Mono', monospace; }
        .stat-card { background: #0f1a0f; border: 1px solid #1a2f1a; border-radius: 12px; padding: 20px; text-align: center; transition: border-color 0.15s; }
        .stat-card.clickable { cursor: pointer; }
        .stat-card.clickable:hover { border-color: #16a34a66; }
        input:focus, textarea:focus, select:focus { border-color: #16a34a88 !important; }
        input, textarea, select { color-scheme: dark; }
        .gantt-bar { position: absolute; height: 22px; border-radius: 4px; display: flex; align-items: center; padding: 0 6px; font-size: 11px; color: #fff; white-space: nowrap; overflow: hidden; cursor: default; transition: opacity 0.15s; }
        .gantt-bar:hover { opacity: 0.85; z-index: 10; }
      `}</style>

      {/* Header */}
      <div style={{ background: '#0a0f0a', borderBottom: '1px solid #1a2f1a', padding: '0 32px' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 32, height: 32, background: '#16a34a22', border: '1px solid #16a34a44', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sprout size={16} color="#4ade80" />
            </div>
            <div>
              <div style={{ color: '#4ade80', fontWeight: 600, fontSize: 16, fontFamily: 'IBM Plex Mono, monospace' }}>OrchardAgent</div>
              <div style={{ color: '#2a4a2a', fontSize: 11 }}>דשבורד ניהול — פרדסי לב</div>
            </div>
          </div>
          <button className="btn" onClick={fetchAll} style={{ background: '#0f2a0f', color: '#4ade80', border: '1px solid #16a34a33', display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={13} /> רענון
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '32px' }}>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 32 }}>
          {[
            { label: 'הודעות',          value: stats.messages, color: '#4ade80', onClick: () => setTab('conversations') },
            { label: 'פעולות מתועדות',  value: stats.records,  color: '#60a5fa', onClick: () => setTab('gantt') },
            { label: 'פעולות לאישור',   value: stats.pending,  color: '#fbbf24', onClick: () => setTab('knowledge') },
            { label: 'ידע לאישור',      value: stats.concepts, color: '#34d399', onClick: () => setTab('concepts') },
            { label: 'תובנות חדשות',    value: stats.insights, color: '#a78bfa', onClick: () => setTab('insights') },
          ].map(s => (
            <div key={s.label} className="stat-card clickable" onClick={s.onClick}>
              <div className="stat-num" style={{ color: s.color }}>{s.value}</div>
              <div style={{ color: '#2a4a2a', fontSize: 12, marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          <button className={`tab ${tab === 'conversations' ? 'active' : ''}`} onClick={() => setTab('conversations')}>שיחות</button>
          <button className={`tab ${tab === 'knowledge'     ? 'active' : ''}`} onClick={() => setTab('knowledge')}>
            ידע {stats.pending > 0 && <span style={{ background: '#ca8a04', color: '#0a0f0a', borderRadius: 10, padding: '1px 7px', fontSize: 11, marginRight: 6 }}>{stats.pending}</span>}
          </button>
          <button className={`tab ${tab === 'gantt'         ? 'active' : ''}`} onClick={() => setTab('gantt')}>גאנט</button>
          <button className={`tab ${tab === 'concepts'      ? 'active' : ''}`} onClick={() => setTab('concepts')}>
            ידע {stats.concepts > 0 && <span style={{ background: '#059669', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 11, marginRight: 6 }}>{stats.concepts}</span>}
          </button>
          <button className={`tab ${tab === 'insights'      ? 'active' : ''}`} onClick={() => setTab('insights')}>
            תובנות {stats.insights > 0 && <span style={{ background: '#7c3aed', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 11, marginRight: 6 }}>{stats.insights}</span>}
          </button>
        </div>

        {loading && <div style={{ color: '#2a4a2a', textAlign: 'center', padding: 60 }}>טוען נתונים...</div>}

        {/* ── CONVERSATIONS ────────────────────────────────────────────────── */}
        {!loading && tab === 'conversations' && (
          <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 24 }}>
            <div>
              <div className="card" style={{ padding: 20, marginBottom: 16 }}>
                <div style={{ color: '#4a6a4a', fontSize: 12, marginBottom: 10 }}>סנן לפי משתמש</div>
                <select value={selectedPhone} onChange={e => setSelectedPhone(e.target.value)}
                  style={{ width: '100%', background: '#0f1a0f', border: '1px solid #1a2f1a', color: '#86efac', borderRadius: 8, padding: '8px 12px', fontFamily: 'inherit', fontSize: 13, outline: 'none' }}>
                  <option value="all">כולם</option>
                  {Object.entries(USERS).map(([phone, user]) => (
                    <option key={phone} value={phone}>{user.name}</option>
                  ))}
                </select>
              </div>
              <div className="card" style={{ padding: 20 }}>
                <div style={{ color: '#4ade80', fontSize: 13, fontWeight: 500, marginBottom: 12 }}>שאל את אביק</div>
                <textarea value={question} onChange={e => setQuestion(e.target.value)} placeholder="שאלה לשלוח לאביק..."
                  style={{ width: '100%', background: '#0a0f0a', border: '1px solid #1a2f1a', color: '#86efac', borderRadius: 8, padding: '10px 12px', fontFamily: 'inherit', fontSize: 13, minHeight: 80, outline: 'none', resize: 'none' }} />
                <button className="btn" onClick={sendQuestion} disabled={sending || !question.trim()}
                  style={{ marginTop: 10, background: '#16a34a', color: '#fff', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Send size={13} /> {sending ? 'שולח...' : 'שמור שאלה'}
                </button>
              </div>
            </div>
            <div className="card" style={{ padding: 24, maxHeight: 560, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredMessages.length === 0
                ? <div style={{ color: '#2a4a2a', textAlign: 'center', padding: 60 }}>אין הודעות</div>
                : filteredMessages.map(msg => {
                    const isBot  = msg.role === 'assistant'
                    const isAvik = msg.from_phone === 'whatsapp:+972523385558'
                    const cls = isBot ? 'bot-bubble' : isAvik ? 'avik-bubble' : 'manager-bubble'
                    const isLong = msg.content.length > 220
                    const isExp  = expandedMsg === msg.id
                    return (
                      <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isBot ? 'flex-end' : 'flex-start' }}>
                        <div style={{ fontSize: 11, color: '#4a6a4a', marginBottom: 3 }}>
                          {isBot ? 'סוכן' : getUserName(msg.from_phone)} · {new Date(msg.created_at).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' })} {new Date(msg.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className={`msg-bubble ${cls}`} onClick={() => isLong && setExpandedMsg(isExp ? null : msg.id)} style={{ cursor: isLong ? 'pointer' : 'default' }}>
                          {isLong && !isExp ? msg.content.slice(0, 220) + '...' : msg.content}
                          {isLong && <div style={{ marginTop: 4, fontSize: 11, color: '#4a6a4a', display: 'flex', alignItems: 'center', gap: 3 }}>
                            {isExp ? <><ChevronUp size={11} /> פחות</> : <><ChevronDown size={11} /> עוד</>}
                          </div>}
                        </div>
                      </div>
                    )
                  })}
            </div>
          </div>
        )}

        {/* ── KNOWLEDGE (pending approval) ─────────────────────────────────── */}
        {!loading && tab === 'knowledge' && (
          <div>
            {pendingOps.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <div style={{ color: '#fbbf24', fontSize: 13, fontWeight: 500, marginBottom: 16 }}>ממתינות לאישורך ({pendingOps.length})</div>
                {pendingOps.map(op => (
                  <div key={op.id} className="record-card" style={{ border: `1px solid ${editingId === op.id ? '#2563eb44' : '#ca8a0433'}` }}>
                    {editingId === op.id
                      ? <EditForm id={op.id} {...editFormProps} />
                      : <>
                          <OpReadView op={op} showSource />
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn" onClick={() => approveOperation(op.id)} style={{ background: '#16a34a22', color: '#4ade80', border: '1px solid #16a34a44', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <CheckCircle size={13} /> אשר לגאנט
                            </button>
                            <button className="btn" onClick={() => startEdit(op)} style={{ background: '#1e2a3f', color: '#93c5fd', border: '1px solid #2563eb33', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Pencil size={13} /> ערוך
                            </button>
                            <button className="btn" onClick={() => deleteOperation(op.id)} style={{ background: '#2a0a0a', color: '#f87171', border: '1px solid #7f1d1d44', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <XCircle size={13} /> דחה
                            </button>
                          </div>
                        </>
                    }
                  </div>
                ))}
              </div>
            )}
            {pendingOps.length === 0 && <div style={{ color: '#2a4a2a', textAlign: 'center', padding: 60 }}>אין פעולות הממתינות לאישור</div>}
          </div>
        )}

        {/* ── GANTT VIEW ───────────────────────────────────────────────────── */}
        {!loading && tab === 'gantt' && (
          <div>
            {/* Year selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
              <div style={{ color: '#4a6a4a', fontSize: 13 }}>עונת גידול:</div>
              {[2025, 2026, 2027].map(y => (
                <button key={y} className="btn" onClick={() => setGanttYear(y)}
                  style={{ background: ganttYear === y ? '#16a34a22' : 'transparent', color: ganttYear === y ? '#4ade80' : '#4a6a4a', border: `1px solid ${ganttYear === y ? '#16a34a44' : '#1a2f1a'}` }}>
                  <span style={{ fontSize: 11 }}>עונת </span>{y}
                  <span style={{ fontSize: 10, color: '#2a4a2a', marginRight: 4 }}> (מרץ {y-1}–מאי {y})</span>
                </button>
              ))}
            </div>

            {/* Visual Gantt Chart */}
            <div className="card" style={{ padding: 20, marginBottom: 24 }}>
              <div style={{ color: '#4ade80', fontSize: 13, fontWeight: 500, marginBottom: 16 }}>ציר זמן — עונת {ganttYear} <span style={{ color: '#2a4a2a', fontWeight: 400 }}>(מרץ {ganttYear-1} – מאי {ganttYear})</span></div>

              {/* direction:ltr so left:X% bars align with month headers (Mar Y-1 → Apr Y) */}
              <div style={{ direction: 'ltr' }}>
                {/* Month headers — 14 months: March(Y-1) through April(Y) */}
                {(() => {
                  const months = Array.from({ length: 14 }, (_, i) => {
                    const d = new Date(ganttYear - 1, 2 + i, 1)
                    return { label: MONTHS_HE[d.getMonth()], year: d.getFullYear() }
                  })
                  return (
                    <>
                      {/* Year labels row */}
                      <div style={{ display: 'flex', marginRight: 120, marginBottom: 2 }}>
                        <div style={{ flex: 10, textAlign: 'center', color: '#4a6a4a', fontSize: 10, borderRight: '2px solid #16a34a33' }}>{ganttYear - 1}</div>
                        <div style={{ flex: 4, textAlign: 'center', color: '#4a6a4a', fontSize: 10 }}>{ganttYear}</div>
                      </div>
                      {/* Month names row */}
                      <div style={{ display: 'flex', marginRight: 120, marginBottom: 8 }}>
                        {months.map((m, i) => (
                          <div key={i} style={{ flex: 1, textAlign: 'center', color: '#2a4a2a', fontSize: 11, borderRight: i === 9 ? '2px solid #16a34a33' : '1px solid #1a2f1a', paddingBottom: 4 }}>{m.label}</div>
                        ))}
                      </div>
                    </>
                  )
                })()}

                {/* Plot rows: bar track on left, label on right */}
                {plots.map(plot => {
                  const plotOps = ganttDated.filter(op => {
                    const ids = String((op as any).plot_ids || '').split(',').map((s: string) => parseInt(s.trim()))
                    return ids.includes(plot.id)
                  })
                  const lanes = computeLanes(plotOps)
                  const maxLanes = plotOps.length > 0 ? Math.max(...lanes) + 1 : 1
                  const rowH = Math.max(30, 4 + maxLanes * 28)
                  return (
                    <div key={plot.id} style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                      <div style={{ flex: 1, background: '#0a140a', borderRadius: 4, position: 'relative', height: rowH, border: '1px solid #1a2f1a' }}>
                        {/* Month grid lines — 14 months, year boundary at 10/14 */}
                        {Array.from({ length: 13 }, (_, i) => (
                          <div key={i} style={{ position: 'absolute', top: 0, bottom: 0, left: `${((i + 1) / 14) * 100}%`, borderRight: i === 9 ? '2px solid #16a34a44' : '1px solid #1a2f1a33', pointerEvents: 'none' }} />
                        ))}
                        {/* Operation bars */}
                        {plotOps.map((op, idx) => {
                          const pos = opBarPos(op.date_start, op.date_end, ganttYear)
                          if (!pos) return null
                          const color = opColor(op.operation_type)
                          const topPx = 4 + lanes[idx] * 28
                          return (
                            <div key={op.id} className="gantt-bar" title={`${op.operation_type} | ${op.date_start}${op.date_end && op.date_end !== op.date_start ? ' – ' + op.date_end : ''} | ${op.plot_names || ''}`}
                              style={{ top: topPx, left: `${pos.left}%`, width: `${pos.width}%`, background: color + 'cc', border: `1px solid ${color}` }}>
                              {pos.width > 3 ? op.operation_type : ''}
                            </div>
                          )
                        })}
                      </div>
                      <div style={{ width: 120, flexShrink: 0, fontSize: 12, color: '#86efac', paddingRight: 8, textAlign: 'right', direction: 'rtl' }}>
                        <div>{plot.name}</div>
                        <div style={{ color: '#2a4a2a', fontSize: 10 }}>{plot.area_dunam} ד׳</div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Legend — only types present in this season */}
              {seasonOps.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 16, paddingTop: 12, borderTop: '1px solid #1a2f1a' }}>
                  {[...new Set(seasonOps.map((o: any) => o.operation_type).filter(Boolean))].map(type => (
                    <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#4a6a4a' }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: opColor(type) }} />
                      {type}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Operations Grid */}
            <div style={{ color: '#4ade80', fontSize: 13, fontWeight: 500, marginBottom: 16 }}>
              כל הפעולות המאושרות ({approvedOps.length})
            </div>

            {approvedOps.length === 0
              ? <div style={{ color: '#2a4a2a', textAlign: 'center', padding: 60 }}>אין פעולות מאושרות עדיין</div>
              : approvedOps.map(op => (
                  <div key={op.id} className="record-card" style={{ border: `1px solid ${editingId === op.id ? '#2563eb44' : '#16a34a33'}` }}>
                    {editingId === op.id
                      ? <EditForm id={op.id} {...editFormProps} />
                      : <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ flex: 1 }}>
                              <OpReadView op={op} />
                            </div>
                            <div style={{ width: 12, height: 12, borderRadius: 2, background: opColor(op.operation_type), flexShrink: 0, marginTop: 2 }} />
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn" onClick={() => startEdit(op)} style={{ background: '#1e2a3f', color: '#93c5fd', border: '1px solid #2563eb33', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Pencil size={13} /> ערוך
                            </button>
                            <button className="btn" onClick={() => deleteOperation(op.id)} style={{ background: '#2a0a0a', color: '#f87171', border: '1px solid #7f1d1d44', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <XCircle size={13} /> מחק
                            </button>
                          </div>
                        </>
                    }
                  </div>
                ))
            }

            {/* Undated operations note */}
            {ganttUndated.length > 0 && (
              <div style={{ marginTop: 16, color: '#4a6a4a', fontSize: 12, textAlign: 'center' }}>
                {ganttUndated.length} פעולות ללא תאריך מדויק לשנה זו אינן מוצגות בציר הזמן
              </div>
            )}
          </div>
        )}

        {/* ── CONCEPTS ─────────────────────────────────────────────────────── */}
        {!loading && tab === 'concepts' && (() => {
          const pending  = concepts.filter(c => !c.approved)
          const approved = concepts.filter(c => c.approved)

          // Detect duplicate topics among pending
          const topicCount: Record<string, number> = {}
          pending.forEach(c => { topicCount[c.topic] = (topicCount[c.topic] || 0) + 1 })

          const cardProps = {
            editData: conceptEditData, setEditData: setConceptEditData,
            savingConcept, onSave: saveConceptEdit, onCancel: () => setEditingConceptId(null),
          }

          return (
            <div>
              {pending.length > 0 && (
                <div style={{ marginBottom: 32 }}>
                  <div style={{ color: '#34d399', fontSize: 13, fontWeight: 500, marginBottom: 16 }}>
                    ממתין לאישור ({pending.length})
                    {Object.values(topicCount).some(n => n > 1) && <span style={{ color: '#fbbf24', fontSize: 12, marginRight: 12 }}>⚠ ישנם כפילויות — מחק לפני אישור</span>}
                  </div>
                  {pending.map(c => (
                    <ConceptCard key={c.id} c={c} isDup={topicCount[c.topic] > 1}
                      isEditing={editingConceptId === c.id} {...cardProps}
                      onEdit={() => startConceptEdit(c)}
                      onApprove={() => approveConcept(c.id)}
                      onDelete={() => deleteConcept(c.id)} />
                  ))}
                </div>
              )}
              {approved.length > 0 && (
                <div>
                  <div style={{ color: '#4a6a4a', fontSize: 13, fontWeight: 500, marginBottom: 16 }}>מאושר ופעיל ({approved.length})</div>
                  {approved.map(c => (
                    <ConceptCard key={c.id} c={c} isDup={false}
                      isEditing={editingConceptId === c.id} {...cardProps}
                      onEdit={() => startConceptEdit(c)}
                      onApprove={() => approveConcept(c.id)}
                      onDelete={() => deleteConcept(c.id)} />
                  ))}
                </div>
              )}
              {concepts.length === 0 && <div style={{ color: '#2a4a2a', textAlign: 'center', padding: 60 }}>אין קונספטים</div>}
            </div>
          )
        })()}

        {/* ── INSIGHTS ─────────────────────────────────────────────────────── */}
        {!loading && tab === 'insights' && (
          <div>
            {insights.length === 0
              ? <div style={{ color: '#2a4a2a', textAlign: 'center', padding: 60 }}>עדיין אין תובנות</div>
              : insights.map(ins => (
                  <div key={ins.id} style={{ background: '#0f1a0f', border: '1px solid #ca8a0433', borderRadius: 10, padding: 16, marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div style={{ color: '#fbbf24', fontWeight: 500 }}>{ins.topic}</div>
                      {!ins.reviewed && <span style={{ background: '#ca8a0422', color: '#fbbf24', border: '1px solid #ca8a0433', borderRadius: 20, padding: '2px 10px', fontSize: 12 }}>חדש</span>}
                    </div>
                    <div className="field-row" style={{ marginBottom: 8 }}><span className="field-label">שיטת אביק:</span><span className="field-value">{ins.avik_method}</span></div>
                    <div className="field-row" style={{ marginBottom: 12 }}><span className="field-label">חלופה:</span><span style={{ color: '#a78bfa' }}>{ins.alternative}</span></div>
                    {!ins.reviewed && (
                      <button className="btn" onClick={() => markInsightReviewed(ins.id)} style={{ background: '#1a1a2e', color: '#a78bfa', border: '1px solid #7c3aed33', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <CheckCircle size={13} /> סמן כנצפה
                      </button>
                    )}
                  </div>
                ))}
          </div>
        )}
      </div>
    </div>
  )
}
