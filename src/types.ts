export type CampaignStatus = 'Active' | 'Paused' | 'Suspended' | 'Not Started' | 'Expired';

export type ReraQrStatus = 'Working' | 'Not Working' | 'No QR' | 'No RERA' | 'Pending';

export type SSLHealthStatus = 'valid' | 'expiring_soon' | 'expired' | 'invalid' | 'untested';

export type ServerType = 'nginx' | 'aws' | string;

export interface SSLCheckResult {
  status: SSLHealthStatus;
  validTo: string | null; // ISO string
  validFrom: string | null; // ISO string
  daysRemaining: number | null;
  issuer: string | null;
  issuerOrg: string | null;
  subject: string | null;
  san: string[];
  protocol: string | null;
  cipher: string | null;
  serialNumber: string | null;
  fingerprint: string | null;
  error: string | null;
  lastCheckedAt: string | null; // ISO string
  responseTimeMs: number | null;
}

export interface SSLHistoryItem {
  id: string;
  timestamp: string;
  status: SSLHealthStatus;
  daysRemaining: number | null;
  issuer: string | null;
  error: string | null;
  responseTimeMs: number | null;
  triggeredBy: 'manual' | 'scheduled' | 'system' | 'bulk';
}

export interface ProjectRecord {
  id: string;
  // Sheet fields preserved strictly
  url: string;
  leadLink: string;
  server: string;
  campaignStatus: CampaignStatus;
  region: string;
  imageOptimize: string;
  reraQrStatus: ReraQrStatus;
  comment: string;
  // SSL monitoring state
  ssl: SSLCheckResult;
  history: SSLHistoryItem[];
  // Metadata
  createdAt: string;
  updatedAt: string;
}

export interface ScheduledRunLog {
  id: string;
  slot: '10:30 AM IST' | '2:30 PM IST' | '6:00 PM IST' | 'Manual Batch';
  runAt: string;
  totalActive: number;
  checkedCount: number;
  validCount: number;
  expiringCount: number;
  failedCount: number;
  durationMs: number;
  syncedFromSheet?: boolean;
  syncedRowsCount?: number;
  emailSent?: boolean;
  emailRecipient?: string;
  emailExpiringCount?: number;
}

export interface GoogleSheetConfig {
  sheetUrl: string;
  sheetId: string;
  webhookUrl: string;
  lastSyncedAt: string | null;
  syncStatus: 'idle' | 'syncing' | 'synced' | 'error';
  syncError: string | null;
  totalSyncedRows: number;
}

export interface EmailAlertConfig {
  recipientEmail: string;
  enabled: boolean;
  daysThreshold: number; // default: 4 (expires in next 4 days)
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpSecure?: boolean;
  fromEmail?: string;
}

export interface EmailAlertLog {
  id: string;
  sentAt: string;
  recipient: string;
  subject: string;
  expiringSitesCount: number;
  sites: Array<{
    url: string;
    daysRemaining: number | null;
    validTo: string | null;
    issuer?: string | null;
    campaignStatus?: string;
    region?: string;
  }>;
  status: 'sent' | 'failed' | 'logged';
  method: 'smtp' | 'apps_script' | 'direct';
  error?: string | null;
}

export interface DashboardStats {
  totalProjects: number;
  activeCampaigns: number;
  pausedCampaigns: number;
  suspendedCampaigns: number;
  notStartedCampaigns: number;
  sslValid: number;
  sslExpiringSoon: number; // < 15 days
  sslExpired: number;
  sslFailed: number;
  sslUntested: number;
  reraIssuesCount: number; // Not Working while Active
  attentionRequiredCount: number;
}

export interface FilterOptions {
  search: string;
  campaignStatus: CampaignStatus | 'ALL';
  reraQrStatus: string | 'ALL';
  region: string | 'ALL';
  server: string | 'ALL';
  leadLink?: string | 'ALL';
  imageOptimize?: string | 'ALL';
  sslStatus: SSLHealthStatus | 'attention' | 'ALL';
  daysRemainingFilter: 'all' | '7' | '15' | '30' | 'expired' | 'lt7' | 'lt15' | 'lt30';
}
