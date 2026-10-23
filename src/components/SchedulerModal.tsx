import React from 'react';
import {
  X,
  Clock,
  Radio,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Play,
  Calendar,
  Layers,
  FileSpreadsheet,
  Mail,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import { ScheduledRunLog } from '../types';

interface SchedulerModalProps {
  isOpen: boolean;
  onClose: () => void;
  istTime: string;
  istDate: string;
  nextSlotLabel: string;
  nextSlotSeconds: number;
  scheduledSlots: string[];
  activeCount: number;
  logs: ScheduledRunLog[];
  onTriggerCheckNow: () => Promise<void>;
  isChecking: boolean;
  onOpenEmailModal?: () => void;
}

export const SchedulerModal: React.FC<SchedulerModalProps> = ({
  isOpen,
  onClose,
  istTime,
  istDate,
  nextSlotLabel,
  nextSlotSeconds,
  scheduledSlots,
  activeCount,
  logs,
  onTriggerCheckNow,
  isChecking,
  onOpenEmailModal,
}) => {
  if (!isOpen) return null;

  const formatCountdown = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-5">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Automated Routine SSL Check &amp; Email Monitor
              </h2>
              <p className="text-xs text-slate-500">
                Daily IST schedules (10:30 AM, 2:30 PM &amp; 6:00 PM) with pre-check sheet sync &amp; 4-day expiry alerts.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          {/* Real-time IST Status Card */}
          <div className="p-4 rounded-xl bg-slate-900 text-white border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block mb-1">
                Indian Standard Time (IST) Clock
              </span>
              <div className="text-2xl font-bold font-mono text-white flex items-baseline gap-2">
                <span>{istTime}</span>
                <span className="text-xs text-slate-400 font-sans">{istDate}</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Next routine run:{' '}
                <strong className="text-slate-200">{nextSlotLabel}</strong> in{' '}
                <span className="text-emerald-400 font-mono font-medium">
                  {formatCountdown(nextSlotSeconds)}
                </span>
              </p>
            </div>

            <button
              onClick={onTriggerCheckNow}
              disabled={isChecking}
              className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow-md transition-all disabled:opacity-50 whitespace-nowrap"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{isChecking ? 'Running Routine...' : 'Run Routine Check Now'}</span>
            </button>
          </div>

          {/* 3-Step Execution Pipeline */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
            <span className="text-[11px] font-bold text-slate-900 dark:text-white uppercase tracking-wider block mb-2">
              Automated 3-Step Routine Execution Pipeline
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80">
                <div className="flex items-center space-x-1.5 text-emerald-600 dark:text-emerald-400 font-bold mb-1">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>1. Sync Sheet</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Pulls latest domains, campaign statuses &amp; regions from the master sheet before checking.
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80">
                <div className="flex items-center space-x-1.5 text-blue-600 dark:text-blue-400 font-bold mb-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>2. Check SSL</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Checks SSL of all sites <strong>except Suspended &amp; Expired</strong> ({activeCount} sites).
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80">
                <div className="flex items-center space-x-1.5 text-rose-600 dark:text-rose-400 font-bold mb-1">
                  <Mail className="w-3.5 h-3.5" />
                  <span>3. Email Alert</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Emails list of sites expiring in next <strong>4 days</strong> to <strong>ashwinihp0908@gmail.com</strong>.
                </p>
              </div>
            </div>
          </div>

          {/* Schedule Slots */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {scheduledSlots.map((slot, idx) => (
              <div
                key={slot}
                className={`p-3 rounded-xl border ${
                  nextSlotLabel === slot
                    ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    Slot {idx + 1}
                  </span>
                  {nextSlotLabel === slot && (
                    <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-bold uppercase">
                      Upcoming
                    </span>
                  )}
                </div>
                <div className="text-base font-bold font-mono text-slate-900 dark:text-white">
                  {slot}
                </div>
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Checks ~{activeCount} sites &amp; emails alerts
                </span>
              </div>
            ))}
          </div>

          {/* Execution History */}
          <div>
            <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-2 flex items-center justify-between">
              <span>Recent Routine Executions</span>
              <span className="text-[11px] text-slate-400 font-normal">
                Continuous 24/7 background execution
              </span>
            </h3>

            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {logs.length === 0 ? (
                <p className="text-slate-500 text-center py-6">
                  No execution logs recorded yet.
                </p>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900 dark:text-white font-mono">
                          {log.slot}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Verified {log.checkedCount} sites in {(log.durationMs / 1000).toFixed(1)}s
                        </span>
                        {log.syncedFromSheet && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-medium">
                            Sheet Synced
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {new Date(log.runAt).toLocaleString('en-IN', {
                          timeZone: 'Asia/Kolkata',
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        IST
                        {log.emailRecipient && (
                          <span className="ml-2 text-rose-500 font-medium">
                            • Emailed {log.emailExpiringCount ?? 0} site(s) to {log.emailRecipient}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 text-[11px]">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-medium">
                        <CheckCircle2 className="w-3 h-3" />
                        {log.validCount} valid
                      </span>
                      {log.expiringCount > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-medium">
                          <AlertTriangle className="w-3 h-3" />
                          {log.expiringCount} soon
                        </span>
                      )}
                      {log.failedCount > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 font-medium">
                          <XCircle className="w-3 h-3" />
                          {log.failedCount} failed
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          {onOpenEmailModal ? (
            <button
              onClick={() => {
                onClose();
                onOpenEmailModal();
              }}
              className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Configure Email Alerts &amp; View History</span>
            </button>
          ) : <div />}
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
