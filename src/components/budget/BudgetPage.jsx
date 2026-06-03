import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { buildBudgetPlan } from '../../utils/budgetPlan';
import { tItem } from '../../utils/translate';
import './BudgetPage.css';

const URGENCY_CLS = {
  replace_needed: 'u-red', worn: 'u-orange', inspection_needed: 'u-inspect',
  due_soon: 'u-orange', monitor: 'u-monitor', ok: 'u-grey',
};

const newId = () => (globalThis.crypto?.randomUUID?.() || String(Date.now() + Math.random()));

export default function BudgetPage({ itemsWithStatus, settings = {}, setSettings, vehicle }) {
  const { t } = useTranslation();
  const [jobOverrides, setJobOverrides] = useState({});

  const plan = useMemo(
    () => buildBudgetPlan(itemsWithStatus, settings, new Date(), jobOverrides),
    [itemsWithStatus, settings, jobOverrides],
  );

  const set = (field, value) => setSettings({ ...settings, [field]: value });
  const num = (field) => (e) => set(field, e.target.value === '' ? '' : Number(e.target.value));
  const eur = (n) => `€${Math.round(n || 0).toLocaleString('nl-NL')}`;

  const appts = settings.appointments || [];
  const updateAppt = (id, patch) =>
    set('appointments', appts.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const addAppt = () =>
    set('appointments', [...appts, { id: newId(), date: '', budgetOverride: '', note: '' }]);
  const removeAppt = (id) => set('appointments', appts.filter((a) => a.id !== id));

  const toggleOverride = (jobId) =>
    setJobOverrides((o) => ({ ...o, [jobId]: !o[jobId] }));

  const Job = ({ job, showBlock }) => (
    <div className="bp-job">
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
      {job.reasonKey === 'oilCombine' && <div className="bp-job-reason">🛢️ {t('budget.oilCombineReason')}</div>}
      {job.cannotWait && <div className="bp-job-reason bp-warn">⚠️ {t('budget.cannotWait')}</div>}
      {(showBlock && job.blocked) && (
        <div className="bp-block">
          {job.blockReasons.map((b, i) => (
            <div key={i} className="bp-block-reason">🚧 {t(`budget.block.${b.type}`)}</div>
          ))}
          <label className="bp-override-local">
            <input type="checkbox" checked={!!jobOverrides[job.id]} onChange={() => toggleOverride(job.id)} />
            {t('budget.overrideLocal')}
          </label>
        </div>
      )}
      {job.diagnosisGated && <div className="bp-job-reason">🔬 {t('budget.diagnosisGate')}</div>}
    </div>
  );

  const Bucket = ({ label, cls, jobs, showBlock }) => (
    jobs.length > 0 ? (
      <div className={`bp-bucket ${cls}`}>
        <div className="bp-bucket-head">
          <span className="bp-bucket-label">{label}</span>
          <span className="bp-bucket-total">{eur(jobs.reduce((c, j) => c + j.cost, 0))} · {jobs.length}×</span>
        </div>
        {jobs.map((j) => <Job key={j.id} job={j} showBlock={showBlock} />)}
      </div>
    ) : null
  );

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
          <input type="number" value={settings.safetyBuffer ?? ''} onChange={num('safetyBuffer')} placeholder="0" />
        </div>
      </div>

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

      {!vehicle?.currentMileage && <p className="empty-state">{t('budget.needMileage')}</p>}
      {appts.length === 0 && <p className="empty-state">{t('budget.noAppointments')}</p>}

      {plan.appointments.map((a) => (
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
          <Bucket label={t('budget.doNow')} cls="bk-do" jobs={a.doen} />
          <Bucket label={t('budget.combine')} cls="bk-combine" jobs={a.combineren} />
          <Bucket label={t('budget.push')} cls="bk-push" jobs={a.doorschuiven} />
          <Bucket label={t('budget.blocked')} cls="bk-blocked" jobs={a.geblokkeerd} showBlock />
        </div>
      ))}

      {/* diagnosis-only / never-spend */}
      {plan.diagnoseOnly.length > 0 && (
        <div className="bp-bucket bk-diag bp-diag-global">
          <div className="bp-bucket-head">
            <span className="bp-bucket-label">{t('budget.diagnoseOnly')}</span>
            <span className="bp-bucket-total">{plan.diagnoseOnly.length}×</span>
          </div>
          {plan.diagnoseOnly.map((j) => <Job key={j.id} job={j} />)}
        </div>
      )}
    </div>
  );
}
