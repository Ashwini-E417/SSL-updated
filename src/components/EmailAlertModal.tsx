import React, { useState, useEffect } from 'react';
import {
  X,
  Mail,
  Send,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ExternalLink,
  ShieldAlert,
  Server,
  Settings2,
  RefreshCw,
  FileSpreadsheet,
} from 'lucide-react';
import { EmailAlertConfig, EmailAlertLog, ProjectRecord } from '../types';

interface EmailAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: ProjectRecord[];
  onTriggerRoutineCheck: () => Promise<void>;
  isChecking: boolean;
}

export const EmailAlertModal: React.FC<EmailAlertModalProps> = ({
  isOpen,
  onClose,
  projects,
  onTriggerRoutineCheck,
  isChecking,
}) => {
  const [emailConfig, setEmailConfig] = useState<EmailAlertConfig>({
    recipientEmail: 'ashwinihp0908@gmail.com',
    enabled: true,
    daysThreshold: 4,
  });
  const [logs, setLogs] = useState<EmailAlertLog[]>([]);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showSmtpSettings, setShowSmtpSettings] = useState(false);

  // SMTP form fields
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const fetchEmailData = async () => {
      try {
        const [configRes, logsRes] = await Promise.all([
          fetch('/api/email/config'),
          fetch('/api/email/logs'),
        ]);
        if (configRes.ok) {
          const cfg = await configRes.json();
          setEmailConfig(cfg);
          setSmtpHost(cfg.smtpHost || '');
          setSmtpPort(cfg.smtpPort || 587);
          setSmtpUser(cfg.smtpUser || '');
        }
        if (logsRes.ok) {
          setLogs(await logsRes.json());
        }
      } catch (err) {
        console.error('Failed to load email config/logs:', err);
      }
    };
    fetchEmailData();
  }, [isOpen]);

  if (!isOpen) return null;

  // Filter sites expiring in <= 4 days (excluding Suspended & Expired)
  const expiringSitesIn4Days = projects.filter((p) => {
    const s = (p.campaignStatus || '').trim().toLowerCase();
    if (s === 'suspended' || s === 'expired') return false;
    const days = p.ssl?.daysRemaining;
    return days !== null && days !== undefined && days <= 4;
  });

  const handleSendTest = async () => {
    setIsSendingTest(true);
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/email/send-test', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMessage(
          `✓ Test alert email generated for ${data.recipient} (${data.expiringCount} sites expiring in 4 days).`
        );
        // Refresh logs
        const logsRes = await fetch('/api/email/logs');
        if (logsRes.ok) setLogs(await logsRes.json());
      } else {
        setErrorMessage(data.error || data.message || 'Failed to dispatch test email.');
      }
    } catch (e: any) {
      setErrorMessage(`Network error: ${e.message}`);
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      const payload: Partial<EmailAlertConfig> = {
        recipientEmail: emailConfig.recipientEmail.trim() || 'ashwinihp0908@gmail.com',
        enabled: emailConfig.enabled,
        daysThreshold: Number(emailConfig.daysThreshold) || 4,
        smtpHost: smtpHost.trim(),
        smtpPort: Number(smtpPort) || 587,
        smtpUser: smtpUser.trim(),
      };
      if (smtpPass) {
        payload.smtpPass = smtpPass.trim();
      }

      const res = await fetch('/api/email/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setEmailConfig(data);
        setStatusMessage('Email alert preferences saved successfully.');
      } else {
        setErrorMessage(data.error || 'Failed to save configuration.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error saving settings.');
    } finally {
      setIsSavingConfig(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>SSL Expiry Email Alerts</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-semibold">
                  ≤ 4 Days Rule
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Automatic dispatch to <strong className="text-slate-700 dark:text-slate-300">ashwinihp0908@gmail.com</strong> after routine SSL checks.
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

        {statusMessage && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center space-x-2 shrink-0">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
            <span>{statusMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300 flex items-center space-x-2 shrink-0">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="space-y-4 overflow-y-auto pr-1 flex-1 text-xs">
          {/* Active Alert Rule Banner */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-rose-950/40 to-slate-900 border border-rose-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-slate-200">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 block">
                Target Recipient &amp; Frequency
              </span>
              <div className="font-mono text-sm font-bold text-white flex items-center gap-2">
                <span>{emailConfig.recipientEmail}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  ≤ 4 Days Expiry
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Routine scans run daily at <strong>10:30 AM, 2:30 PM &amp; 6:00 PM IST</strong>. The sheet is synced right before scanning, and sites expiring in ≤ 4 days are immediately emailed.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleSendTest}
                disabled={isSendingTest}
                className="inline-flex items-center space-x-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-semibold shadow-sm transition-all disabled:opacity-50"
              >
                <Send className={`w-3.5 h-3.5 ${isSendingTest ? 'animate-bounce' : ''}`} />
                <span>{isSendingTest ? 'Sending...' : 'Send Test Alert'}</span>
              </button>
            </div>
          </div>

          {/* Current Sites Expiring in Next 4 Days */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-800/40 p-3.5">
            <div className="flex items-center justify-between mb-2.5">
              <span className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-500" />
                Current Sites Expiring in Next 4 Days ({expiringSitesIn4Days.length})
              </span>
              <span className="text-[11px] text-slate-500">
                Filtered: All sites except Suspended &amp; Expired
              </span>
            </div>

            {expiringSitesIn4Days.length === 0 ? (
              <div className="text-center py-6 text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900/50">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-1.5 opacity-90" />
                <p className="font-semibold text-slate-700 dark:text-slate-300">
                  Zero sites expiring in the next 4 days
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  All active certificates have more than 4 days remaining.
                </p>
              </div>
            ) : (
              <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
                {expiringSitesIn4Days.map((site) => {
                  const days = site.ssl?.daysRemaining;
                  const isExpired = days !== null && days !== undefined && days <= 0;
                  const expDate = site.ssl?.validTo
                    ? new Date(site.ssl.validTo).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : 'N/A';

                  return (
                    <div
                      key={site.id}
                      className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-between"
                    >
                      <div>
                        <a
                          href={`https://${site.url.replace(/^https?:\/\//, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono font-bold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1"
                        >
                          <span>{site.url}</span>
                          <ExternalLink className="w-3 h-3 text-slate-400" />
                        </a>
                        <div className="flex items-center space-x-2 text-[11px] text-slate-500 mt-0.5">
                          <span>Expires: <strong className="text-slate-800 dark:text-slate-200">{expDate}</strong></span>
                          <span>•</span>
                          <span>{site.region}</span>
                          <span>•</span>
                          <span className="font-medium text-emerald-600 dark:text-emerald-400">
                            {site.campaignStatus}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          isExpired
                            ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                            : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                        }`}
                      >
                        {isExpired ? 'Expired' : `${days}d left`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Email Delivery History */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-800/40 p-3.5">
            <span className="font-bold text-slate-900 dark:text-white block mb-2">
              Recent Email Dispatches
            </span>
            {logs.length === 0 ? (
              <p className="text-slate-400 text-center py-4">No emails dispatched yet.</p>
            ) : (
              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                {logs.slice(0, 10).map((log) => (
                  <div
                    key={log.id}
                    className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px]"
                  >
                    <div>
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {log.subject}
                      </span>
                      <div className="text-slate-400 flex items-center gap-2 mt-0.5">
                        <span>To: {log.recipient}</span>
                        <span>•</span>
                        <span>{new Date(log.sentAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">
                        {log.expiringSitesCount} sites
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded uppercase font-bold text-[10px] ${
                          log.status === 'sent'
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                            : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                        }`}
                      >
                        {log.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Email & SMTP Settings Toggle */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-800/40 p-3.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-900 dark:text-white block">
                  Alert Configuration &amp; Mailer Settings
                </span>
                <span className="text-[11px] text-slate-500">
                  Recipient email, days threshold, and optional custom SMTP server
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowSmtpSettings(!showSmtpSettings)}
                className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1"
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span>{showSmtpSettings ? 'Hide Settings' : 'Edit Settings'}</span>
              </button>
            </div>

            {showSmtpSettings && (
              <form onSubmit={handleSaveConfig} className="mt-3 space-y-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Recipient Email Address:
                    </label>
                    <input
                      type="email"
                      value={emailConfig.recipientEmail}
                      onChange={(e) =>
                        setEmailConfig({ ...emailConfig, recipientEmail: e.target.value })
                      }
                      required
                      placeholder="ashwinihp0908@gmail.com"
                      className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Expiry Alert Threshold (Days):
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={emailConfig.daysThreshold}
                      onChange={(e) =>
                        setEmailConfig({
                          ...emailConfig,
                          daysThreshold: parseInt(e.target.value, 10) || 4,
                        })
                      }
                      className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Optional SMTP Host (e.g. Gmail App Password, AWS SES, SendGrid):
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <input
                      type="text"
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value)}
                      placeholder="smtp.gmail.com"
                      className="sm:col-span-2 px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-mono"
                    />
                    <input
                      type="number"
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(parseInt(e.target.value, 10) || 587)}
                      placeholder="587"
                      className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-mono"
                    />
                    <input
                      type="text"
                      value={smtpUser}
                      onChange={(e) => setSmtpUser(e.target.value)}
                      placeholder="Username / Email"
                      className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-mono"
                    />
                  </div>
                  <div className="mt-2">
                    <input
                      type="password"
                      value={smtpPass}
                      onChange={(e) => setSmtpPass(e.target.value)}
                      placeholder="SMTP Password / App Password (leave blank if unchanged)"
                      className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-mono"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={isSavingConfig}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
                  >
                    {isSavingConfig ? 'Saving...' : 'Save Email Settings'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
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
