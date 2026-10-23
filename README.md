# CertPulse - Real Estate SSL Monitor & Campaign Dashboard

A high-performance SSL certificate monitoring dashboard for real estate campaigns with 2-way Google Sheets integration, automated IST batch schedules, and live Excel (.xlsx) file synchronization.

---

## 📁 Data Storage Quick Reference

All application data is persisted in the **`/server/data/`** directory:

- **Primary JSON Database**: `/server/data/store.json`
  - Stores all 195+ projects, SSL certificate health metrics, certificate expiration dates, history, and automated IST scheduler logs.
- **Mirrored Excel Spreadsheet**: `/server/data/RealEstate_Campaigns.xlsx`
  - Automatically regenerated whenever you add a project or change Campaign Status, RERA QR Status, or Image Optimize.
  - Downloadable anytime using the **"Download Excel (.xlsx)"** button in the dashboard or via `/api/sheets/export-excel`.
- **Google Sheets 2-Way Sync**:
  - Pushes real-time edits directly to your Google Sheet using Google Apps Script Webhooks.

👉 **For complete details on data schemas, file paths, and sync flows, see [DATA_STORAGE.md](./DATA_STORAGE.md).**

---

## 🚀 Key Features

- **Live TLS/SSL Handshake Engine**: Direct Node.js `tls.connect` validation measuring expiry dates, cipher suites, TLS version (TLS 1.2 / 1.3), SANs, and certificate issuer details.
- **Dual Automated IST Daily Schedule**: Automated batch checking at 10:00 AM IST and 04:00 PM IST with next-slot countdown timer.
- **Excel (.xlsx) & CSV Export**: One-click download of the complete dataset with all campaign attributes and SSL statuses.
- **Interactive Inline Controls**: Quick dropdowns for Campaign Status, RERA QR Status, and Image Optimize (`Done` / `Pending`).
- **Dark & Light Mode**: Tailored for enterprise monitoring with high-contrast status badges and smooth pagination.
