'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase, getUserName, USERS, type Message, type KnowledgeRecord, type Insight } from '@/lib/supabase'
import { MessageSquare, Sprout, Lightbulb, CheckCircle, XCircle, Clock, RefreshCw, Send, ChevronDown, ChevronUp } from 'lucide-react'

type Tab = 'conversations' | 'knowledge' | 'insights'

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>('conversations')
  const [messages, setMessages] = useState<Message[]>([])
  const [records, setRecords] = useState<KnowledgeRecord[]>([])
  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPhone, setSelectedPhone] = useState<string>('all')
  const [expandedMsg, setExpandedMsg] = useState<number | null>(null)
  const [question, setQuestion] = useState('')
  const [sending, setSending] = useState(false)
  const [stats, setStats] = useState({ messages: 0, records: 0, pending: 0, insights: 0 })

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [m, r, i] = await Promise.all([
      supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('knowledge_records').select('*').order('created_at', { ascending: false }),
      supabase.from('insights').select('*').order('created_at', { ascending: false }),
    ])
    if (m.data) setMessages(m.data)
    if (r.data) setRecords(r.data)
    if (i.data) setInsights(i.data)
    setStats({
      messages: m.data?.length || 0,
      records: r.data?.length || 0,
      pending: r.data?.filter((x: KnowledgeRecord) => !x.approved).length || 0,
      insights: i.data?.filter((x: Insight) => !x.reviewed).length || 0,
    })
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function approveRecord(id: number) {
    await supabase.from('knowledge_records').update({ approved: true }).eq('id', id)
    setRecords(r => r.map(x => x.id === id ? { ...x, approved: true } : x))
    setStats(s => ({ ...s, pending: s.pending - 1 }))
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

  const filteredMessages = selectedPhone === 'all'
    ? messages
    : messages.filter(m => m.from_phone === selectedPhone)

  const pendingRecords = records.filter(r => !r.approved)
  const approvedRecords = records.filter(r => r.approved)

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
        .avik-bubble { background: #0f2a0f; border: 1px solid #16a34a33; color: #86efac; align-self: flex-start; }
        .bot-bubble { background: #1a1a2e; border: 1px solid #7c3aed33; color: #c4b5fd; align-self: flex-end; }
        .manager-bubble { background: #0f1a2f; border: 1px solid #2563eb33; color: #93c5fd; align-self: flex-start; }
        .tab { cursor: pointer; padding: 8px 20px; border-radius: 8px; font-size: 14px; font-weight: 500; transition: all 0.15s; border: 1px solid transparent; background: none; font-family: inherit; }
        .tab.active { background: #16a34a22; border-color: #16a34a44; color: #4ade80; }
        .tab:not(.active) { color: #4a6a4a; }
        .tab:not(.active):hover { color: #6a8a6a; }
        .field-row { display: flex; gap: 8px; margin-bottom: 6px; font-size: 13px; }
        .field-label { color: #4a6a4a; min-width: 72px; flex-shrink: 0; }
        .field-value { color: #86efac; }
        .record-card { background: #0f1a0f; border-radius: 10px; padding: 16px; margin-bottom: 12px; }
        .stat-num { color: inherit; font-size: 32px; font-weight: 600; font-family: 'IBM Plex Mono', monospace; }
      `}</style>

      {/* Header */}
      <div style={{ background: '#0a0f0a', borderBottom: '1px solid #1a2f1a', padding: '0 32px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
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

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px' }}>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
          {[
            { label: 'הודעות', value: stats.messages, color: '#4ade80' },
            { label: 'רשומות ידע', value: stats.records, color: '#60a5fa' },
            { label: 'ממתינות לאישור', value: stats.pending, color: '#fbbf24' },
            { label: 'תובנות חדשות', value: stats.insights, color: '#a78bfa' },
          ].map(s => (
            <div key={s.label} style={{ background: '#0f1a0f', border: '1px solid #1a2f1a', borderRadius: 12, padding: 20, textAlign: 'center' }}>
              <div className="stat-num" style={{ color: s.color }}>{s.value}</div>
              <div style={{ color: '#2a4a2a', fontSize: 12, marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          <button className={`tab ${tab === 'conversations' ? 'active' : ''}`} onClick={() => setTab('conversations')}>שיחות</button>
          <button className={`tab ${tab === 'knowledge' ? 'active' : ''}`} onClick={() => setTab('knowledge')}>
            ידע {stats.pending > 0 && <span style={{ background: '#ca8a04', color: '#0a0f0a', borderRadius: 10, padding: '1px 7px', fontSize: 11, marginRight: 6 }}>{stats.pending}</span>}
          </button>
          <button className={`tab ${tab === 'insights' ? 'active' : ''}`} onClick={() => setTab('insights')}>
            תובנות {stats.insights > 0 && <span style={{ background: '#7c3aed', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 11, marginRight: 6 }}>{stats.insights}</span>}
          </button>
        </div>

        {loading && <div style={{ color: '#2a4a2a', textAlign: 'center', padding: 60 }}>טוען נתונים...</div>}

        {/* Conversations */}
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
                <textarea value={question} onChange={e => setQuestion(e.target.value)}
                  placeholder="שאלה לשלוח לאביק..."
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
                  const isBot = msg.role === 'assistant'
                  const isAvik = msg.from_phone === 'whatsapp:+972523385558'
                  const bubbleClass = isBot ? 'bot-bubble' : isAvik ? 'avik-bubble' : 'manager-bubble'
                  const isLong = msg.content.length > 220
                  const isExp = expandedMsg === msg.id
                  return (
                    <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isBot ? 'flex-end' : 'flex-start' }}>
                      <div style={{ fontSize: 11, color: '#2a4a2a', marginBottom: 3 }}>
                        {isBot ? 'סוכן' : getUserName(msg.from_phone)} · {new Date(msg.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className={`msg-bubble ${bubbleClass}`} onClick={() => isLong && setExpandedMsg(isExp ? null : msg.id)} style={{ cursor: isLong ? 'pointer' : 'default' }}>
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

        {/* Knowledge */}
        {!loading && tab === 'knowledge' && (
          <div>
            {pendingRecords.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <div style={{ color: '#fbbf24', fontSize: 13, fontWeight: 500, marginBottom: 16 }}>ממתינות לאישורך ({pendingRecords.length})</div>
                {pendingRecords.map(r => (
                  <div key={r.id} className="record-card" style={{ border: '1px solid #ca8a0433' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 12 }}>
                      {r.action && <div className="field-row"><span className="field-label">פעולה:</span><span className="field-value">{r.action}</span></div>}
                      {r.timing && <div className="field-row"><span className="field-label">תזמון:</span><span className="field-value">{r.timing}</span></div>}
                      {r.plot && <div className="field-row"><span className="field-label">חלקה:</span><span className="field-value">{r.plot}</span></div>}
                      {r.variety && <div className="field-row"><span className="field-label">זן:</span><span className="field-value">{r.variety}</span></div>}
                      {r.materials && <div className="field-row" style={{ gridColumn: '1/-1' }}><span className="field-label">חומרים:</span><span className="field-value">{r.materials}</span></div>}
                      {r.supplier && <div className="field-row"><span className="field-label">ספק:</span><span className="field-value">{r.supplier}</span></div>}
                      {r.cost && <div className="field-row"><span className="field-label">עלות:</span><span className="field-value">{r.cost}</span></div>}
                      {r.nuances && <div className="field-row" style={{ gridColumn: '1/-1' }}><span className="field-label">ניואנסים:</span><span className="field-value">{r.nuances}</span></div>}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn" onClick={() => approveRecord(r.id)} style={{ background: '#16a34a22', color: '#4ade80', border: '1px solid #16a34a44', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <CheckCircle size={13} /> אשר לגאנט
                      </button>
                      <button className="btn" style={{ background: '#2a0a0a', color: '#f87171', border: '1px solid #7f1d1d44', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <XCircle size={13} /> דחה
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {approvedRecords.length > 0 && (
              <div>
                <div style={{ color: '#4ade80', fontSize: 13, fontWeight: 500, marginBottom: 16 }}>ידע מאושר ({approvedRecords.length})</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {approvedRecords.map(r => (
                    <div key={r.id} className="record-card" style={{ border: '1px solid #16a34a33' }}>
                      {r.action && <div className="field-row"><span className="field-label">פעולה:</span><span className="field-value">{r.action}</span></div>}
                      {r.timing && <div className="field-row"><span className="field-label">תזמון:</span><span className="field-value">{r.timing}</span></div>}
                      {r.plot && <div className="field-row"><span className="field-label">חלקה:</span><span className="field-value">{r.plot}</span></div>}
                      {r.materials && <div className="field-row"><span className="field-label">חומרים:</span><span className="field-value">{r.materials}</span></div>}
                      {r.supplier && <div className="field-row"><span className="field-label">ספק:</span><span className="field-value">{r.supplier}</span></div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {records.length === 0 && <div style={{ color: '#2a4a2a', textAlign: 'center', padding: 60 }}>עדיין לא נחלצו רשומות ידע</div>}
          </div>
        )}

        {/* Insights */}
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
