import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { buildBudgetPlan, SECTIONS } from '../../utils/budgetPlan';
import { tItem } from '../../utils/translate';
import './BudgetPage.css';

const SECTION_META = {
  nuDoen: { label: 'NU DOEN', cls: 'sec-now' },
  binnen30: { label: 'BINNEN 30 DAGEN', cls: 'sec-30' },
  binnen3m: { label: 'BINNEN 3 MAANDEN', cls: 'sec-3m' },
  kanWachten: { label: 'KAN WACHTEN', cls: 'sec-wait' },
  geblokkeerd: { label: 'GEBLOKKEERD', cls: 'sec-blocked' },
  alleenDiagnose: { label: 'ALLEEN DIAGNOSE', cls: 'sec-diag' },
};

const URGENCY_CLS = {
  replace_needed: 'u-red', worn: 'u-orange', inspection_needed: 'u-inspect',
  due_soon: 'u-orange', monitor: 'u-monitor', ok: 'u-grey',
};

export default function BudgetPage({ itemsWithStatus, settings = {}, setSettings, vehicle }) {
  const { t } = useTranslation();
  const [tiresFirst, setTiresFirst] = useState(false);

  const plan = useMemo(
    () => buildBudgetPlan(itemsWithStatus, settings, new Date(), { tiresFirst }),
    [itemsWithStatus, settings, tiresFirst],
  );

  const set = (field, value) => setSettings({ ...settings, [field]: value });
  const num = (field) => (e) => set(field, e.target.value === '' ? '' : Number(e.target.value));
  const eur = (n) => `€${(n || 0).toLocaleString('nl-NL')}`;

  const { summary, sections } = plan;

  const Job = ({ job }) => (
    <div className="bp-job">
      <div className="bp-job-top">
        <span className={`bp-urgency ${URGENCY_CLS[job.urgency]}`}>{t(`budget.urgency.${job.urgency}`)}</span>
        <span className="bp-job-title">
          {job.title ? (job.title.nl || job.title.en) : tItem(t, job.memberNames[0])}
          {job.pullForward && <span className="bp-pull">⏩ {t('budget.pullForward')}</span>}
        </span>
        <span className="bp-job-cost">{eur(job.cost)}</span>
      </div>
      {job.members.length > 1 && (
        <div className="bp-job-members">{job.memberNames.map((n) => tItem(t, n)).join(' · ')}</div>
      )}
      {job.scheduledDate && job.monthOffset > 0 && (
        <div className="bp-job-when">{t('budget.scheduledFor', { date: job.scheduledDate })}</div>
      )}
      {job.blockReasons.map((b, i) => (
        <div key={i} className="bp-block-reason">
          🚧 {t(`budget.block.${b.type}`)}: {b.items.map((n) => tItem(t, n)).join(', ')}
        </div>
      ))}
      {job.diagnosisGated && <div className="bp-block-reason">🔬 {t('budget.diagnosisGate')}</div>}
      {job.unschedulable && <div className="bp-block-reason">💸 {t('budget.noBudget')}</div>}
    </div>
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
        <div className="bp-field">
          <label>{t('budget.maxMonthlySpend')}</label>
          <input type="number" value={settings.maxMonthlySpend ?? ''} onChange={num('maxMonthlySpend')} placeholder="—" />
        </div>
        <div className="bp-field">
          <label>{t('budget.planningStartDate')}</label>
          <input
            type="date"
            value={settings.planningStartDate ?? ''}
            onChange={(e) => set('planningStartDate', e.target.value)}
          />
        </div>
      </div>

      {/* summary */}
      <div className="bp-summary">
        <div className="bp-sum-card"><span>{t('budget.availableNow')}</span><strong>{eur(summary.availableNow)}</strong></div>
        <div className="bp-sum-card"><span>{t('budget.safetyBuffer')}</span><strong>{eur(summary.safetyBuffer)}</strong></div>
        <div className="bp-sum-card"><span>{t('budget.monthlySaving')}</span><strong>{eur(summary.monthly)}</strong></div>
        <div className="bp-sum-card"><span>{t('budget.thisMonth')}</span><strong>{eur(summary.thisMonthSpend)}</strong></div>
      </div>

      {sections.geblokkeerd.some((j) => j.blockReasons.some((b) => b.type === 'tires')) && (
        <label className="bp-override">
          <input type="checkbox" checked={tiresFirst} onChange={(e) => setTiresFirst(e.target.checked)} />
          {t('budget.tiresOverride')}
        </label>
      )}

      {/* sections */}
      {SECTIONS.map((key) => {
        const jobs = sections[key];
        if (!jobs.length) return null;
        const meta = SECTION_META[key];
        const total = jobs.reduce((c, j) => c + j.cost, 0);
        return (
          <div key={key} className={`bp-section ${meta.cls}`}>
            <div className="bp-section-head">
              <span className="bp-section-label">{meta.label}</span>
              <span className="bp-section-total">{eur(total)} · {jobs.length}×</span>
            </div>
            {jobs.map((job) => <Job key={job.id} job={job} />)}
          </div>
        );
      })}

      {plan.jobs.length === 0 && <p className="empty-state">{t('budget.empty')}</p>}
      {!vehicle?.currentMileage && <p className="empty-state">{t('budget.needMileage')}</p>}
    </div>
  );
}
