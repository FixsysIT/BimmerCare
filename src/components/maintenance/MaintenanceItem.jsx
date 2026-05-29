import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import EventLogModal from './EventLogModal';
import StatusBadge from '../shared/StatusBadge';
import SourceBadge from '../shared/SourceBadge';
import { CATEGORY_ICONS } from '../../utils/constants';
import { tItem, tCategory } from '../../utils/translate';

const STATUS_COLORS = {
  red: 'var(--status-red)', orange: 'var(--status-orange)',
  inspect: 'var(--status-inspect)', monitor: 'var(--status-monitor)',
  grey: 'var(--status-grey)', green: 'var(--status-green)',
};

// quick-action option sets per strategy (result keys map to history events)
const CONDITION_OPTS = [
  { result: 'ok', color: 'green', key: 'condition.ok' },
  { result: 'monitor', color: 'monitor', key: 'condition.monitor' },
  { result: 'worn', color: 'orange', key: 'condition.worn' },
  { result: 'replace_needed', color: 'red', key: 'condition.replace' },
  // real repair → service event (same capability as diagnosis items)
  { result: 'replaced', color: 'green', key: 'diagnosis.replaced', type: 'service' },
];
const DIAGNOSIS_OPTS = [
  { result: 'monitor', color: 'monitor', key: 'diagnosis.monitor' },  // logs a monitor event
  { result: 'no_fault', color: 'green', key: 'diagnosis.noFault' },
  { result: 'fault_present', color: 'orange', key: 'diagnosis.faultPresent' },
  { result: 'confirmed_failed', color: 'red', key: 'diagnosis.confirmed' },  // defect → red / Nu doen
  // Real repair, not a diagnosis → writes a 'service' history event.
  { result: 'replaced', color: 'green', key: 'diagnosis.replaced', type: 'service' },
];

// active = which result is currently logged (not which colour — two greens exist)
function Pills({ opts, activeResult, onPick, t }) {
  return (
    <div className="seg" role="group">
      {opts.map((o) => {
        const active = (o.result ?? null) === (activeResult ?? null);
        return (
          <button
            key={o.key}
            type="button"
            className={`seg-btn ${active ? `seg-active seg-${o.color}` : ''}`}
            onClick={(e) => { e.stopPropagation(); onPick(o); }}
          >
            {t(o.key)}
          </button>
        );
      })}
    </div>
  );
}

