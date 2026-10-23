import fs from 'fs';
import path from 'path';
import { Storage } from './storage.js';
import { CampaignStatus, ReraQrStatus, ProjectRecord } from '../src/types.js';

const MASTER_SHEET_PATH = path.join(process.cwd(), 'public', 'assets', 'aistudio', 'Website_List_8168d209');

/**
 * Standard RFC-4180 compliant CSV parser.
 * Handles embedded quotes, commas inside fields, and multi-line values.
 */
export function parseRFC4180CSV(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++; // skip next quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentField);
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentField);
      currentField = '';
      if (currentRow.some((f) => f.trim().length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some((f) => f.trim().length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

export function normalizeDomain(url: string): string {
  return url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .replace(/^www\./, '');
}

export function parseCampaignStatus(raw: string): CampaignStatus {
  const val = (raw || '').trim().toLowerCase();
  if (val.includes('suspend')) return 'Suspended';
  if (val.includes('expire')) return 'Expired';
  if (val.includes('pause')) return 'Paused';
  if (val.includes('not start')) return 'Not Started';
  return 'Active';
}

export function parseReraStatus(raw: string): ReraQrStatus {
  const val = (raw || '').trim().toLowerCase();
  if (val.includes('not work')) return 'Not Working';
  if (val.includes('no qr')) return 'No QR';
  if (val.includes('no rera') || val.includes('non rera')) return 'No RERA';
  if (val.includes('work')) return 'Working';
  return 'Pending';
}

export async function syncFromMasterSheet(customSheetUrl?: string): Promise<{
  success: boolean;
  message: string;
  source: string;
  totalRows: number;
  updated: number;
  inserted: number;
}> {
  try {
    let csvContent = '';
    let sourceLabel = 'Local Website Sheet (Website_List_8168d209)';

    // 1. If customSheetUrl or configured remote Google Sheet URL is provided and not default placeholder, try fetching
    const config = Storage.getGoogleSheetConfig();
    const targetUrl = customSheetUrl || config.sheetUrl;

    if (
      targetUrl &&
      targetUrl.includes('spreadsheets/d/') &&
      !targetUrl.includes('1_sample_real_estate_ssl_sheet')
    ) {
      try {
        const match = targetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        const sheetId = match ? match[1] : targetUrl;
        const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
        const res = await fetch(exportUrl, {
          headers: { 'User-Agent': 'CertPulse-SSL-Monitor/1.0' },
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) {
          csvContent = await res.text();
          sourceLabel = `Google Sheet (${sheetId})`;
        }
      } catch (remoteErr: any) {
        console.warn(`[SheetSync] Could not pull from remote sheet (${remoteErr.message}), falling back to master file.`);
      }
    }

    // 2. If no remote content fetched, read from local master file
    if (!csvContent) {
      if (fs.existsSync(MASTER_SHEET_PATH)) {
        csvContent = fs.readFileSync(MASTER_SHEET_PATH, 'utf-8');
        sourceLabel = 'Website_List_8168d209';
      } else {
        throw new Error(`Master sheet file not found at ${MASTER_SHEET_PATH}`);
      }
    }

    // 3. Parse CSV rows
    const parsedRows = parseRFC4180CSV(csvContent);
    if (parsedRows.length <= 1) {
      return {
        success: false,
        message: 'Sheet contains no data rows',
        source: sourceLabel,
        totalRows: 0,
        updated: 0,
        inserted: 0,
      };
    }

    const headerRow = parsedRows[0].map((h) => h.trim().toLowerCase());
    const colMap = {
      url: headerRow.findIndex((h) => h === 'url' || h.includes('website') || h.includes('domain')),
      leadLink: headerRow.findIndex((h) => h.includes('lead')),
      server: headerRow.findIndex((h) => h.includes('server')),
      campaignStatus: headerRow.findIndex((h) => h.includes('campaign') || h === 'status'),
      region: headerRow.findIndex((h) => h.includes('region')),
      imageOptimize: headerRow.findIndex((h) => h.includes('image')),
      reraQrStatus: headerRow.findIndex((h) => h.includes('rera')),
      comment: headerRow.findIndex((h) => h.includes('comment')),
    };

    const existingProjects = Storage.getAllProjects();
    const existingMap = new Map<string, ProjectRecord>();
    for (const proj of existingProjects) {
      existingMap.set(normalizeDomain(proj.url), proj);
    }

    let updatedCount = 0;
    let insertedCount = 0;
    const syncedProjects: ProjectRecord[] = [];
    const processedNormDomains = new Set<string>();

    for (let i = 1; i < parsedRows.length; i++) {
      const row = parsedRows[i];
      const rawUrl = colMap.url !== -1 && row[colMap.url] ? row[colMap.url].trim() : '';
      if (!rawUrl || rawUrl.toLowerCase() === 'url') continue;

      const normDomain = normalizeDomain(rawUrl);
      if (processedNormDomains.has(normDomain)) {
        // Skip duplicate rows in same sheet
        continue;
      }
      processedNormDomains.add(normDomain);

      const leadLink = colMap.leadLink !== -1 && row[colMap.leadLink] ? row[colMap.leadLink].trim() : '';
      const server = colMap.server !== -1 && row[colMap.server] ? row[colMap.server].trim() : 'nginx';
      const rawCamp = colMap.campaignStatus !== -1 && row[colMap.campaignStatus] ? row[colMap.campaignStatus].trim() : 'Active';
      const campaignStatus = parseCampaignStatus(rawCamp);
      const region = colMap.region !== -1 && row[colMap.region] ? row[colMap.region].trim() : 'General';
      const imageOptimize = colMap.imageOptimize !== -1 && row[colMap.imageOptimize] ? row[colMap.imageOptimize].trim() : 'Pending';
      const rawRera = colMap.reraQrStatus !== -1 && row[colMap.reraQrStatus] ? row[colMap.reraQrStatus].trim() : 'Pending';
      const reraQrStatus = parseReraStatus(rawRera);
      const comment = colMap.comment !== -1 && row[colMap.comment] ? row[colMap.comment].trim() : '';

      const existing = existingMap.get(normDomain);
      const now = new Date().toISOString();

      if (existing) {
        // Update metadata from sheet while strictly preserving SSL inspection data & history
        const updatedRecord: ProjectRecord = {
          ...existing,
          url: rawUrl,
          leadLink,
          server,
          campaignStatus,
          region,
          imageOptimize,
          reraQrStatus,
          comment,
          updatedAt: now,
        };
        syncedProjects.push(updatedRecord);
        updatedCount++;
      } else {
        // New project entry from sheet
        const newRecord: ProjectRecord = {
          id: `proj-${Date.now()}-${i}`,
          url: rawUrl,
          leadLink,
          server,
          campaignStatus,
          region,
          imageOptimize,
          reraQrStatus,
          comment,
          ssl: {
            status: 'untested',
            validTo: null,
            validFrom: null,
            daysRemaining: null,
            issuer: null,
            issuerOrg: null,
            subject: normDomain,
            san: [normDomain],
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
        syncedProjects.push(newRecord);
        insertedCount++;
      }
    }

    // Replace the database projects array with the synchronized list from the sheet
    Storage.replaceProjects(syncedProjects);

    // Update sheet sync config
    Storage.updateGoogleSheetConfig({
      lastSyncedAt: new Date().toISOString(),
      syncStatus: 'synced',
      syncError: null,
      totalSyncedRows: syncedProjects.length,
    });

    console.log(
      `[SheetSync] Synchronized ${syncedProjects.length} sites from ${sourceLabel}: ${updatedCount} updated, ${insertedCount} new.`
    );

    return {
      success: true,
      message: `Synchronized ${syncedProjects.length} sites from ${sourceLabel}: ${updatedCount} updated, ${insertedCount} new.`,
      source: sourceLabel,
      totalRows: syncedProjects.length,
      updated: updatedCount,
      inserted: insertedCount,
    };
  } catch (err: any) {
    console.error('[SheetSync] Sync failed:', err);
    Storage.updateGoogleSheetConfig({
      syncStatus: 'error',
      syncError: err.message,
    });
    return {
      success: false,
      message: err.message || 'Sheet synchronization failed',
      source: 'Unknown',
      totalRows: 0,
      updated: 0,
      inserted: 0,
    };
  }
}
