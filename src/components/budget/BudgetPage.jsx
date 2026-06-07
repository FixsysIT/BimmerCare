import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { buildBudgetPlan, REASON } from '../../utils/budgetPlan';
import { formatMaintenanceStatus } from '../../utils/statusFormat';
import { tItem } from '../../utils/translate';
import './BudgetPage.css';

const URGENCY_CLS = {
  replace_needed: 'u-red', worn: 'u-orange', inspection_needed: 'u-inspect',
  due_soon: 'u-orange', monitor: 'u-monitor', ok: 'u-grey',
};
const REASON_CLS = {
  [REASON.SAFETY]: 'r-safety', [REASON.APK]: 'r-apk', [REASON.INTERVAL]: 'r-interval',
  [REASON.COMBINE]: 'r-combine', [REASON.WATCH]: 'r-monitor', [REASON.CUSTOM]: 'r-custom',
  [REASON.BLOCKED_DIAGNOSIS]: 'r-blocked', [REASON.BLOCKED_PREREQ]: 'r-blocked',
};
const newId = () => (globalThis.crypto?.randomUUID?.() || String(Date.now() + Math.random()));
const ymd = (d) => d.toISOString().slice(0, 10);

export default function BudgetPage({ itemsWithStatus, settings = {}, setSettings, vehicle }) {
  const { t, i18n } = useTranslation();
  const km = vehicle?.currentMileage;

  const plan = useMemo(
    () => buildBudgetPlan(itemsWithStatus, settings, new Date()),
    [itemsWithStatus, settings],
  );

  const eur = (n) => `€${Math.round(n || 0).toLocaleString('nl-NL')}`;
  const set = (field, value) => setSettings({ ...settings, [field]: value });
  const num = (field) => (e) => set(field, e.target.value === '' ? '' : Number(e.target.value));
  const dateLabel = (d) => new Date(d).toLocaleDateString(i18n.language === 'en' ? 'en-GB' : 'nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });

  // ---- sessions (garage visits) ----
  const sessions = settings.budgetSessions || [];
  const rawById = (id) => sessions.find((s) => s.id === id) || {};
  const addSession = (date = '') => set('budgetSessions', [...sessions, { id: newId(), name: '', date, money: '', note: '' }]);
  const updateSession = (id, patch) => set('budgetSessions', sessions.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const removeSession = (id) => {
    // delete the block; unpin its catalog jobs (back to auto) and drop the custom
    // lines that lived only in it
    const pin = { ...(prefs.pinnedSession || {}) };
    const droppedCustom = [];
    Object.keys(pin).forEach((jid) => {
      if (pin[jid] === id) { delete pin[jid]; if (jid.startsWith('custom:')) droppedCustom.push(jid.slice(7)); }
    });
    setSettings({
      ...settings,
      budgetSessions: sessions.filter((s) => s.id !== id),
      budgetCustom: (settings.budgetCustom || []).filter((c) => !droppedCustom.includes(c.id)),
      budgetPrefs: { ...prefs, pinnedSession: pin },
    });
  };
  // finalise a session: freeze its jobs (pin booked ones, snapshot riders) so the
  // engine never reshuffles it; it shows read-only with a "definitief" badge.
  // snapshot the session's jobs (separate from the user's own pins, so unlock
  // never wipes a hand-pinned job). pinnedSession is left untouched.
  const lockSession = (s) => {
    const lockedJobs = s.entries.filter((e) => !e.rider).map((e) => e.job.id);
    const lockedRiders = s.entries.filter((e) => e.rider).map((e) => e.job.id);
    set('budgetSessions', sessions.map((x) => (x.id === s.id ? { ...x, locked: true, lockedJobs, lockedRiders } : x)));
  };
  const unlockSession = (s) => set('budgetSessions', sessions.map((x) => (x.id === s.id ? { ...x, locked: false, lockedJobs: [], lockedRiders: [] } : x)));

  // ---- job preferences (exclude / pin-to-session / force-past-block) ----
  const prefs = settings.budgetPrefs || {};
  const setPrefs = (patch) => set('budgetPrefs', { ...prefs, ...patch });
  const setMap = (key, id, value) => {
    const m = { ...(prefs[key] || {}) };
    if (value == null) delete m[id]; else m[id] = value;
    setPrefs({ [key]: m });
  };
  const exclude = (id) => setMap('excluded', id, true);
  const restore = (id) => setMap('excluded', id, null);
  const pinTo = (id, sessionId) => setMap('pinnedSession', id, sessionId || null);
  const force = (id) => setMap('forced', id, true);

  // ---- price edit (catalog job → costOverride; custom job → its own cost) ----
  const setCost = (id, val) => {
    if (id.startsWith('custom:')) {
      const cid = id.slice(7);
      set('budgetCustom', (settings.budgetCustom || []).map((c) => (c.id === cid ? { ...c, cost: val === '' ? '' : Number(val) } : c)));
    } else {
      setMap('costOverride', id, val === '' ? null : Number(val));
    }
  };

  // ---- custom user lines (CarPlay, door panels, …) ----
  const [draft, setDraft] = useState({}); // sessionId -> {name,cost}
  const setField = (sid, field, value) => setDraft((d) => ({ ...d, [sid]: { ...(d[sid] || {}), [field]: value } }));
  const addCustom = (sid) => {
    const d = draft[sid] || {};
    if (!d.name?.trim()) return;
    const cid = newId();
    setSettings({
      ...settings,
      budgetCustom: [...(settings.budgetCustom || []), { id: cid, name: d.name.trim(), cost: Number(d.cost) || 0 }],
      budgetPrefs: { ...prefs, pinnedSession: { ...(prefs.pinnedSession || {}), [`custom:${cid}`]: sid } },
    });
    setDraft((dd) => ({ ...dd, [sid]: { name: '', cost: '' } }));
  };
  const removeCustom = (fullId) => {
    const cid = fullId.slice(7);
    const pin = { ...(prefs.pinnedSession || {}) }; delete pin[fullId];
    const exc = { ...(prefs.excluded || {}) }; delete exc[fullId];
    setSettings({
      ...settings,
      budgetCustom: (settings.budgetCustom || []).filter((c) => c.id !== cid),
      budgetPrefs: { ...prefs, pinnedSession: pin, excluded: exc },
    });
  };

  const title = (job) => (job.title ? (job.title.nl || job.title.en) : tItem(t, job.memberNames[0]));
  const whyLine = (job) => {
    if (job.reason === REASON.COMBINE) return t('budget.why.combine');
    if (job.members.length === 1 && km) return formatMaintenanceStatus(job.members[0], km, new Date(), t);
    return t(`budget.why.${job.reason}`, { defaultValue: '' });
  };

  const JobBody = ({ job }) => (
    <>
      <div className="bp-job-top">
        {!job.custom && <span className={`bp-urgency ${URGENCY_CLS[job.urgency]}`}>{t(`budget.urgency.${job.urgency}`)}</span>}
        <span className="bp-job-title">{title(job)}</span>
        <span className="bp-job-cost">{eur(job.cost)}</span>
      </div>
      {job.members.length > 1 && (
        <div className="bp-job-members">{job.memberNames.map((n) => tItem(t, n)).join(' · ')}</div>
      )}
      <div className="bp-reasons">
        <span className={`bp-reason-chip ${REASON_CLS[job.reason] || ''}`}>{t(`budget.reason.${job.reason}`)}</span>
        {job.forced && <span className="bp-reason-chip r-manual">{t('budget.forced')}</span>}
      </div>
      <div className="bp-job-why">{whyLine(job)}</div>
      {job.reasonKey === 'oilCombine' && <div className="bp-job-reason">🛢️ {t('budget.oilCombineReason')}</div>}
      {job.cannotWait && <div className="bp-job-reason bp-warn">⚠️ {t('budget.cannotWait')}</div>}
      {job.cardWarnings?.map((w, i) => (
        <div key={i} className="bp-job-reason bp-warn">⚠️ {t(`budget.cardWarn.${w.type}`)}</div>
      ))}
      {job.blockReasons?.map((b, i) => (
        <div key={i} className="bp-job-reason">🚧 {t(`budget.block.${b.type}`)}</div>
      ))}
      {job.diagnosisGated && !job.forced && <div className="bp-job-reason">🔬 {t('budget.diagnosisGate')}</div>}
    </>
  );

  // move-to-session dropdown + price edit + exclude, shown under a job.
  // sessionId set → show a "Vastzetten" toggle that pins this job to the session
  // so it survives budget changes / reshuffles (won't get dropped).
  const JobCtl = ({ job, extra, sessionId }) => (
    <div className="bp-job-ctl">
      {sessionId && ((prefs.pinnedSession || {})[job.id] === sessionId
        ? <button type="button" className="bp-link bp-pin-on" onClick={() => pinTo(job.id, null)}>📌 {t('budget.pinnedHere')}</button>
        : <button type="button" className="bp-link" onClick={() => pinTo(job.id, sessionId)}>📌 {t('budget.pinHere')}</button>)}
      <label className="bp-move">
        {t('budget.moveTo')}
        <select value={(prefs.pinnedSession || {})[job.id] || ''} onChange={(e) => pinTo(job.id, e.target.value)}>
          <option value="">{t('budget.auto')}</option>
          {plan.sessions.map((s) => (
            <option key={s.id} value={s.id}>{rawById(s.id).name || (s.date ? dateLabel(s.date) : t('budget.undated'))}</option>
          ))}
        </select>
      </label>
      <label className="bp-price" title={t('budget.editPrice')}>
        € <input type="number" className="bp-price-in" value={Math.round(job.cost) || ''} onChange={(e) => setCost(job.id, e.target.value)} />
      </label>
      {job.costEdited && !job.custom && <button type="button" className="bp-link" onClick={() => setCost(job.id, '')}>{t('budget.resetPrice')}</button>}
      {extra}
      {job.custom
        ? <button type="button" className="bp-link bp-link-del" onClick={() => removeCustom(job.id)}>{t('budget.removeCustom')}</button>
        : <button type="button" className="bp-link bp-link-del" onClick={() => exclude(job.id)}>{t('budget.exclude')}</button>}
    </div>
  );

  const hasSessions = plan.sessions.length > 0;
  const anyLocked = plan.sessions.some((s) => s.locked);
  const showAdvice = prefs.showAdvice ?? !anyLocked; // once something's final, hide the rest by default
  const adviceCount = plan.unplanned.length + plan.blocked.length + plan.inspect.length + plan.excluded.length;

  return (
    <div className="budget-page">
      <h1 className="page-title">{t('budget.title')}</h1>

      <div className="card bp-settings">
        <div className="bp-field">
          <label>{t('budget.currentBudget')}</label>
          <input type="number" value={settings.currentBudget ?? ''} onChange={num('currentBudget')} placeholder="0" />
        </div>
        <div className="bp-field">
          <label>{t('budget.monthlyContribution')}</label>
          <input type="number" value={settings.monthlyContribution ?? ''} onChange={num('monthlyContribution')} placeholder="0" />
        </div>
        <div className="bp-field">
          <label>{t('budget.safetyBuffer')}</label>
          <input type="number" value={settings.safetyBuffer ?? ''} onChange={num('safetyBuffer')} placeholder="200" />
        </div>
      </div>

      {plan.summary.noBuffer && <div className="bp-banner bp-warn">⚠️ {t('budget.noBufferWarning')}</div>}

      <div className="bp-summary">
        <div className="bp-sum-card"><span>{t('budget.availableNow')}</span><strong>{eur(plan.summary.availableNow)}</strong></div>
        <div className="bp-sum-card"><span>{t('budget.monthlySaving')}</span><strong>{eur(plan.summary.monthly)}</strong></div>
        <div className="bp-sum-card"><span>{t('budget.totalCost')}</span><strong>{eur(plan.summary.totalCost)}</strong></div>
      </div>

      {!km && <p className="empty-state">{t('budget.needMileage')}</p>}

      {/* ---- planning sessions ---- */}
      <div className="bp-appt-head">
        <h3 className="section-title">{t('budget.sessions')}</h3>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => addSession()}>+ {t('budget.addSession')}</button>
      </div>
      <p className="bp-advice">{t('budget.sessionsHint')}</p>

      {km && !hasSessions && <p className="empty-state">{t('budget.noSessions')}</p>}

      {plan.sessions.map((s) => {
        const raw = rawById(s.id);
        return (
          <div key={s.id} className={`card bp-month${s.locked ? ' bp-month-locked' : ''}`}>
            {s.locked ? (
              <div className="bp-session-title">🔒 {raw.name || (s.date ? dateLabel(s.date) : t('budget.undated'))}</div>
            ) : (
              <input
                type="text" className="bp-session-name" placeholder={t('budget.namePlaceholder')}
                value={raw.name ?? ''} onChange={(e) => updateSession(s.id, { name: e.target.value })}
              />
            )}
            <div className="bp-session-bar">
              {s.locked ? (
                <span className="bp-locked-date">{s.date ? dateLabel(s.date) : t('budget.noDateYet')}</span>
              ) : (
                <input type="date" className="bp-appt-date" value={raw.date || ''} onChange={(e) => updateSession(s.id, { date: e.target.value })} />
              )}
              {s.locked ? (
                <>
                  <button type="button" className="bp-link bp-unlock-btn" onClick={() => unlockSession(s)}>{t('budget.unlock')}</button>
                  <button type="button" className="bp-del-block" onClick={() => removeSession(s.id)} title={t('budget.removeSession')}>🗑 {t('budget.deleteBlock')}</button>
                </>
              ) : (
                <>
                  <button type="button" className="bp-link bp-lock-btn" onClick={() => lockSession(s)}>🔒 {t('budget.lockSession')}</button>
                  <button type="button" className="bp-del-block" onClick={() => removeSession(s.id)} title={t('budget.removeSession')}>🗑 {t('budget.deleteBlock')}</button>
                </>
              )}
            </div>
            {!s.locked && (
              <input
                type="number" className="bp-session-money"
                placeholder={`${t('budget.projected')}: ${eur(s.money)}`}
                value={raw.money ?? ''} onChange={(e) => updateSession(s.id, { money: e.target.value })}
              />
            )}
            {s.locked
              ? (raw.note ? <div className="bp-note-static">{raw.note}</div> : null)
              : (
                <input
                  type="text" className="bp-appt-note" placeholder={t('budget.notePlaceholder')}
                  value={raw.note ?? ''} onChange={(e) => updateSession(s.id, { note: e.target.value })}
                />
              )}
            {!s.locked && (
              <label className="bp-toggle bp-manual-toggle">
                <input type="checkbox" checked={!!s.manual} onChange={(e) => updateSession(s.id, { manual: e.target.checked })} />
                {t('budget.manualMode')}
              </label>
            )}
            <div className="bp-month-sub">
              {s.locked && <span className="bp-final-badge">✓ {t('budget.final')}</span>}
              {s.overridden ? t('budget.youHave', { amount: eur(s.money) }) : t('budget.projectedPot', { amount: eur(s.money) })}
              {' · '}{t('budget.spent', { amount: eur(s.cost) })}
              {' · '}<strong className={s.left < 0 ? 'bp-neg' : 'bp-pos'}>{t('budget.left', { amount: eur(s.left) })}</strong>
            </div>

            {s.entries.length === 0
              ? <div className="bp-bucket-empty">{t(s.manual ? 'budget.manualEmpty' : 'budget.sessionEmpty')}</div>
              : s.entries.map((e) => (e.rider ? (
                <div key={e.job.id} className="bp-job bp-job-rider">
                  <div className="bp-job-top">
                    <span className="bp-rider-tag">🔍 {t('budget.checkAlong')}</span>
                    <span className="bp-job-title">{title(e.job)}</span>
                    <span className="bp-job-cost bp-cost-muted">{t('budget.ifReplaced', { amount: eur(e.job.cost) })}</span>
                  </div>
                  {e.withName && <div className="bp-job-why">{t('budget.riderWhy', { name: tItem(t, e.withName) })}</div>}
                  {!s.locked && (
                    <div className="bp-job-ctl">
                      <button type="button" className="bp-link bp-pin-on" onClick={() => pinTo(e.job.id, s.id)} title={t('budget.pinRiderHint')}>📌 {t('budget.pinHere')}</button>
                      <button type="button" className="bp-link bp-link-del" onClick={() => exclude(e.job.id)}>{t('budget.exclude')}</button>
                    </div>
                  )}
                </div>
              ) : (
                <div key={e.job.id} className={`bp-job${e.pinned ? ' bp-job-pinned' : ''}`}>
                  <JobBody job={e.job} />
                  {e.shortfall > 0 && (
                    <div className="bp-job-reason bp-warn">💰 {t('budget.sessionShort', { amount: eur(e.shortfall) })}</div>
                  )}
                  {!s.locked && <JobCtl job={e.job} sessionId={s.id} />}
                </div>
              )))}

            {!s.locked && (
              <>
                <select className="bp-add-job" value="" onChange={(e) => e.target.value && pinTo(e.target.value, s.id)}>
                  <option value="">+ {t('budget.addJob')}</option>
                  {plan.catalog
                    .filter((j) => !s.entries.some((e) => e.job.id === j.id))
                    .map((j) => <option key={j.id} value={j.id}>{title(j)} · {eur(j.cost)}</option>)}
                </select>
                <div className="bp-custom-add">
                  <input
                    type="text" className="bp-custom-name" placeholder={t('budget.customName')}
                    value={draft[s.id]?.name ?? ''} onChange={(e) => setField(s.id, 'name', e.target.value)}
                  />
                  <input
                    type="number" className="bp-custom-cost" placeholder="€"
                    value={draft[s.id]?.cost ?? ''} onChange={(e) => setField(s.id, 'cost', e.target.value)}
                  />
                  <button type="button" className="bp-link" onClick={() => addCustom(s.id)} disabled={!draft[s.id]?.name?.trim()}>
                    + {t('budget.addCustom')}
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })}

      {/* once a session is final, the rest collapses behind a toggle */}
      {anyLocked && adviceCount > 0 && (
        <button type="button" className="bp-advice-toggle" onClick={() => setPrefs({ showAdvice: !showAdvice })}>
          {showAdvice ? t('budget.hideAdvice') : t('budget.showAdvice', { count: adviceCount })}
        </button>
      )}

      {showAdvice && (<>
      {/* ---- not yet planned (no session fits) ---- */}
      {plan.unplanned.length > 0 && (
        <div className="card bp-section bp-section-warn">
          <h3 className="section-title">🗓️ {t('budget.unplanned')}</h3>
          {plan.unplanned.map((u) => (
            <div key={u.job.id} className="bp-job">
              <JobBody job={u.job} />
              <div className="bp-job-reason">
                {u.earliestDate
                  ? `💡 ${t('budget.affordableAround', { date: dateLabel(u.earliestDate) })}`
                  : `💰 ${t('budget.raiseBudget')}`}
              </div>
              <JobCtl
                job={u.job}
                extra={u.earliestDate && (
                  <button type="button" className="bp-link" onClick={() => addSession(ymd(u.earliestDate))}>
                    + {t('budget.makeSessionHere')}
                  </button>
                )}
              />
            </div>
          ))}
        </div>
      )}

      {km && hasSessions && plan.unplanned.length === 0 && plan.summary.scheduledCount > 0
        && plan.sessions.every((s) => s.entries.length === 0) && (
        <p className="empty-state">{t('budget.allUnassigned')}</p>
      )}

      {/* ---- blocked: diagnosis / prerequisite ---- */}
      {plan.blocked.length > 0 && (
        <div className="card bp-section">
          <h3 className="section-title">🚧 {t('budget.blockedSection')}</h3>
          {plan.blocked.map((job) => (
            <div key={job.id} className="bp-job">
              <JobBody job={job} />
              <div className="bp-job-ctl">
                <button type="button" className="bp-link" onClick={() => force(job.id)}>{t('budget.planAnyway')}</button>
                <button type="button" className="bp-link bp-link-del" onClick={() => exclude(job.id)}>{t('budget.exclude')}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---- inspection: check first, no spend yet ---- */}
      {plan.inspect.length > 0 && (
        <div className="card bp-section">
          <h3 className="section-title">🔍 {t('budget.inspectSection')}</h3>
          {plan.inspect.map((job) => (
            <div key={job.id} className="bp-job">
              <div className="bp-job-top">
                <span className={`bp-urgency ${URGENCY_CLS[job.urgency]}`}>{t(`budget.urgency.${job.urgency}`)}</span>
                <span className="bp-job-title">{title(job)}</span>
                <span className="bp-job-cost bp-cost-muted">{t('budget.ifReplaced', { amount: eur(job.cost) })}</span>
              </div>
              <div className="bp-job-why">{whyLine(job)}</div>
              <JobCtl job={job} />
            </div>
          ))}
        </div>
      )}

      {/* monitor-only items are intentionally NOT shown on budget — they live on
          the maintenance page; budget = spend planning, monitor = don't spend yet */}

      {/* ---- excluded by user ---- */}
      {plan.excluded.length > 0 && (
        <div className="card bp-section bp-section-muted">
          <h3 className="section-title">{t('budget.excludedSection')}</h3>
          {plan.excluded.map((job) => (
            <div key={job.id} className="bp-excluded-row">
              <span>{title(job)} · {eur(job.cost)}</span>
              <button type="button" className="bp-link" onClick={() => restore(job.id)}>{t('budget.restore')}</button>
            </div>
          ))}
        </div>
      )}
      </>)}
    </div>
  );
}
