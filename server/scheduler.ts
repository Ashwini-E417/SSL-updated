import { Storage } from './storage.js';
import { checkSSLCertificate } from './sslChecker.js';
import { ScheduledRunLog } from '../src/types.js';
import { syncFromMasterSheet } from './sheetSync.js';
import { sendExpiringSSLEmail } from './emailService.js';
import { saveLatestExcelToDisk } from './excelSync.js';

interface ISTTime {
  hours: number;
  minutes: number;
  seconds: number;
  dateKey: string; // YYYY-MM-DD in IST
  formattedTime: string;
  formattedDate: string;
  rawDate: Date;
}

export function getISTTime(date = new Date()): ISTTime {
  // IST is UTC + 5h 30m = 330 minutes
  const utcTime = date.getTime() + date.getTimezoneOffset() * 60000;
  const istTime = new Date(utcTime + 330 * 60000);

  const hours = istTime.getHours();
  const minutes = istTime.getMinutes();
  const seconds = istTime.getSeconds();

  const year = istTime.getFullYear();
  const month = String(istTime.getMonth() + 1).padStart(2, '0');
  const day = String(istTime.getDate()).padStart(2, '0');
  const dateKey = `${year}-${month}-${day}`;

  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  const formattedTime = `${String(displayHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} ${ampm} IST`;
  const formattedDate = `${day}/${month}/${year}`;

  return {
    hours,
    minutes,
    seconds,
    dateKey,
    formattedTime,
    formattedDate,
    rawDate: istTime,
  };
}

// Scheduled check times in 24h format (hours, minutes, label)
const SCHEDULED_SLOTS: Array<{ hours: number; minutes: number; label: '10:30 AM IST' | '2:30 PM IST' | '6:00 PM IST' }> = [
  { hours: 10, minutes: 30, label: '10:30 AM IST' },
  { hours: 14, minutes: 30, label: '2:30 PM IST' },
  { hours: 18, minutes: 0, label: '6:00 PM IST' },
];

let lastExecutedSlotKey: string | null = null;
let isCurrentlyRunning = false;
let checkProgress = {
  active: false,
  total: 0,
  current: 0,
  currentDomain: '',
  phase: 'idle', // 'syncing_sheet' | 'checking_ssl' | 'sending_email' | 'idle'
};

/**
 * Routine SSL Check Pipeline:
 * 1. Synchronize the list from the master sheet before checking.
 * 2. Check SSL of ALL sites (except Suspended and Expired).
 * 3. Send email to ashwinihp0908@gmail.com of sites whose SSL is expiring in next 4 days.
 */
export async function runRoutineSSLCheck(
  slotLabel: '10:30 AM IST' | '2:30 PM IST' | '6:00 PM IST' | 'Manual Batch' = 'Manual Batch'
): Promise<ScheduledRunLog> {
  if (isCurrentlyRunning) {
    throw new Error('An SSL check batch is already in progress');
  }

  isCurrentlyRunning = true;
  const startTime = Date.now();

  try {
    // -------------------------------------------------------------
    // Step 1: Sync the list from the sheet before checking
    // -------------------------------------------------------------
    console.log(`[SSL Scheduler] [${slotLabel}] Step 1: Syncing list from website sheet before SSL check...`);
    checkProgress = {
      active: true,
      total: 0,
      current: 0,
      currentDomain: 'Syncing sheet list...',
      phase: 'syncing_sheet',
    };

    const syncResult = await syncFromMasterSheet();
    console.log(`[SSL Scheduler] Sheet sync finished: ${syncResult.totalRows} rows synchronized.`);

    // -------------------------------------------------------------
    // Step 2: Check SSL of all sites (EXCEPT Suspended and Expired)
    // -------------------------------------------------------------
    const allProjects = Storage.getAllProjects();
    const targetProjects = allProjects.filter((p) => {
      const status = (p.campaignStatus || '').trim().toLowerCase();
      return status !== 'suspended' && status !== 'expired';
    });

    console.log(
      `[SSL Scheduler] [${slotLabel}] Step 2: Verifying SSL for ${targetProjects.length} candidate sites (filtered out Suspended & Expired)...`
    );

    checkProgress = {
      active: true,
      total: targetProjects.length,
      current: 0,
      currentDomain: '',
      phase: 'checking_ssl',
    };

    let validCount = 0;
    let expiringCount = 0;
    let failedCount = 0;

    // Run SSL validation in concurrent chunks of 4 domains
    const batchSize = 4;
    for (let i = 0; i < targetProjects.length; i += batchSize) {
      const batch = targetProjects.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (project) => {
          checkProgress.current++;
          checkProgress.currentDomain = project.url;

          try {
            const result = await checkSSLCertificate(project.url, 7500);
            Storage.updateProjectSSL(
              project.id,
              result,
              slotLabel === 'Manual Batch' ? 'manual' : 'scheduled'
            );

            if (result.status === 'valid') validCount++;
            else if (result.status === 'expiring_soon') expiringCount++;
            else failedCount++;
          } catch (err: any) {
            failedCount++;
            console.error(`Error checking SSL for ${project.url}:`, err);
          }
        })
      );
    }

    // -------------------------------------------------------------
    // Step 3: Find sites expiring in the next 4 days & send email
    // -------------------------------------------------------------
    checkProgress.phase = 'sending_email';
    checkProgress.currentDomain = 'Preparing email alert...';

    const latestProjects = Storage.getAllProjects();
    const candidateCheckedMap = new Set(targetProjects.map((p) => p.id));

    // Criteria: SSL expiring in next 4 days (daysRemaining <= 4)
    const expiringIn4Days = latestProjects.filter((p) => {
      if (!candidateCheckedMap.has(p.id)) return false;
      const days = p.ssl?.daysRemaining;
      return days !== null && days !== undefined && days <= 4;
    });

    console.log(
      `[SSL Scheduler] [${slotLabel}] Step 3: Found ${expiringIn4Days.length} site(s) expiring in the next 4 days. Sending email alert to ashwinihp0908@gmail.com...`
    );

    const emailOutcome = await sendExpiringSSLEmail({
      expiringSites: expiringIn4Days,
      totalChecked: targetProjects.length,
      slotLabel,
      forceSendAlways: false,
    });

    // Update local Excel mirror
    saveLatestExcelToDisk(latestProjects);

    const durationMs = Date.now() - startTime;
    isCurrentlyRunning = false;
    checkProgress = {
      active: false,
      total: 0,
      current: 0,
      currentDomain: '',
      phase: 'idle',
    };

    const runLog: ScheduledRunLog = {
      id: `run-${Date.now()}`,
      slot: slotLabel,
      runAt: new Date().toISOString(),
      totalActive: targetProjects.length,
      checkedCount: targetProjects.length,
      validCount,
      expiringCount,
      failedCount,
      durationMs,
      syncedFromSheet: syncResult.success,
      syncedRowsCount: syncResult.totalRows,
      emailSent: emailOutcome.success,
      emailRecipient: emailOutcome.recipient,
      emailExpiringCount: expiringIn4Days.length,
    };

    Storage.addScheduledLog(runLog);
    console.log(
      `[SSL Scheduler] Routine check completed: ${targetProjects.length} sites checked in ${(durationMs / 1000).toFixed(1)}s. Email alert: ${emailOutcome.message}`
    );
    return runLog;
  } catch (err: any) {
    isCurrentlyRunning = false;
    checkProgress.active = false;
    checkProgress.phase = 'idle';
    console.error(`[SSL Scheduler] Routine check failed:`, err);
    throw err;
  }
}