export default function MaintenanceItem({ item, onRegister, onEdit, onLog, onSetBaseline, currentMileage }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [pending, setPending] = useState(null); // {type, result, label} → opens log modal
  const cs = item.calculatedStatus;
  const strategy = item.replacementStrategy || 'interval';
  const isDiag = strategy === 'on-failure' || item.intervalType === 'diagnosis';
  const lastEntry = item.history?.length ? item.history[item.history.length - 1] : null;
  const hasHistory = item.history?.length > 0;
  // highlight by the logged result (diagnosis Monitor = result null = nothing logged)
  const activeResult = item.lastResult ?? null;

  // short interval text for the meta line
  const intervalText = item.intervalKm
    ? `${item.intervalKm.toLocaleString()} km`
    : item.intervalMonths ? `${item.intervalMonths} ${t('common.months')}` : null;

  // progress bar for km-based items
  let progress = null;
  if (cs.dueByKm && cs.remainingKm !== null && item.intervalKm) {
    const pct = Math.max(0, Math.min(100, ((item.intervalKm - cs.remainingKm) / item.intervalKm) * 100));
    progress = { pct, color: STATUS_COLORS[cs.status] || 'var(--status-green)' };
  }
  // replacement-window bar for on-failure items that were replaced
  if (cs.replacementOkValidKm && cs.replacementRemainingKm !== null) {
    const used = cs.replacementOkValidKm - cs.replacementRemainingKm;
    const pct = Math.max(0, Math.min(100, (used / cs.replacementOkValidKm) * 100));
    progress = { pct, color: STATUS_COLORS[cs.status] || 'var(--status-green)' };
  }

  // on-failure replaced items get a friendly "until Monitor" message + subtext
  let message = cs.message;
  let subMessage = null;
  if (cs.replacementOkValidKm != null && cs.sourceEvent?.type === 'service') {
    if (cs.replacementExpired) {
      message = t('maintenance.monitorReplacedAgo', { km: (cs.kmSinceReplacement ?? 0).toLocaleString() });
    } else {
      message = t('maintenance.kmUntilMonitor', { km: (cs.replacementRemainingKm ?? 0).toLocaleString() });
      subMessage = t('maintenance.monitorFromKm', { km: (cs.replacementExpiresAtKm ?? 0).toLocaleString() });
    }
  }

  // picking an option opens the log modal (date backdatable + mileage + note),
  // then writes a history event. an option may override the event type
  // (e.g. "Onderdeel vervangen" = service).
  const pick = (o) => setPending({
    type: o.type || (isDiag ? 'diagnosis' : 'inspection'),
    result: o.result,
    label: t(o.key),
  });

  return (
    <div className="card maint-card">
      <div className="maint-top" onClick={() => setExpanded(!expanded)}>
        <div className="maint-left">
          <span className="maint-icon">{CATEGORY_ICONS[item.category] || '🔧'}</span>
          <div className="maint-info">
            <span className="maint-name">{tItem(t, item.name)}</span>
            <span className="maint-sub">
              {tCategory(t, item.category)} · {t(`strategy.${strategy}`)}
              {intervalText ? ` · ${intervalText}` : ''}
            </span>
          </div>
        </div>
        <div className="maint-right">
          <StatusBadge status={cs.status} reason={cs.statusReason} />
          {item.estimatedTotalCost > 0 && <span className="cost-chip">~€{item.estimatedTotalCost}</span>}
        </div>
      </div>

      <div className={`maint-message status-${cs.status}`}>{message}</div>
      {subMessage && <div className="maint-submessage">{subMessage}</div>}

      {progress && (
        <div className="maint-progress">
          <div className="maint-progress-bar" style={{ width: `${progress.pct}%`, background: progress.color }} />
        </div>
      )}

      {lastEntry && (
        <div className="maint-last">
          {t('maintenance.lastService')}: {lastEntry.mileage?.toLocaleString()} km · {lastEntry.date}
          {lastEntry.result ? ` · ${t(`result.${lastEntry.result}`, lastEntry.result)}` : ''}
        </div>
      )}

      {/* Always-visible quick actions */}
      <div className="maint-quick" onClick={(e) => e.stopPropagation()}>
        {strategy === 'interval' && item.baselineState !== 'never' && (
          <button className="btn btn-primary btn-sm" onClick={onRegister}>{t('maintenance.markReplaced')}</button>
        )}
        {strategy === 'condition' && (
          <Pills opts={CONDITION_OPTS} activeResult={activeResult} onPick={pick} t={t} />
        )}
        {isDiag && (
          <Pills opts={DIAGNOSIS_OPTS} activeResult={activeResult} onPick={pick} t={t} />
        )}
        <button className="btn btn-ghost btn-sm maint-details-btn" onClick={() => setExpanded(!expanded)}>
          {t('maintenance.details')}
        </button>
      </div>

      {expanded && (
        <div className="maint-expanded" onClick={(e) => e.stopPropagation()}>
          <div className="maint-meta">
            {(item.bmwIntervalKm || item.bmwIntervalMonths) && (
              <div className="maint-meta-item">
                <span className="maint-meta-label">BMW</span>
                <span className="maint-meta-value">
                  {item.bmwIntervalKm ? `${item.bmwIntervalKm.toLocaleString()} km` : ''}
                  {item.bmwIntervalKm && item.bmwIntervalMonths ? ' / ' : ''}
                  {item.bmwIntervalMonths ? `${item.bmwIntervalMonths} ${t('common.months')}` : ''}
                </span>
              </div>
            )}
            {(item.communityIntervalKm || item.communityIntervalMonths) && (
              <div className="maint-meta-item">
                <span className="maint-meta-label">Community</span>
                <span className="maint-meta-value">
                  {item.communityIntervalKm ? `${item.communityIntervalKm.toLocaleString()} km` : ''}
                  {item.communityIntervalKm && item.communityIntervalMonths ? ' / ' : ''}
                  {item.communityIntervalMonths ? `${item.communityIntervalMonths} ${t('common.months')}` : ''}
                </span>
              </div>
            )}
            {cs.dueByKm && (
              <div className="maint-meta-item">
                <span className="maint-meta-label">{t('maintenance.nextDue')}</span>
                <span className="maint-meta-value">{cs.dueByKm.toLocaleString()} km</span>
              </div>
            )}
            {cs.dueByDate && (
              <div className="maint-meta-item">
                <span className="maint-meta-label">{t('maintenance.nextDue')} (datum)</span>
                <span className="maint-meta-value">{cs.dueByDate}</span>
              </div>
            )}
          </div>

          <div className="maint-badges">
            <SourceBadge source={item.source} />
          </div>

          {item.sourceNote && (
            <p className="maint-note">{item.sourceNote}</p>
          )}

          {isDiag && (
            <span className="status-control-hint">{t('maintenance.monitorHint')}</span>
          )}

          {/* History */}
          {hasHistory && (
            <div className="maint-history">
              <span className="maint-meta-label">{t('maintenance.history')}</span>
              {item.history.slice(-4).reverse().map((h) => (
                <div key={h.id} className="maint-history-row">
                  {h.date} — {h.mileage?.toLocaleString()} km
                  {h.result ? ` — ${t(`result.${h.result}`, h.result)}` : ''}
                  {h.type === 'baseline' ? ' — baseline' : ''}
                  {h.totalInclVat ? ` — €${h.totalInclVat.toFixed(2)}` : ''}
                  {h.garage ? ` — ${h.garage}` : ''}
                </div>
              ))}
            </div>
          )}

          {!hasHistory && onSetBaseline && strategy === 'interval' && (
            <div className="baseline-control">
              <span className="maint-meta-label">{t('maintenance.replacementStatus')}</span>
              <div className="baseline-options">
                <button
                  className={`baseline-btn ${item.baselineState === 'never' ? 'baseline-active-red' : ''}`}
                  onClick={() => onSetBaseline(item.baselineState === 'never' ? null : 'never')}
                >
                  {t('maintenance.neverReplaced')}
                </button>
                <button
                  className={`baseline-btn ${!item.baselineState ? 'baseline-active' : ''}`}
                  onClick={() => onSetBaseline(null)}
                >
                  {t('maintenance.estimate')}
                </button>
              </div>
            </div>
          )}

          <div className="maint-actions">
            <button className="btn btn-secondary btn-sm" onClick={onEdit}>{t('maintenance.edit')}</button>
          </div>
        </div>
      )}

      {pending && (
        <EventLogModal
          isOpen={!!pending}
          onClose={() => setPending(null)}
          item={item}
          currentMileage={currentMileage}
          resultLabel={pending.label}
          onSave={(opts) => {
            onLog(item, pending.type, pending.result, opts);
            setPending(null);
          }}
        />
      )}
    </div>
  );
}
