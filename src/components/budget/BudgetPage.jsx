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
  [REASON.SAFETY]: 'r-safety', [REASON.APK]: 'r-apk', [REASON.DIAGNOSIS]: 'r-diag',
  [REASON.INTERVAL]: 'r-interval', [REASON.COMBINE]: 'r-combine', [REASON.BUDGET]: 'r-budget',
  [REASON.MANUAL]: 'r-manual', [REASON.BLOCKED_DIAGNOSIS]: 'r-blocked', [REASON.BLOCKED_PREREQ]: 'r-blocked',
};

const newId = () => (globalThis.crypto?.randomUUID?.() || String(Date.now() + Math.random()));

export default function BudgetPage({ itemsWithStatus, settings = {}, setSettings, vehicle }) {
  const { t } = useTranslation();
  const [jobOverrides, setJobOverrides] = useState({});
  const [dragOver, setDragOver] = useState(null); // `${apptId}:${bucket}`

  const plan = useMemo(
    () => buildBudgetPlan(itemsWithStatus, settings, new Date(), jobOverrides),
    [itemsWithStatus, settings, jobOverrides],
  );

  const set = (field, value) => setSettings({ ...settings, [field]: value });
  const num = (field) => (e) => set(field, e.target.value === '' ? '' : Number(e.target.value));
  const eur = (n) => `€${Math.round(n || 0).toLocaleString('nl-NL')}`;
  const km = vehicle?.currentMileage;

  const appts = settings.appointments || [];
  const updateAppt = (id, patch) =>
    set('appointments', appts.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const addAppt = () =>
    set('appointments', [...appts, { id: newId(), date: '', budgetOverride: '', note: '', overrides: {}, focusView: false, allowFull: false }]);
  const removeAppt = (id) => set('appointments', appts.filter((a) => a.id !== id));

  const toggleOverride = (jobId) => setJobOverrides((o) => ({ ...o, [jobId]: !o[jobId] }));

  // drag/drop — moves a job to another bucket for THIS appointment only
  const setJobBucket = (appt, jobId, bucket) => {
    const cur = appt.overrides || {};
    updateAppt(appt.id, { overrides: { ...cur, [jobId]: bucket } });
  };
  const clearJobBucket = (appt, jobId) => {
    const cur = { ...(appt.overrides || {}) };
    delete cur[jobId];
    updateAppt(appt.id, { overrides: cur });
  };

  const whyLine = (job) => {
    if (job.reason === REASON.COMBINE) return t('budget.why.combine');
    if (job.members.length === 1 && km) {
      return formatMaintenanceStatus(job.members[0], km, new Date(), t);
    }
    return t(`budget.why.${job.reason}`, { defaultValue: '' });
  };

  const Job = ({ job, appt }) => (
    <div
      className={`bp-job${job.manual ? ' bp-job-manual' : ''}`}
      draggable
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', job.id); e.dataTransfer.effectAllowed = 'move'; }}
    >
      <div className="bp-job-top">
        <span className={`bp-urgency ${URGENCY_CLS[job.urgency]}`}>{t(`budget.urgency.${job.urgency}`)}</span>
        <span className="bp-job-title">
          {job.title ? (job.title.nl || job.title.en) : tItem(t, job.memberNames[0])}
        </span>
        <span className="bp-job-cost">{eur(job.cost)}</span>
      </div>

      {job.members.length > 1 && (
        <div className="bp-job-members">{job.memberNames.map((n) => tItem(t, n)).join(' · ')}</div>
      )}

      <div className="bp-reasons">
        <span className={`bp-reason-chip ${REASON_CLS[job.reason] || ''}`}>{t(`budget.reason.${job.reason}`)}</span>
        {job.manual && (
          <button type="button" className="bp-reason-chip r-manual bp-manual-clear"
            onClick={() => clearJobBucket(appt, job.id)} title={t('budget.resetAuto')}>
            {t('budget.reason.manual')} ✕
          </button>
        )}
      </div>

      <div className="bp-job-why">{whyLine(job)}</div>

      {job.reasonKey === 'oilCombine' && <div className="bp-job-reason">🛢️ {t('budget.oilCombineReason')}</div>}
      {job.cannotWait && <div className="bp-job-reason bp-warn">⚠️ {t('budget.cannotWait')}</div>}
      {job.cardWarnings?.map((w, i) => (
        <div key={i} className="bp-job-reason bp-warn">⚠️ {t(`budget.cardWarn.${w.type}`)}</div>
      ))}
      {job.forcedByBudget && <div className="bp-job-reason bp-warn">💰 {t('budget.forcedByBudget')}</div>}

      {job.blocked && job.blockReasons.map((b, i) => (
        <div key={i} className="bp-job-reason">🚧 {t(`budget.block.${b.type}`)}</div>
      ))}
      {job.diagnosisGated && <div className="bp-job-reason">🔬 {t('budget.diagnosisGate')}</div>}

      {job.warnings.map((w) => (
        <div key={w} className="bp-job-reason bp-warn">⚠️ {t(`budget.warn.${w}`)}</div>
      ))}

      {job.blocked && !job.manual && (
        <label className="bp-override-local">
          <input type="checkbox" checked={!!jobOverrides[job.id]} onChange={() => toggleOverride(job.id)} />
          {t('budget.overrideLocal')}
        </label>
      )}
    </div>
  );

  const Bucket = ({ appt, bucketKey, label, cls, jobs }) => {
    const over = dragOver === `${appt.id}:${bucketKey}`;
    return (
      <div
        className={`bp-bucket ${cls}${over ? ' bp-bucket-over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(`${appt.id}:${bucketKey}`); }}
        onDragLeave={() => setDragOver((d) => (d === `${appt.id}:${bucketKey}` ? null : d))}
        onDrop={(e) => {
          e.preventDefault();
          const jobId = e.dataTransfer.getData('text/plain');
          setDragOver(null);
          if (jobId) setJobBucket(appt, jobId, bucketKey);
        }}
      >
        <div className="bp-bucket-head">
          <span className="bp-bucket-label">{label}</span>
          <span className="bp-bucket-total">{eur(jobs.reduce((c, j) => c + j.cost, 0))} · {jobs.length}×</span>
        </div>
        {jobs.length === 0
          ? <div className="bp-bucket-empty">{t('budget.dropHere')}</div>
          : jobs.map((j) => <Job key={j.id} job={j} appt={appt} />)}
      </div>
    );
  };

  return (
    <div className="budget-page">
      <h1 className="page-title">{t('budget.title')}</h1>

      {/* budget settings */}
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

      {plan.summary.noBuffer && (
        <div className="bp-banner bp-warn">⚠️ {t('budget.noBufferWarning')}</div>
      )}

      <div className="bp-summary">
        <div className="bp-sum-card"><span>{t('budget.availableNow')}</span><strong>{eur(plan.summary.availableNow)}</strong></div>
        <div className="bp-sum-card"><span>{t('budget.safetyBuffer')}</span><strong>{eur(plan.summary.safetyBuffer)}</strong></div>
        <div className="bp-sum-card"><span>{t('budget.monthlySaving')}</span><strong>{eur(plan.summary.monthly)}</strong></div>
      </div>

      {/* appointments */}
      <div className="bp-appt-head">
        <h3 className="section-title">{t('budget.appointments')}</h3>
        <button type="button" className="btn btn-secondary btn-sm" onClick={addAppt}>+ {t('budget.addAppointment')}</button>
      </div>

      {!km && <p className="empty-state">{t('budget.needMileage')}</p>}
      {appts.length === 0 && <p className="empty-state">{t('budget.noAppointments')}</p>}

      {plan.appointments.map((a) => {
        const focus = !!a.focusView;
        return (
          <div key={a.id} className="card bp-appt">
            <div className="bp-appt-bar">
              <input type="date" className="bp-appt-date" value={a.date} onChange={(e) => updateAppt(a.id, { date: e.target.value })} />
              <span className="bp-appt-budget">{t('budget.expectedBudget')}: <strong>{eur(a.budget)}</strong></span>
              <input
                type="number" className="bp-appt-override" placeholder={t('budget.overrideBudget')}
                value={a.budgetOverride ?? ''} onChange={(e) => updateAppt(a.id, { budgetOverride: e.target.value })}
              />
              <button type="button" className="bp-appt-del" onClick={() => removeAppt(a.id)} title={t('budget.removeAppointment')}>🗑</button>
            </div>
            <input
              type="text" className="bp-appt-note" placeholder={t('budget.notePlaceholder')}
              value={a.note ?? ''} onChange={(e) => updateAppt(a.id, { note: e.target.value })}
            />

            <div className="bp-appt-toggles">
              <label className="bp-toggle">
                <input type="checkbox" checked={focus} onChange={(e) => updateAppt(a.id, { focusView: e.target.checked })} />
                {t('budget.focusView')}
              </label>
              <label className="bp-toggle">
                <input type="checkbox" checked={!!a.allowFull} onChange={(e) => updateAppt(a.id, { allowFull: e.target.checked })} />
                {t('budget.allowFull')}
              </label>
            </div>

            {a.tight && <div className="bp-banner bp-warn">⚠️ {t('budget.tightWarning')}</div>}
            {a.noBuffer && !plan.summary.noBuffer && <div className="bp-banner bp-warn">⚠️ {t('budget.noBufferWarning')}</div>}

            <Bucket appt={a} bucketKey="doen" label={t('budget.doNow')} cls="bk-do" jobs={a.doen} />
            <Bucket appt={a} bucketKey="combineren" label={t('budget.combine')} cls="bk-combine" jobs={a.combineren} />

            {focus ? (
              a.hiddenCount > 0 && (
                <div className="bp-hidden-note">{t('budget.hiddenItems', { count: a.hiddenCount })}</div>
              )
            ) : (
              <>
                <Bucket appt={a} bucketKey="doorschuiven" label={t('budget.push')} cls="bk-push" jobs={a.doorschuiven} />
                <Bucket appt={a} bucketKey="geblokkeerd" label={t('budget.blocked')} cls="bk-blocked" jobs={a.geblokkeerd} />
              </>
            )}
          </div>
        );
      })}

      {/* diagnosis-only / never-spend */}
      {plan.diagnoseOnly.length > 0 && (
        <div className="bp-bucket bk-diag bp-diag-global">
          <div className="bp-bucket-head">
            <span className="bp-bucket-label">{t('budget.diagnoseOnly')}</span>
            <span className="bp-bucket-total">{plan.diagnoseOnly.length}×</span>
          </div>
          {plan.diagnoseOnly.map((j) => <Job key={j.id} job={j} appt={{ id: '__diag', overrides: {} }} />)}
        </div>
      )}
    </div>
  );
}
