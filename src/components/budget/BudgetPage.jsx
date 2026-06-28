import { useMemo, useState, useEffect } from 'react';
import { Reorder as MotionReorder, useDragControls } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { buildBudgetPlan, REASON } from '../../utils/budgetPlan';
import { formatMaintenanceStatus } from '../../utils/statusFormat';
import { generateBudgetReport, copyToClipboard, buildWorkOrderHTML } from '../../utils/dataExport';
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

export default function BudgetPage({ itemsWithStatus, settings = {}, setSettings, vehicle, registerMaintenance }) {
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

  const finishSession = (s) => {
    if (!registerMaintenance) return;
    const raw = rawById(s.id);
    const date = raw.date || new Date().toISOString();
    const mileage = vehicle?.currentMileage || 0;
    
    s.entries.forEach((e) => {
      if (e.job.custom) return;
      
      // A job can have multiple members (e.g. bundles).
      // Record the total cost on the first member, and 0 on the rest to reset their timers.
      (e.job.members || []).forEach((memberItem, index) => {
        registerMaintenance(memberItem.id, {
          type: 'service',
          result: e.job.check ? 'checked' : 'replaced',
          cost: index === 0 ? e.job.cost : 0,
          date,
          mileage,
          garage: 'BimmerCare',
          notes: raw.note || ''
        });
      });
    });
    
    removeSession(s.id);
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
  // ---- manual job order within a session (display-only, engine untouched) ----
  // prefs.jobOrder = { [sessionId]: [jobId, ...] }.
  const orderEntries = (sid, entries) => {
    const ord = (prefs.jobOrder || {})[sid];
    if (!ord) return entries;
    const idx = (id) => { const i = ord.indexOf(id); return i === -1 ? Infinity : i; };
    return [...entries].sort((a, b) => idx(a.job.id) - idx(b.job.id)); // stable: unknown → end
  };
  const reorderMove = (sid, orderIds, id, dir) => {
    const ids = [...orderIds]; const i = ids.indexOf(id); const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    setMap('jobOrder', sid, ids);
  };
  const handleReorder = (sid, newOrderIds) => {
    // newOrderIds contains just the subset of IDs that were reordered (e.g. actions or checks).
    // We merge this with the existing jobOrder so we don't wipe out the other group's order.
    const currentOrd = (prefs.jobOrder || {})[sid] || [];
    const merged = [...new Set([...newOrderIds, ...currentOrd])];
    setMap('jobOrder', sid, merged);
  };

  const exclude = (id) => setMap('excluded', id, true);
  const restore = (id) => setMap('excluded', id, null);
  const pinTo = (id, sessionId) => setMap('pinnedSession', id, sessionId || null);
  const force = (id) => setMap('forced', id, true);
  // "alvast checken": add a monitor/inspection item to a session as a €0 check
  const addToCheck = (id, sid) => setMap('checkSession', id, sid);
  const clearCheck = (id) => setMap('checkSession', id, null);
  // upgrade a check to a real booked job (pin) and drop the check flag, in one write
  const bookCheck = (id, sid) => {
    const cs = { ...(prefs.checkSession || {}) }; delete cs[id];
    setPrefs({ pinnedSession: { ...(prefs.pinnedSession || {}), [id]: sid }, checkSession: cs });
  };

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
      budgetCustom: [...(settings.budgetCustom || []), { id: cid, name: d.name.trim(), cost: Number(d.cost) || 0, check: !!d.check }],
      budgetPrefs: { ...prefs, pinnedSession: { ...(prefs.pinnedSession || {}), [`custom:${cid}`]: sid } },
    });
    setDraft((dd) => ({ ...dd, [sid]: { name: '', cost: '', check: false } }));
  };
  // flip a custom task between "vervangen" (booked) and "alleen controleren" (assess)
  const toggleCustomCheck = (fullId) => {
    const cid = fullId.slice(7);
    set('budgetCustom', (settings.budgetCustom || []).map((c) => (c.id === cid ? { ...c, check: !c.check } : c)));
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
        {job.check && <span className="bp-reason-chip r-monitor">🔍 {t('budget.customCheckChip')}</span>}
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

  // drag handle (desktop) + ▲▼ buttons (touch) to set a logical order in a session
  const JobReorderControls = ({ sid, id, orderIds, controls }) => (orderIds.length > 1 ? (
    <span className="bp-reorder">
      <span
        className="bp-drag-handle bp-drag-motion" title={t('budget.dragHint')}
        onPointerDown={(e) => controls.start(e)}
        style={{ touchAction: 'none' }}
      >⠿</span>
      <button type="button" className="bp-ord-btn" onClick={() => reorderMove(sid, orderIds, id, -1)} disabled={orderIds[0] === id} aria-label={t('budget.moveUp')}>▲</button>
      <button type="button" className="bp-ord-btn" onClick={() => reorderMove(sid, orderIds, id, 1)} disabled={orderIds[orderIds.length - 1] === id} aria-label={t('budget.moveDown')}>▼</button>
    </span>
  ) : null);

  // move-to-session dropdown + price edit + exclude, shown under a job.
  // sessionId set → show a "Vastzetten" toggle that pins this job to the session
  // so it survives budget changes / reshuffles (won't get dropped).
  const JobCtl = ({ job, extra, sessionId, orderIds, controls }) => (
    <div className="bp-job-ctl">
      {sessionId && orderIds && <JobReorderControls sid={sessionId} id={job.id} orderIds={orderIds} controls={controls} />}
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
      {/* clean "out of this visit" for a job the user pinned here — unpins back to
          available (reappears in the picker), no deletion list */}
      {sessionId && !job.custom && (prefs.pinnedSession || {})[job.id] === sessionId && (
        <button type="button" className="bp-link" onClick={() => pinTo(job.id, null)}>× {t('budget.removeFromSession')}</button>
      )}
      {job.custom && (
        <button type="button" className="bp-link" onClick={() => toggleCustomCheck(job.id)} title={t('budget.customCheckHint')}>
          {job.check ? `🔧 ${t('budget.customMakeReplace')}` : `🔍 ${t('budget.customMakeCheck')}`}
        </button>
      )}
      {job.custom
        ? <button type="button" className="bp-link bp-link-del" onClick={() => removeCustom(job.id)}>{t('budget.removeCustom')}</button>
        : <button type="button" className="bp-link bp-link-del" onClick={() => exclude(job.id)}>{t('budget.exclude')}</button>}
    </div>
  );

  // a check entry = a free ride-along rider OR a custom flagged "alleen controleren";
  // those go in the "Controle / inspectie" group, booked work in "Wordt uitgevoerd"
  const isCheckEntry = (e) => e.rider || e.job.check;

  // free-text extension on a check entry ("+ sensor") to widen the inspection;
  // stored per job in prefs.jobNote, echoed on print + in the copy report
  const setNote = (id, val) => setMap('jobNote', id, val === '' ? null : val);
  const NoteRow = ({ id, locked }) => {
    const note = (prefs.jobNote || {})[id] || '';
    if (locked) return note ? <div className="bp-job-note-static">📝 {note}</div> : null;
    return (
      <input
        type="text" className="bp-job-note" placeholder={t('budget.jobNotePlaceholder')}
        value={note} onChange={(ev) => setNote(id, ev.target.value)}
      />
    );
  };

  const MotionGroup = ({ items, sid, locked }) => {
    const [localIds, setLocalIds] = useState(items.map((e) => e.job.id));
    
    // Sync localIds if items change from outside (e.g. adding a new job)
    useEffect(() => {
      setLocalIds(items.map((e) => e.job.id));
    }, [items]);

    const byId = useMemo(() => new Map(items.map((e) => [e.job.id, e])), [items]);

    const finishDrag = () => {
      handleReorder(sid, localIds);
    };

    return (
      <MotionReorder.Group axis="y" values={localIds} onReorder={setLocalIds} className="bp-reorder-group">
        {localIds.map((id) => {
          const e = byId.get(id);
          if (!e) return null;
          return (
            <MotionEntry
              key={id}
              e={e}
              sid={sid}
              locked={locked}
              orderIds={localIds}
              onDragEnd={finishDrag}
            />
          );
        })}
      </MotionReorder.Group>
    );
  };

  // one entry row (rider or normal job). orderIds = the group it lives in, so
  // drag/▲▼ reorder stay within actions or within checks, never cross.
  const MotionEntry = ({ e, sid, locked, orderIds, onDragEnd }) => {
    const controls = useDragControls();
    return (
      <MotionReorder.Item
        value={e.job.id}
        dragListener={false}
        dragControls={controls}
        className="bp-motion-item"
        onDragEnd={onDragEnd}
      >
        {e.rider ? (
          <div className="bp-job bp-job-rider">
            <div className="bp-job-top">
              <span className="bp-rider-tag">🔍 {t(e.check ? 'budget.checkTag' : 'budget.checkAlong')}</span>
              <span className="bp-job-title">{title(e.job)}</span>
              <span className="bp-job-cost bp-cost-muted">{t('budget.ifReplaced', { amount: eur(e.job.cost) })}</span>
            </div>
            {e.withName && <div className="bp-job-why">{t('budget.riderWhy', { name: tItem(t, e.withName) })}</div>}
            {!locked && (
              <div className="bp-job-ctl">
                <JobReorderControls sid={sid} id={e.job.id} orderIds={orderIds} controls={controls} />
                {e.check ? (
                  <>
                    <button type="button" className="bp-link bp-pin-on" onClick={() => bookCheck(e.job.id, sid)} title={t('budget.pinRiderHint')}>📌 {t('budget.bookCheck')}</button>
                    <button type="button" className="bp-link" onClick={() => clearCheck(e.job.id)}>× {t('budget.removeFromSession')}</button>
                  </>
                ) : (
                  <>
                    <button type="button" className="bp-link bp-pin-on" onClick={() => pinTo(e.job.id, sid)} title={t('budget.pinRiderHint')}>📌 {t('budget.pinHere')}</button>
                    <button type="button" className="bp-link bp-link-del" onClick={() => exclude(e.job.id)}>{t('budget.exclude')}</button>
                  </>
                )}
              </div>
            )}
            <NoteRow id={e.job.id} locked={locked} />
          </div>
        ) : (
          <div className={`bp-job${e.pinned ? ' bp-job-pinned' : ''}`}>
            <JobBody job={e.job} />
            {e.shortfall > 0 && (
              <div className="bp-job-reason bp-warn">💰 {t('budget.sessionShort', { amount: eur(e.shortfall) })}</div>
            )}
            {!locked && <JobCtl job={e.job} sessionId={sid} orderIds={orderIds} controls={controls} />}
            {e.job.check && <NoteRow id={e.job.id} locked={locked} />}
          </div>
        )}
      </MotionReorder.Item>
    );
  };

  // ---- ideas scratchpad (free notes, collapsed, don't fill the screen) ----
  const ideas = settings.budgetIdeas || [];
  const [ideaDraft, setIdeaDraft] = useState('');
  const [ideasOpen, setIdeasOpen] = useState(false);
  const addIdea = () => {
    const text = ideaDraft.trim();
    if (!text) return;
    set('budgetIdeas', [...ideas, { id: newId(), text, createdAt: new Date().toISOString() }]);
    setIdeaDraft('');
  };
  const removeIdea = (id) => set('budgetIdeas', ideas.filter((i) => i.id !== id));
  // park a whole block as an idea: snapshot its name + jobs to the ideas list,
  // then remove the session (unpinning its jobs back to available, same as delete).
  // The snapshot carries enough structure (session fields + pinned job ids + the
  // custom lines that lived in it) to rebuild the block later via ideaToSession.
  const sessionToIdea = (s) => {
    const raw = rawById(s.id);
    const name = raw.name || (s.date ? dateLabel(s.date) : t('budget.undated'));
    const jobs = s.entries.map((e) => title(e.job)).join(' · ');
    const text = jobs ? `${name}: ${jobs}` : name;
    const pin = { ...(prefs.pinnedSession || {}) };
    const jobIds = [];
    const droppedCustom = [];
    const allCustom = settings.budgetCustom || [];
    Object.keys(pin).forEach((jid) => {
      if (pin[jid] === s.id) {
        jobIds.push(jid);
        delete pin[jid];
        if (jid.startsWith('custom:')) droppedCustom.push(jid.slice(7));
      }
    });
    const snapshot = {
      name: raw.name || '', date: raw.date || '', money: raw.money || '', note: raw.note || '', manual: !!raw.manual,
      jobIds,
      custom: allCustom.filter((c) => droppedCustom.includes(c.id)),
    };
    setSettings({
      ...settings,
      budgetIdeas: [...ideas, { id: newId(), text, createdAt: new Date().toISOString(), snapshot }],
      budgetSessions: sessions.filter((x) => x.id !== s.id),
      budgetCustom: allCustom.filter((c) => !droppedCustom.includes(c.id)),
      budgetPrefs: { ...prefs, pinnedSession: pin },
    });
    setIdeasOpen(true);
  };
  // restore a parked idea back into a real planning session: rebuild the block,
  // re-add its custom lines, re-pin its jobs, then drop the idea.
  const ideaToSession = (idea) => {
    const snap = idea.snapshot;
    if (!snap) return;
    const sid = newId();
    const pin = { ...(prefs.pinnedSession || {}) };
    (snap.jobIds || []).forEach((jid) => { pin[jid] = sid; });
    const existingCustom = settings.budgetCustom || [];
    const customToAdd = (snap.custom || []).filter((c) => !existingCustom.some((e) => e.id === c.id));
    setSettings({
      ...settings,
      budgetSessions: [...sessions, { id: sid, name: snap.name, date: snap.date, money: snap.money, note: snap.note, manual: snap.manual }],
      budgetCustom: [...existingCustom, ...customToAdd],
      budgetIdeas: ideas.filter((i) => i.id !== idea.id),
      budgetPrefs: { ...prefs, pinnedSession: pin },
    });
  };

  // print an A4 work order for the mechanic (opens a clean print window)
  const printSession = (s) => {
    // print in the user's manual order (same as on screen), not engine priority
    const ordered = { ...s, entries: orderEntries(s.id, s.entries) };
    const html = buildWorkOrderHTML(ordered, rawById(s.id), vehicle, t, (n) => tItem(t, n), new Date(), prefs.jobNote || {});
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
  };

  // copy a readable plan brief to the clipboard for a ChatGPT second opinion
  const [copied, setCopied] = useState(false);
  const copyReport = async () => {
    const ok = await copyToClipboard(generateBudgetReport(plan, settings, vehicle, t, new Date()));
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2500); }
  };

  const hasSessions = plan.sessions.length > 0;
  const anyLocked = plan.sessions.some((s) => s.locked);
  const showAdvice = prefs.showAdvice ?? !anyLocked; // once something's final, hide the rest by default
  const adviceCount = plan.unplanned.length + plan.blocked.length + plan.inspect.length + plan.excluded.length;

  const toggleCollapse = (sid) => {
    setSettings({
      ...settings,
      budgetPrefs: { ...prefs, collapsedSessions: { ...(prefs.collapsedSessions || {}), [sid]: !(prefs.collapsedSessions || {})[sid] } }
    });
  };

  return (
    <div className="budget-page">
      <div className="bp-page-head">
        <h1 className="page-title">{t('budget.title')}</h1>
        {km && anyLocked && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={copyReport} title={t('budget.copyLockedHint')}>
            {copied ? `✓ ${t('budget.copied')}` : t('budget.copyForChatGPT')}
          </button>
        )}
      </div>

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
        const ordered = orderEntries(s.id, s.entries);
        return (
          <div key={s.id} className={`card bp-month${s.locked ? ' bp-month-locked' : ''}`}>
            {s.locked ? (
              <div className="bp-session-title" onClick={() => toggleCollapse(s.id)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <span style={{ marginRight: '8px', fontSize: '0.8em', opacity: 0.6 }}>
                  {(prefs.collapsedSessions || {})[s.id] ? '▶' : '▼'}
                </span>
                🔒 {raw.name || (s.date ? dateLabel(s.date) : t('budget.undated'))}
              </div>
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
                  <button type="button" className="bp-link" onClick={() => printSession(s)} title={t('budget.printHint')}>🖨️ {t('budget.print')}</button>
                  <button type="button" className="bp-link" onClick={() => sessionToIdea(s)} title={t('budget.toIdeasHint')}>💡 {t('budget.toIdeas')}</button>
                  <button type="button" className="bp-del-block" onClick={() => finishSession(s)} title={t('budget.finishSessionHint', 'Afgerond en kosten registreren')}>✅ {t('budget.finishSession', 'Afronden')}</button>
                  <button type="button" className="bp-del-block" onClick={() => removeSession(s.id)} title={t('budget.removeSession')}>🗑</button>
                </>
              ) : (
                <>
                  <button type="button" className="bp-link bp-lock-btn" onClick={() => lockSession(s)}>🔒 {t('budget.lockSession')}</button>
                  <button type="button" className="bp-link" onClick={() => printSession(s)} title={t('budget.printHint')}>🖨️ {t('budget.print')}</button>
                  <button type="button" className="bp-link" onClick={() => sessionToIdea(s)} title={t('budget.toIdeasHint')}>💡 {t('budget.toIdeas')}</button>
                  <button type="button" className="bp-del-block" onClick={() => removeSession(s.id)} title={t('budget.removeSession')}>🗑 {t('budget.deleteBlock')}</button>
                </>
              )}
            </div>
            {!s.locked && (
              <input
                type="number" className="bp-session-money"
                placeholder={`${t('budget.projected')}: ${eur(s.pot)}`}
                value={raw.money ?? ''} onChange={(e) => updateSession(s.id, { money: e.target.value })}
              />
            )}
            {s.locked
              ? (!((prefs.collapsedSessions || {})[s.id]) && raw.note ? <div className="bp-note-static">{raw.note}</div> : null)
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
              {s.overridden ? t('budget.youHave', { amount: eur(s.money) }) : t('budget.projectedPot', { amount: eur(s.pot) })}
              {' · '}{t('budget.spent', { amount: eur(s.cost) })}
              {' · '}<strong className={s.left < 0 ? 'bp-neg' : 'bp-pos'}>{t('budget.left', { amount: eur(s.left) })}</strong>
            </div>

            {s.entries.length === 0 ? (
              <div className="bp-bucket-empty">{t(s.manual ? 'budget.manualEmpty' : 'budget.sessionEmpty')}</div>
            ) : (() => {
              if (s.locked && (prefs.collapsedSessions || {})[s.id]) return null;
              
              const actions = ordered.filter((e) => !isCheckEntry(e));
              const checks = ordered.filter((e) => isCheckEntry(e));
              return (
                <>
                  {actions.length > 0 && (
                    <div className="bp-group">
                      <div className="bp-group-head bp-group-action">🔧 {t('budget.groupActions')}</div>
                      <MotionGroup items={actions} sid={s.id} locked={s.locked} />
                    </div>
                  )}
                  {checks.length > 0 && (
                    <div className="bp-group">
                      <div className="bp-group-head bp-group-check">🔍 {t('budget.groupChecks')}</div>
                      <MotionGroup items={checks} sid={s.id} locked={s.locked} />
                    </div>
                  )}
                </>
              );
            })()}


            {!s.locked && (
              <>
                <select className="bp-add-job" value="" onChange={(e) => e.target.value && pinTo(e.target.value, s.id)}>
                  <option value="">+ {t('budget.addJob')}</option>
                  {plan.catalog
                    .filter((j) => !s.entries.some((e) => e.job.id === j.id))
                    .map((j) => <option key={j.id} value={j.id}>{title(j)} · {eur(j.cost)}</option>)}
                </select>
                {plan.checkCatalog.filter((j) => !s.entries.some((e) => e.job.id === j.id)).length > 0 && (
                  <select className="bp-add-check" value="" onChange={(e) => e.target.value && addToCheck(e.target.value, s.id)}>
                    <option value="">+ {t('budget.addCheck')}</option>
                    {plan.checkCatalog
                      .filter((j) => !s.entries.some((e) => e.job.id === j.id))
                      .map((j) => <option key={j.id} value={j.id}>{title(j)}</option>)}
                  </select>
                )}
                <div className="bp-custom-add">
                  <input
                    type="text" className="bp-custom-name" placeholder={t('budget.customName')}
                    value={draft[s.id]?.name ?? ''} onChange={(e) => setField(s.id, 'name', e.target.value)}
                  />
                  <input
                    type="number" className="bp-custom-cost" placeholder="€"
                    value={draft[s.id]?.cost ?? ''} onChange={(e) => setField(s.id, 'cost', e.target.value)}
                  />
                  <label className="bp-custom-check" title={t('budget.customCheckHint')}>
                    <input
                      type="checkbox" checked={!!draft[s.id]?.check}
                      onChange={(e) => setField(s.id, 'check', e.target.checked)}
                    />
                    🔍 {t('budget.customCheckChip')}
                  </label>
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

      {/* ---- ideas scratchpad — collapsed, sits at the very bottom ---- */}
      <div className="card bp-section bp-ideas">
        <button type="button" className="bp-ideas-head" onClick={() => setIdeasOpen((o) => !o)}>
          <span>{ideasOpen ? '▼' : '▶'} 💡 {t('budget.ideas.title')}</span>
          {ideas.length > 0 && <span className="bp-ideas-count">{ideas.length}</span>}
        </button>
        {ideasOpen && (
          <div className="bp-ideas-body">
            <div className="bp-idea-add">
              <input
                type="text" className="bp-idea-input" placeholder={t('budget.ideas.placeholder')}
                value={ideaDraft} onChange={(e) => setIdeaDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addIdea(); }}
              />
              <button type="button" className="bp-link" onClick={addIdea} disabled={!ideaDraft.trim()}>+ {t('budget.ideas.add')}</button>
            </div>
            {ideas.length === 0
              ? <p className="bp-bucket-empty">{t('budget.ideas.empty')}</p>
              : ideas.map((i) => (
                <div key={i.id} className="bp-idea-row">
                  <span className="bp-idea-text">{i.text}</span>
                  <span className="bp-idea-date">{new Date(i.createdAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}</span>
                  {i.snapshot && (
                    <button type="button" className="bp-link" onClick={() => ideaToSession(i)} title={t('budget.ideas.restoreHint')}>↩ {t('budget.ideas.restore')}</button>
                  )}
                  <button type="button" className="bp-idea-del" onClick={() => removeIdea(i.id)} title={t('budget.ideas.remove')}>🗑</button>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
