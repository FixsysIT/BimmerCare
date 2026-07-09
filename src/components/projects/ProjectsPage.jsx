import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import { useStorage } from '../../hooks/useStorage';
import { STORAGE_KEYS } from '../../utils/constants';
import './ProjectsPage.css';

/* Hobbyklussen / upgrades — bewust los van de onderhoudscatalogus: geen
   intervallen, geen status-engine, geen invloed op het dashboard. Gewoon een
   lijstje met status, kosten en notities. Eerste run seedt de wenslijst. */

const STATUSES = ['idea', 'ordered', 'busy', 'done'];
const STATUS_LABEL = { idea: 'statusIdea', ordered: 'statusOrdered', busy: 'statusBusy', done: 'statusDone' };

const SEED = [
  'Cluster (6WB)',
  'Speakers',
  'CarPlay',
  'Sfeerverlichting',
  'Binnenspiegel',
].map((name) => ({ id: uuidv4(), name, status: 'idea', cost: 0, notes: '' }));

export default function ProjectsPage() {
  const { t } = useTranslation();
  const [projects, setProjects, loading] = useStorage(STORAGE_KEYS.PROJECTS, null);
  const [editing, setEditing] = useState(null); // project object being edited (copy)

  // seed once on first use
  useEffect(() => {
    if (!loading && projects === null) setProjects(SEED);
  }, [loading, projects, setProjects]);

  const list = projects || [];

  const save = () => {
    if (!editing.name.trim()) return;
    setProjects((prev) => {
      const cur = prev || [];
      const exists = cur.some((p) => p.id === editing.id);
      const clean = { ...editing, name: editing.name.trim(), cost: parseFloat(editing.cost) || 0 };
      return exists ? cur.map((p) => (p.id === editing.id ? clean : p)) : [...cur, clean];
    });
    setEditing(null);
  };

  const remove = (p) => {
    if (!window.confirm(t('projects.confirmDelete', { name: p.name }))) return;
    setProjects((prev) => (prev || []).filter((x) => x.id !== p.id));
    setEditing(null);
  };

  const totalDone = list.filter((p) => p.status === 'done').reduce((s, p) => s + (p.cost || 0), 0);
  const totalPlanned = list.filter((p) => p.status !== 'done').reduce((s, p) => s + (p.cost || 0), 0);

  return (
    <div className="projects-page">
      <h1 className="page-title">{t('projects.title')}</h1>
      <p className="projects-subtitle">{t('projects.subtitle')}</p>

      <div className="projects-toolbar">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => setEditing({ id: uuidv4(), name: '', status: 'idea', cost: 0, notes: '' })}
        >
          + {t('projects.add')}
        </button>
        {(totalDone > 0 || totalPlanned > 0) && (
          <span className="projects-totals">
            {totalDone > 0 && <>✔ €{totalDone.toFixed(0)}</>}
            {totalDone > 0 && totalPlanned > 0 && ' · '}
            {totalPlanned > 0 && <>○ €{totalPlanned.toFixed(0)}</>}
          </span>
        )}
      </div>

      {list.length === 0 && <p className="empty-state">{t('projects.empty')}</p>}

      <div className="projects-list">
        {list.map((p) => (
          <button key={p.id} type="button" className="card project-row" onClick={() => setEditing({ ...p })}>
            <div className="project-main">
              <span className="project-name">{p.name}</span>
              {p.notes && <span className="project-notes">{p.notes}</span>}
            </div>
            {p.cost > 0 && <span className="project-cost">€{p.cost.toFixed(0)}</span>}
            <span className={`project-status project-status-${p.status}`}>
              {t(`projects.${STATUS_LABEL[p.status]}`)}
            </span>
          </button>
        ))}
      </div>

      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal card" onClick={(e) => e.stopPropagation()}>
            <div className="form">
              <div className="form-group">
                <label>{t('projects.name')}</label>
                <input type="text" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} autoFocus />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>{t('projects.status')}</label>
                  <select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{t(`projects.${STATUS_LABEL[s]}`)}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>{t('projects.cost')}</label>
                  <input type="number" step="0.01" value={editing.cost || ''} onChange={(e) => setEditing({ ...editing, cost: e.target.value })} placeholder="0.00" />
                </div>
              </div>
              <div className="form-group">
                <label>{t('projects.notes')}</label>
                <textarea rows={2} value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
              </div>
              <div className="form-actions project-actions">
                {(projects || []).some((p) => p.id === editing.id) && (
                  <button type="button" className="btn btn-ghost project-delete" onClick={() => remove(editing)}>×</button>
                )}
                <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>{t('projects.cancel')}</button>
                <button type="button" className="btn btn-primary" onClick={save}>{t('projects.save')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
