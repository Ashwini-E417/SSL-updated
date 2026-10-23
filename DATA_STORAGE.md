# Data Storage & Architecture Guide

This document explains where and how data is stored, persisted, synchronized, and backed up in **CertPulse - Real Estate SSL Monitor**.

---

## 1. Storage Overview

The application utilizes a **multi-tiered storage model** designed for reliability, immediate persistence, and flexible export:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        User Actions & SSL Engine                       │
│  (Add Project, Edit Status, RERA QR, Image Optimize, Run SSL Checks)   │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    ▼                                 ▼
       ┌─────────────────────────┐       ┌─────────────────────────┐
       │   1. Primary Storage    │       │ 2. Excel Workbook Sync  │
       │   `server/data/         │       │ `server/data/           │
       │    store.json`          │       │  RealEstate_            │
       │                         │       │  Campaigns.xlsx`        │
       │  (JSON Database file    │       │                         │
       │   persisted to disk)    │       │ (Dynamic .xlsx file     │
       └────────────┬────────────┘       │  ready for download)    │
                    │                    └─────────────────────────┘
                    ▼
       ┌─────────────────────────┐
       │  3. Google Sheet Sync   │
       │  (Remote 2-Way Webhook) │
       │                         │
       │  Google Sheets API /    │
       │  Apps Script Webhook    │
       └─────────────────────────┘
```

---

## 2. Exact File Locations on Disk

All application data resides inside the **`/server/data/`** directory:

| Storage File | Path | Description |
| :--- | :--- | :--- |
| **Primary JSON Database** | `/server/data/store.json` | Stores the complete dataset including projects, SSL certificate details, check histories, IST scheduler logs, and Google Sheet connection settings. |
| **Mirrored Excel File** | `/server/data/RealEstate_Campaigns.xlsx` | Binary Excel workbook updated automatically on every addition, edit, or status change. Downloadable directly from the dashboard. |
| **Initial Seed Dataset** | `/server/initialData.ts` | The original baseline array of 195+ real estate projects and domains loaded if `store.json` is initialized for the first time. |

---

## 3. Data Schema Details

### A. Project Record (`ProjectRecord`)
Stored inside the `projects` array in `store.json`:

```typescript
{
  "id": "proj-1",
  "url": "example-realestate.com",
  "leadLink": "bit.ly/example",
  "server": "nginx" | "apache" | "aws",
  "campaignStatus": "Active" | "Paused" | "Suspended" | "Not Started",
  "region": "Bangalore" | "Mumbai" | "Delhi NCR" | "Pune" | "Hyderabad" | ...,
  "imageOptimize": "Done" | "Pending",
  "reraQrStatus": "Working" | "Not Working" | "No QR" | "No RERA" | "Pending",
  "comment": "Google Ad Lead Campaign Q3",
  "ssl": {
    "status": "valid" | "expiring_soon" | "expired" | "invalid" | "untested",
    "daysRemaining": 42,
    "validFrom": "2026-06-01T00:00:00.000Z",
    "validTo": "2026-10-15T23:59:59.000Z",
    "issuer": "Let's Encrypt Authority X3",
    "issuerOrg": "Let's Encrypt",
    "subject": "example-realestate.com",
    "protocol": "TLSv1.3",
    "cipher": "TLS_AES_256_GCM_SHA384",
    "serialNumber": "04A1B2C3D4...",
    "sans": ["example-realestate.com", "www.example-realestate.com"],
    "checkDurationMs": 240,
    "lastCheckedAt": "2026-09-07T14:30:00.000Z",
    "error": null
  },
  "history": [
    {
      "timestamp": "2026-09-07T14:30:00.000Z",
      "status": "valid",
      "daysRemaining": 42,
      "source": "scheduler" | "manual"
    }
  ],
  "createdAt": "2026-09-01T10:00:00.000Z"
}
```

### B. Scheduled Execution Logs (`scheduledLogs`)
Tracks automated batch checks (daily IST 10:00 AM & 04:00 PM):

```typescript
{
  "id": "run-1725732000000",
  "timestamp": "2026-09-07T04:30:00.000Z",
  "istFormatted": "07/09/2026, 10:00:00 am",
  "slot": "10:00 AM IST",
  "totalChecked": 182,
  "healthyCount": 164,
  "attentionCount": 18,
  "durationMs": 4250,
  "status": "completed"
}
```

### C. Google Sheets Config (`googleSheetConfig`)

```typescript
{
  "sheetUrl": "https://docs.google.com/spreadsheets/d/.../edit",
  "webhookUrl": "https://script.google.com/macros/s/.../exec",
  "lastSyncedAt": "2026-09-07T15:20:00.000Z",
  "totalSyncedRows": 195,
  "syncStatus": "synced" | "error" | "never"
}
```

---

## 4. How Synchronization Works

### 1. Adding a Project or Modifying Status
Whenever you add a project, or update **Campaign Status**, **RERA QR Status**, or **Image Optimize**:
1. **Immediate Write to `store.json`**: The record in `/server/data/store.json` is updated synchronously.
2. **Immediate Excel Generation**: The `/server/data/RealEstate_Campaigns.xlsx` file is regenerated with the latest data across all columns.
3. **Google Sheets Webhook Sync**: If a Google Apps Script Webhook URL is configured, an HTTP POST request is dispatched to update or insert the row in your remote Google Sheet.

### 2. Exporting / Downloading Your Data
- **Excel (.xlsx)**: Available via the **"Download Excel (.xlsx)"** button in the dashboard or by accessing `/api/sheets/export-excel`.
- **CSV (.csv)**: Available via the **"Export CSV"** button or `/api/sheets/export-csv`.

### 3. Remote Google Sheet 2-Way Sync
- **Pull**: Fetches the latest rows from your public or shared Google Sheet URL (`/api/sheets/sync-pull`).
- **Push All**: Sends the complete dashboard dataset to your Google Sheet (`/api/sheets/push-all`).
- **Webhook**: Google Apps Script script embedded in your sheet receives real-time edits directly.

---

## 5. Summary of REST API Endpoints

| Method | Endpoint | Purpose |
| :--- | :--- | :--- |
| `GET` | `/api/projects` | Fetch all project records and SSL statuses |
| `POST` | `/api/projects` | Create a new project (updates JSON, Excel, & Google Sheet) |
| `PUT` | `/api/projects/:id` | Update project fields/statuses (updates JSON, Excel, & Google Sheet) |
| `DELETE` | `/api/projects/:id` | Delete project |
| `POST` | `/api/projects/bulk-update` | Bulk update Campaign Status, RERA QR, or Image Optimize |
| `POST` | `/api/ssl/check/:id` | Run live TLS socket handshake check on a domain |
| `POST` | `/api/ssl/check-batch` | Run live SSL check on multiple selected domains |
| `GET` | `/api/sheets/export-excel` | Download the generated `.xlsx` Excel spreadsheet |
| `GET` | `/api/sheets/export-csv` | Download the dataset as `.csv` |
| `POST` | `/api/sheets/sync-pull` | Pull and merge rows from a Google Sheet |
| `POST` | `/api/sheets/push-all` | Push all local projects to Google Sheet webhook |
| `POST` | `/api/sheets/test-webhook` | Test Google Apps Script Webhook connection |