// Alias for compatibility
export const runActiveCampaignSSLCheck = runRoutineSSLCheck;

export function getSchedulerStatus() {
  const ist = getISTTime();
  const nowMs = ist.rawDate.getTime();

  // Find next slot
  let nextSlotTime: Date | null = null;
  let nextSlotLabel = '';

  for (const slot of SCHEDULED_SLOTS) {
    const slotDate = new Date(ist.rawDate);
    slotDate.setHours(slot.hours, slot.minutes, 0, 0);

    if (slotDate.getTime() > nowMs) {
      nextSlotTime = slotDate;
      nextSlotLabel = slot.label;
      break;
    }
  }

  // If past all slots today, next is 10:30 AM tomorrow
  if (!nextSlotTime) {
    const tomorrowSlot = new Date(ist.rawDate);
    tomorrowSlot.setDate(tomorrowSlot.getDate() + 1);
    tomorrowSlot.setHours(SCHEDULED_SLOTS[0].hours, SCHEDULED_SLOTS[0].minutes, 0, 0);
    nextSlotTime = tomorrowSlot;
    nextSlotLabel = SCHEDULED_SLOTS[0].label;
  }

  const secondsRemaining = Math.max(0, Math.floor((nextSlotTime.getTime() - nowMs) / 1000));
  const allProjects = Storage.getAllProjects();
  const eligibleCount = allProjects.filter((p) => {
    const status = (p.campaignStatus || '').trim().toLowerCase();
    return status !== 'suspended' && status !== 'expired';
  }).length;
  const recentLogs = Storage.getScheduledLogs();
  const emailConfig = Storage.getEmailConfig();
  const emailLogs = Storage.getEmailLogs();

  return {
    currentIST: ist.formattedTime,
    currentISTDate: ist.formattedDate,
    nextSlotLabel,
    nextSlotRemainingSeconds: secondsRemaining,
    scheduledSlots: SCHEDULED_SLOTS.map((s) => s.label),
    isCheckingNow: isCurrentlyRunning,
    checkProgress,
    activeCampaignsCount: eligibleCount,
    lastRun: recentLogs[0] || null,
    emailConfig: {
      recipientEmail: emailConfig.recipientEmail,
      enabled: emailConfig.enabled,
      daysThreshold: emailConfig.daysThreshold,
      hasSmtpConfigured: Boolean(emailConfig.smtpHost && emailConfig.smtpUser),
    },
    lastEmailLog: emailLogs[0] || null,
  };
}

export function startScheduler() {
  console.log('[SSL Scheduler] Starting background IST monitor (10:30 AM, 2:30 PM, 6:00 PM IST)...');

  // Check every 25 seconds
  setInterval(async () => {
    try {
      const ist = getISTTime();

      for (const slot of SCHEDULED_SLOTS) {
        // Check if current IST matches slot hour and minute (within a 2-minute window)
        const isTargetTime =
          ist.hours === slot.hours &&
          ist.minutes >= slot.minutes &&
          ist.minutes < slot.minutes + 2;

        const slotKey = `${ist.dateKey}_${slot.label}`;

        if (isTargetTime && lastExecutedSlotKey !== slotKey && !isCurrentlyRunning) {
          lastExecutedSlotKey = slotKey;
          console.log(`[SSL Scheduler] Triggering automatic routine check for ${slot.label}...`);
          await runRoutineSSLCheck(slot.label);
        }
      }
    } catch (e) {
      console.error('[SSL Scheduler] Execution tick error:', e);
    }
  }, 25000);
}
