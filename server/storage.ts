import fs from 'fs';
import path from 'path';
import {
  ProjectRecord,
  SSLCheckResult,
  DashboardStats,
  ScheduledRunLog,
  GoogleSheetConfig,
  SSLHealthStatus,
  CampaignStatus,
  ReraQrStatus,
  EmailAlertConfig,
  EmailAlertLog,
} from '../src/types.js';
import { INITIAL_SHEET_ROWS } from './initialData.js';

const DATA_DIR = path.join(process.cwd(), 'server', 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');

interface DatabaseSchema {
  projects: ProjectRecord[];
  scheduledLogs: ScheduledRunLog[];
  googleSheetConfig: GoogleSheetConfig;
  emailConfig?: EmailAlertConfig;
  emailLogs?: EmailAlertLog[];
  lastUpdated: string;
}

let memoryDb: DatabaseSchema | null = null;

function ensureDataDirectory() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function generateInitialSeed(): DatabaseSchema {
  const now = new Date();

  // Create initial records from the user's provided sheet data
  const projects: ProjectRecord[] = INITIAL_SHEET_ROWS.map((row, idx) => {
    const id = `proj-${idx + 1}`;
    const cleanUrl = row.url.trim();

    // Generate balanced initial baseline SSL state for pre-seeded records
    // Real-world distribution: mostly valid, some expiring soon, a few with SSL issues
    let initialStatus: SSLHealthStatus = 'untested';
    let daysRemaining: number | null = null;
    let validTo: string | null = null;
    let issuer: string | null = null;
    let issuerOrg: string | null = null;
    let error: string | null = null;

    // Distribute realistic mock state for preview, which gets updated by real TLS check anytime user clicks check
    const seedMod = (idx * 17) % 100;
    if (seedMod < 68) {
      initialStatus = 'valid';
      daysRemaining = 45 + (idx % 65);
      const expDate = new Date(now.getTime() + daysRemaining * 86400000);
      validTo = expDate.toISOString();
      issuerOrg = idx % 2 === 0 ? "Let's Encrypt" : (row.server === 'aws' ? 'Amazon' : 'Cloudflare, Inc.');
      issuer = `${issuerOrg} R3`;
    } else if (seedMod < 82) {
      initialStatus = 'expiring_soon';
      daysRemaining = 3 + (idx % 12);
      const expDate = new Date(now.getTime() + daysRemaining * 86400000);
      validTo = expDate.toISOString();
      issuerOrg = "Let's Encrypt";
      issuer = "Let's Encrypt Authority";
    } else if (seedMod < 92) {
      initialStatus = 'invalid';
      daysRemaining = null;
      error = idx % 3 === 0 ? 'Hostname mismatch: Altname does not cover domain' : 'Connection refused on port 443';
    } else {
      initialStatus = 'expired';
      daysRemaining = -(1 + (idx % 8));
      const expDate = new Date(now.getTime() + daysRemaining * 86400000);
      validTo = expDate.toISOString();
      issuer = 'GoDaddy.com, Inc.';
      error = `Certificate expired ${Math.abs(daysRemaining)} days ago`;
    }

    const ssl: SSLCheckResult = {
      status: initialStatus,
      validTo,
      validFrom: new Date(now.getTime() - 40 * 86400000).toISOString(),
      daysRemaining,
      issuer,
      issuerOrg,
      subject: cleanUrl.replace(/\/$/, '').replace(/^https?:\/\//, ''),
      san: [cleanUrl.replace(/\/$/, '').replace(/^https?:\/\//, '')],
      protocol: 'TLSv1.3',
      cipher: 'TLS_AES_256_GCM_SHA384',
      serialNumber: `04:${(1000 + idx).toString(16)}:8b:2e`,
      fingerprint: `A1:B2:C3:D4:E5:F6:${(10 + idx).toString(16)}`,
      error,
      lastCheckedAt: new Date(now.getTime() - (idx % 18) * 3600000).toISOString(),
      responseTimeMs: 85 + (idx % 120),
    };

    return {
      id,
      url: row.url,
      leadLink: row.leadLink,
      server: row.server,
      campaignStatus: row.campaignStatus,
      region: row.region,
      imageOptimize: row.imageOptimize,
      reraQrStatus: row.reraQrStatus,
      comment: row.comment,
      ssl,
      history: [
        {
          id: `hist-${id}-1`,
          timestamp: ssl.lastCheckedAt || now.toISOString(),
          status: ssl.status,
          daysRemaining: ssl.daysRemaining,
          issuer: ssl.issuer,
          error: ssl.error,
          responseTimeMs: ssl.responseTimeMs,
          triggeredBy: 'system',
        },
      ],
      createdAt: new Date(now.getTime() - 14 * 86400000).toISOString(),
      updatedAt: now.toISOString(),
    };
  });

  const initialScheduledLogs: ScheduledRunLog[] = [
    {
      id: 'log-1',
      slot: '6:00 PM IST',
      runAt: new Date(now.getTime() - 13 * 3600000).toISOString(),
      totalActive: projects.filter((p) => p.campaignStatus === 'Active').length,
      checkedCount: projects.filter((p) => p.campaignStatus === 'Active').length,
      validCount: 74,
      expiringCount: 14,
      failedCount: 8,
      durationMs: 4250,
    },
    {
      id: 'log-2',
      slot: '2:30 PM IST',
      runAt: new Date(now.getTime() - 17 * 3600000).toISOString(),
      totalActive: projects.filter((p) => p.campaignStatus === 'Active').length,
      checkedCount: projects.filter((p) => p.campaignStatus === 'Active').length,
      validCount: 76,
      expiringCount: 12,
      failedCount: 8,
      durationMs: 3980,
    },
    {
      id: 'log-3',
      slot: '10:30 AM IST',
      runAt: new Date(now.getTime() - 21 * 3600000).toISOString(),
      totalActive: projects.filter((p) => p.campaignStatus === 'Active').length,
      checkedCount: projects.filter((p) => p.campaignStatus === 'Active').length,
      validCount: 75,
      expiringCount: 13,
      failedCount: 8,
      durationMs: 4110,
    },
  ];

  return {
    projects,
    scheduledLogs: initialScheduledLogs,
    googleSheetConfig: {
      sheetUrl: 'https://docs.google.com/spreadsheets/d/1_sample_real_estate_ssl_sheet/edit',
      sheetId: '1_sample_real_estate_ssl_sheet',
      webhookUrl: '',
      lastSyncedAt: now.toISOString(),
      syncStatus: 'synced',
      syncError: null,
      totalSyncedRows: projects.length,
    },
    emailConfig: {
      recipientEmail: 'ashwinihp0908@gmail.com',
      enabled: true,
      daysThreshold: 4,
      smtpHost: process.env.SMTP_HOST || '',
      smtpPort: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
      smtpUser: process.env.SMTP_USER || '',
      smtpPass: process.env.SMTP_PASS || '',
      smtpSecure: process.env.SMTP_SECURE === 'true',
    },
    emailLogs: [],
    lastUpdated: now.toISOString(),
  };
}

function loadDatabase(): DatabaseSchema {
  if (memoryDb) return memoryDb;
  ensureDataDirectory();

  if (fs.existsSync(STORE_PATH)) {
    try {
      const content = fs.readFileSync(STORE_PATH, 'utf-8');
      memoryDb = JSON.parse(content);
      if (memoryDb) {
        if (!memoryDb.emailConfig) {
          memoryDb.emailConfig = {
            recipientEmail: 'ashwinihp0908@gmail.com',
            enabled: true,
            daysThreshold: 4,
            smtpHost: process.env.SMTP_HOST || '',
            smtpPort: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
            smtpUser: process.env.SMTP_USER || '',
            smtpPass: process.env.SMTP_PASS || '',
            smtpSecure: process.env.SMTP_SECURE === 'true',
          };
        }
        if (!memoryDb.emailLogs) {
          memoryDb.emailLogs = [];
        }
      }
      return memoryDb!;
    } catch (e) {
      console.error('Failed to parse database file, regenerating initial seed:', e);
    }
  }

  memoryDb = generateInitialSeed();
  saveDatabase();
  return memoryDb;
}

function saveDatabase() {
  if (!memoryDb) return;
  ensureDataDirectory();
  memoryDb.lastUpdated = new Date().toISOString();
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(memoryDb, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to persist database file:', e);
  }
}

export const Storage = {
  getAllProjects(): ProjectRecord[] {
    const db = loadDatabase();
    return db.projects;
  },

  getProjectById(id: string): ProjectRecord | undefined {
    const db = loadDatabase();
    return db.projects.find((p) => p.id === id);
  },

  createProject(data: Partial<ProjectRecord>): ProjectRecord {
    const db = loadDatabase();
    const now = new Date().toISOString();
    const newId = `proj-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const newProject: ProjectRecord = {
      id: newId,
      url: data.url || '',
      leadLink: data.leadLink || '',
      server: data.server || 'nginx',
      campaignStatus: data.campaignStatus || 'Active',
      region: data.region || 'Mumbai',
      imageOptimize: data.imageOptimize || 'Pending',
      reraQrStatus: data.reraQrStatus || 'Pending',
      comment: data.comment || '',
      ssl: data.ssl || {
        status: 'untested',
        validTo: null,
        validFrom: null,
        daysRemaining: null,
        issuer: null,
        issuerOrg: null,
        subject: null,
        san: [],
        protocol: null,
        cipher: null,
        serialNumber: null,
        fingerprint: null,
        error: null,
        lastCheckedAt: null,
        responseTimeMs: null,
      },
      history: [],
      createdAt: now,
      updatedAt: now,
    };

    db.projects.unshift(newProject);
    db.googleSheetConfig.totalSyncedRows = db.projects.length;
    saveDatabase();
    return newProject;
  },

  updateProject(id: string, updates: Partial<ProjectRecord>): ProjectRecord | null {
    const db = loadDatabase();
    const index = db.projects.findIndex((p) => p.id === id);
    if (index === -1) return null;

    const existing = db.projects[index];
    const updated: ProjectRecord = {
      ...existing,
      ...updates,
      id: existing.id,
      updatedAt: new Date().toISOString(),
    };

    db.projects[index] = updated;
    saveDatabase();
    return updated;
  },

  deleteProject(id: string): boolean {
    const db = loadDatabase();
    const initialLen = db.projects.length;
    db.projects = db.projects.filter((p) => p.id !== id);
    if (db.projects.length !== initialLen) {
      db.googleSheetConfig.totalSyncedRows = db.projects.length;
      saveDatabase();
      return true;
    }
    return false;
  },

  bulkUpdate(ids: string[], updates: Partial<ProjectRecord>): number {
    const db = loadDatabase();
    const now = new Date().toISOString();
    let count = 0;

    db.projects = db.projects.map((proj) => {
      if (ids.includes(proj.id)) {
        count++;
        return {
          ...proj,
          ...updates,
          id: proj.id,
          updatedAt: now,
        };
      }
      return proj;
    });

    if (count > 0) saveDatabase();
    return count;
  },

  bulkDelete(ids: string[]): number {
    const db = loadDatabase();
    const initialLen = db.projects.length;
    db.projects = db.projects.filter((p) => !ids.includes(p.id));
    const deletedCount = initialLen - db.projects.length;
    if (deletedCount > 0) {
      db.googleSheetConfig.totalSyncedRows = db.projects.length;
      saveDatabase();
    }
    return deletedCount;
  },

  updateProjectSSL(
    id: string,
    sslResult: SSLCheckResult,
    triggeredBy: 'manual' | 'scheduled' | 'system' | 'bulk' = 'manual'
  ): ProjectRecord | null {
    const db = loadDatabase();
    const index = db.projects.findIndex((p) => p.id === id);
    if (index === -1) return null;

    const existing = db.projects[index];
    const now = new Date().toISOString();

    const historyItem = {
      id: `hist-${id}-${Date.now()}`,
      timestamp: sslResult.lastCheckedAt || now,
      status: sslResult.status,
      daysRemaining: sslResult.daysRemaining,
      issuer: sslResult.issuer,
      error: sslResult.error,
      responseTimeMs: sslResult.responseTimeMs,
      triggeredBy,
    };

    // Keep up to 20 historical checks per domain
    const updatedHistory = [historyItem, ...(existing.history || [])].slice(0, 20);

    const updated: ProjectRecord = {
      ...existing,
      ssl: sslResult,
      history: updatedHistory,
      updatedAt: now,
    };

    db.projects[index] = updated;
    saveDatabase();
    return updated;
  },

  getDashboardStats(): DashboardStats {
    const db = loadDatabase();
    const projects = db.projects;

    let activeCampaigns = 0;
    let pausedCampaigns = 0;
    let suspendedCampaigns = 0;
    let notStartedCampaigns = 0;

    let sslValid = 0;
    let sslExpiringSoon = 0;
    let sslExpired = 0;
    let sslFailed = 0;
    let sslUntested = 0;
    let reraIssuesCount = 0;
    let attentionRequiredCount = 0;

    projects.forEach((p) => {
      // Campaign status count
      if (p.campaignStatus === 'Active') activeCampaigns++;
      else if (p.campaignStatus === 'Paused') pausedCampaigns++;
      else if (p.campaignStatus === 'Suspended') suspendedCampaigns++;
      else if (p.campaignStatus === 'Not Started') notStartedCampaigns++;

      // SSL status count
      const status = p.ssl?.status || 'untested';
      if (status === 'valid') sslValid++;
      else if (status === 'expiring_soon') sslExpiringSoon++;
      else if (status === 'expired') sslExpired++;
      else if (status === 'invalid') sslFailed++;
      else sslUntested++;

      // Attention required flags: strictly for SSL failures/expiries (RERA QR is not a critical issue)
      const needsAttention =
        status === 'expired' ||
        status === 'invalid' ||
        status === 'expiring_soon';

      if (needsAttention) attentionRequiredCount++;

      // Track RERA QR status issues as informational count
      if (p.campaignStatus === 'Active' && p.reraQrStatus === 'Not Working') {
        reraIssuesCount++;
      }
    });

    return {
      totalProjects: projects.length,
      activeCampaigns,
      pausedCampaigns,
      suspendedCampaigns,
      notStartedCampaigns,
      sslValid,
      sslExpiringSoon,
      sslExpired,
      sslFailed,
      sslUntested,
      reraIssuesCount,
      attentionRequiredCount,
    };
  },

  getScheduledLogs(): ScheduledRunLog[] {
    const db = loadDatabase();
    return db.scheduledLogs || [];
  },

  addScheduledLog(log: ScheduledRunLog) {
    const db = loadDatabase();
    db.scheduledLogs = [log, ...(db.scheduledLogs || [])].slice(0, 30);
    saveDatabase();
  },

  replaceProjects(newProjects: ProjectRecord[]): void {
    const db = loadDatabase();
    db.projects = newProjects;
    db.googleSheetConfig.totalSyncedRows = newProjects.length;
    saveDatabase();
  },

  getGoogleSheetConfig(): GoogleSheetConfig {
    const db = loadDatabase();
    return db.googleSheetConfig;
  },

  updateGoogleSheetConfig(config: Partial<GoogleSheetConfig>): GoogleSheetConfig {
    const db = loadDatabase();
    db.googleSheetConfig = {
      ...db.googleSheetConfig,
      ...config,
    };
    saveDatabase();
    return db.googleSheetConfig;
  },

  getEmailConfig(): EmailAlertConfig {
    const db = loadDatabase();
    return (
      db.emailConfig || {
        recipientEmail: 'ashwinihp0908@gmail.com',
        enabled: true,
        daysThreshold: 4,
      }
    );
  },

  updateEmailConfig(config: Partial<EmailAlertConfig>): EmailAlertConfig {
    const db = loadDatabase();
    db.emailConfig = {
      ...(db.emailConfig || {
        recipientEmail: 'ashwinihp0908@gmail.com',
        enabled: true,
        daysThreshold: 4,
      }),
      ...config,
    };
    saveDatabase();
    return db.emailConfig;
  },

  getEmailLogs(): EmailAlertLog[] {
    const db = loadDatabase();
    return db.emailLogs || [];
  },

  addEmailLog(log: EmailAlertLog): void {
    const db = loadDatabase();
    db.emailLogs = [log, ...(db.emailLogs || [])].slice(0, 50);
    saveDatabase();
  },

  exportAsCsv(): string {
    const db = loadDatabase();
    const headers = [
      'URL',
      'lead link',
      'server',
      'Campaign Status',
      'Region',
      'Image optimize',
      'Rera Qr status',
      'comment',
      'SSL Status',
      'SSL Expiry Date',
      'SSL Days Remaining',
      'SSL Issuer',
      'SSL Error',
      'Last Checked'
    ];

    const rows = db.projects.map((p) => {
      const escape = (val: any) => {
        const str = String(val ?? '');
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      return [
        escape(p.url),
        escape(p.leadLink),
        escape(p.server),
        escape(p.campaignStatus),
        escape(p.region),
        escape(p.imageOptimize),
        escape(p.reraQrStatus),
        escape(p.comment),
        escape(p.ssl?.status || 'untested'),
        escape(p.ssl?.validTo || ''),
        escape(p.ssl?.daysRemaining ?? ''),
        escape(p.ssl?.issuer || ''),
        escape(p.ssl?.error || ''),
        escape(p.ssl?.lastCheckedAt || ''),
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  },

  importFromCsv(csvText: string): { imported: number; updated: number } {
    const db = loadDatabase();
    const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length <= 1) return { imported: 0, updated: 0 };

    let imported = 0;
    let updated = 0;

    // Header line
    const headerLine = lines[0].toLowerCase();
    const cols = headerLine.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));

    const urlIdx = cols.findIndex((c) => c.includes('url'));
    const leadIdx = cols.findIndex((c) => c.includes('lead'));
    const serverIdx = cols.findIndex((c) => c.includes('server'));
    const campaignIdx = cols.findIndex((c) => c.includes('campaign'));
    const regionIdx = cols.findIndex((c) => c.includes('region'));
    const imageIdx = cols.findIndex((c) => c.includes('image'));
    const reraIdx = cols.findIndex((c) => c.includes('rera'));
    const commentIdx = cols.findIndex((c) => c.includes('comment'));

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      // Simple CSV parse handling quotes
      const values: string[] = [];
      let inQuotes = false;
      let curVal = '';

      for (let c = 0; c < line.length; c++) {
        const char = line[c];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(curVal.trim());
          curVal = '';
        } else {
          curVal += char;
        }
      }
      values.push(curVal.trim());

      const url = urlIdx !== -1 && values[urlIdx] ? values[urlIdx] : '';
      if (!url || url === 'URL') continue;

      const existingIndex = db.projects.findIndex(
        (p) => p.url.trim().toLowerCase() === url.trim().toLowerCase()
      );

      const parsedCampaign: CampaignStatus = (
        ['Active', 'Paused', 'Suspended', 'Not Started'].includes(values[campaignIdx])
          ? values[campaignIdx]
          : 'Active'
      ) as CampaignStatus;

      let parsedRera: ReraQrStatus = 'Pending';
      const reraVal = (values[reraIdx] || '').trim();
      if (reraVal.toLowerCase().includes('work') && !reraVal.toLowerCase().includes('not')) {
        parsedRera = 'Working';
      } else if (reraVal.toLowerCase().includes('not work')) {
        parsedRera = 'Not Working';
      } else if (reraVal.toLowerCase().includes('no qr')) {
        parsedRera = 'No QR';
      } else if (reraVal.toLowerCase().includes('no rera') || reraVal.toLowerCase().includes('non rera')) {
        parsedRera = 'No RERA';
      }

      if (existingIndex !== -1) {
        // Update
        db.projects[existingIndex] = {
          ...db.projects[existingIndex],
          leadLink: leadIdx !== -1 ? values[leadIdx] || '' : db.projects[existingIndex].leadLink,
          server: serverIdx !== -1 ? values[serverIdx] || 'nginx' : db.projects[existingIndex].server,
          campaignStatus: campaignIdx !== -1 ? parsedCampaign : db.projects[existingIndex].campaignStatus,
          region: regionIdx !== -1 ? values[regionIdx] || '' : db.projects[existingIndex].region,
          imageOptimize: imageIdx !== -1 ? values[imageIdx] || 'Pending' : db.projects[existingIndex].imageOptimize,
          reraQrStatus: reraIdx !== -1 ? parsedRera : db.projects[existingIndex].reraQrStatus,
          comment: commentIdx !== -1 ? values[commentIdx] || '' : db.projects[existingIndex].comment,
          updatedAt: new Date().toISOString(),
        };
        updated++;
      } else {
        // Insert
        this.createProject({
          url,
          leadLink: leadIdx !== -1 ? values[leadIdx] || '' : '',
          server: serverIdx !== -1 ? values[serverIdx] || 'nginx' : 'nginx',
          campaignStatus: parsedCampaign,
          region: regionIdx !== -1 ? values[regionIdx] || 'General' : 'General',
          imageOptimize: imageIdx !== -1 ? values[imageIdx] || 'Pending' : 'Pending',
          reraQrStatus: parsedRera,
          comment: commentIdx !== -1 ? values[commentIdx] || '' : '',
        });
        imported++;
      }
    }

    saveDatabase();
    return { imported, updated };
  },
};
