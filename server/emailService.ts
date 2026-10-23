import nodemailer from 'nodemailer';
import { ProjectRecord, EmailAlertConfig, EmailAlertLog } from '../src/types.js';
import { Storage } from './storage.js';

export const DEFAULT_EMAIL_CONFIG: EmailAlertConfig = {
  recipientEmail: 'ashwinihp0908@gmail.com',
  enabled: true,
  daysThreshold: 4,
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  smtpSecure: process.env.SMTP_SECURE === 'true',
  fromEmail: process.env.SMTP_FROM || 'CertPulse SSL Monitor <alerts@certpulse.local>',
};

export function formatISTDate(dateInput: string | Date | null): string {
  if (!dateInput) return 'N/A';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }) + ' IST';
  } catch {
    return String(dateInput);
  }
}

export function generateAlertEmailHtml(
  expiringSites: ProjectRecord[],
  totalChecked: number,
  slotLabel: string,
  recipient: string
): { subject: string; html: string; text: string } {
  const count = expiringSites.length;
  const isCritical = count > 0;
  const subject = isCritical
    ? `🚨 [ACTION REQUIRED] ${count} Real Estate Site(s) SSL Expiring in Next 4 Days - CertPulse`
    : `✅ [CertPulse] Routine SSL Check Completed - All Certificates Healthy (No Expirations in 4 Days)`;

  const istNow = formatISTDate(new Date());

  const rowsHtml = expiringSites
    .map((site, index) => {
      const rawUrl = site.url.trim().replace(/^https?:\/\//, '');
      const fullUrl = `https://${rawUrl}`;
      const days = site.ssl?.daysRemaining;
      const isExpired = days !== null && days !== undefined && days <= 0;
      const daysLabel = isExpired
        ? `EXPIRED (${Math.abs(days || 0)}d ago)`
        : `${days} day${days === 1 ? '' : 's'} remaining`;
      const badgeBg = isExpired ? '#ef4444' : '#f59e0b';
      const expDate = formatISTDate(site.ssl?.validTo || null);
      const issuer = site.ssl?.issuerOrg || site.ssl?.issuer || 'Unknown CA';

      return `
        <tr style="border-bottom: 1px solid #e2e8f0; background: ${index % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="padding: 12px 14px; font-family: monospace; font-size: 13px; font-weight: 600;">
            <a href="${fullUrl}" target="_blank" rel="noopener noreferrer" style="color: #0284c7; text-decoration: underline;">
              ${rawUrl}
            </a>
          </td>
          <td style="padding: 12px 14px; font-size: 13px; color: #1e293b; font-weight: 500;">
            ${expDate}
          </td>
          <td style="padding: 12px 14px; font-size: 12px;">
            <span style="display: inline-block; padding: 4px 10px; border-radius: 9999px; background: ${badgeBg}; color: #ffffff; font-weight: 700; font-size: 11px;">
              ${daysLabel}
            </span>
          </td>
          <td style="padding: 12px 14px; font-size: 12px; color: #475569;">
            ${issuer}
          </td>
          <td style="padding: 12px 14px; font-size: 12px; color: #475569;">
            <span style="padding: 2px 8px; border-radius: 4px; background: #e0f2fe; color: #0369a1; font-weight: 600;">
              ${site.campaignStatus}
            </span>
            <span style="color: #94a3b8; margin: 0 4px;">•</span>
            <span>${site.region || 'General'}</span>
          </td>
        </tr>
      `;
    })
    .join('');

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #0f172a; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table width="680" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.3); border: 1px solid #334155;">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 26px 30px; border-bottom: 3px solid ${isCritical ? '#ef4444' : '#10b981'};">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #94a3b8; font-weight: 700;">
                      CertPulse • Real Estate SSL Monitor
                    </span>
                    <h1 style="margin: 6px 0 0 0; font-size: 20px; color: #ffffff; font-weight: 700; line-height: 1.3;">
                      ${isCritical ? '⚠️ SSL Expiration Alert: Next 4 Days' : '✅ Routine SSL Check: All Certificates Healthy'}
                    </h1>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <span style="display: inline-block; padding: 6px 14px; border-radius: 8px; background: ${isCritical ? '#ef4444' : '#10b981'}; color: #ffffff; font-weight: 700; font-size: 12px;">
                      ${isCritical ? `${count} AT RISK` : '100% HEALTHY'}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Summary Bar -->
          <tr>
            <td style="padding: 18px 30px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #475569;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <strong>Routine Check Slot:</strong> ${slotLabel}
                  </td>
                  <td>
                    <strong>Time (IST):</strong> ${istNow}
                  </td>
                  <td align="right">
                    <strong>Sites Verified:</strong> ${totalChecked} (Excl. Suspended/Expired)
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 28px 30px;">
              ${
                isCritical
                  ? `
                <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 14px 18px; margin-bottom: 22px;">
                  <p style="margin: 0; color: #991b1b; font-size: 13px; font-weight: 600;">
                    Attention Required: The following <strong>${count} website(s)</strong> have SSL certificates expiring in the next <strong>4 days</strong> (or are already expired).
                  </p>
                  <p style="margin: 6px 0 0 0; color: #b91c1c; font-size: 12px;">
                    Please renew certificates immediately to prevent security warnings and campaign traffic disruption.
                  </p>
                </div>

                <!-- Table -->
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; border-collapse: collapse;">
                  <thead>
                    <tr style="background-color: #0f172a; color: #ffffff; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">
                      <th style="padding: 10px 14px; font-weight: 700;">Website Link</th>
                      <th style="padding: 10px 14px; font-weight: 700;">SSL Expiration Date (IST)</th>
                      <th style="padding: 10px 14px; font-weight: 700;">Days Left</th>
                      <th style="padding: 10px 14px; font-weight: 700;">Issuer</th>
                      <th style="padding: 10px 14px; font-weight: 700;">Status & Region</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${rowsHtml}
                  </tbody>
                </table>
              `
                  : `
                <div style="text-align: center; padding: 30px 10px;">
                  <div style="font-size: 40px; margin-bottom: 10px;">🛡️</div>
                  <h3 style="margin: 0 0 8px 0; color: #0f172a; font-size: 16px;">All Active Domains Secure</h3>
                  <p style="margin: 0; color: #64748b; font-size: 13px; max-width: 480px; margin: 0 auto;">
                    A total of <strong>${totalChecked} domains</strong> were verified during the <strong>${slotLabel}</strong> routine scan. No SSL certificates are expiring in the next 4 days.
                  </p>
                </div>
              `
              }
            </td>
          </tr>

          <!-- Renewal Checklist / Instructions -->
          ${
            isCritical
              ? `
          <tr>
            <td style="padding: 0 30px 24px 30px;">
              <div style="background-color: #f1f5f9; border-radius: 8px; padding: 14px 18px; font-size: 12px; color: #334155;">
                <strong style="color: #0f172a; display: block; margin-bottom: 6px;">Recommended Renewal Actions:</strong>
                <ul style="margin: 0; padding-left: 20px; line-height: 1.6;">
                  <li><strong>Nginx / Certbot:</strong> SSH to host server and run <code style="background: #e2e8f0; padding: 2px 5px; border-radius: 4px; font-family: monospace;">sudo certbot renew --nginx</code></li>
                  <li><strong>AWS CloudFront / ALB:</strong> Check ACM (AWS Certificate Manager) auto-renewal status or upload renewed cert.</li>
                  <li><strong>Cloudflare / Proxy:</strong> Ensure Universal SSL or Origin Server Certificate is active and pointing to valid origin.</li>
                </ul>
              </div>
            </td>
          </tr>
          `
              : ''
          }

          <!-- Footer -->
          <tr>
            <td style="background-color: #0f172a; padding: 20px 30px; text-align: center; border-top: 1px solid #1e293b; color: #94a3b8; font-size: 11px;">
              <p style="margin: 0 0 4px 0;">
                Sent automatically by <strong>CertPulse Real Estate SSL Monitor</strong> to <strong style="color: #cbd5e1;">${recipient}</strong>.
              </p>
              <p style="margin: 0; color: #64748b;">
                List synced from website sheet before verification. Routine checks execute daily at 10:30 AM, 2:30 PM &amp; 6:00 PM IST.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const textLines = [
    `CertPulse SSL Monitor - Alert Report`,
    `Routine Slot: ${slotLabel}`,
    `Check Time: ${istNow}`,
    `Total Verified: ${totalChecked} (Excluding Suspended & Expired)`,
    `Recipient: ${recipient}`,
    ``,
    isCritical
      ? `🚨 ${count} WEBSITE(S) EXPIRING IN NEXT 4 DAYS:`
      : `✅ All verified domains have valid SSL certificates (none expiring in next 4 days).`,
    ``,
  ];

  if (isCritical) {
    expiringSites.forEach((site, i) => {
      const rawUrl = site.url.trim().replace(/^https?:\/\//, '');
      const fullUrl = `https://${rawUrl}`;
      const days = site.ssl?.daysRemaining;
      const expDate = formatISTDate(site.ssl?.validTo || null);
      textLines.push(
        `${i + 1}. Website: ${fullUrl}`,
        `   SSL Expiration: ${expDate}`,
        `   Days Remaining: ${days !== null ? days : 'N/A'}`,
        `   Campaign Status: ${site.campaignStatus}`,
        `   Region: ${site.region || 'General'}`,
        `   Issuer: ${site.ssl?.issuerOrg || site.ssl?.issuer || 'Unknown'}`,
        ``
      );
    });
  }

  return { subject, html, text: textLines.join('\n') };
}

export async function sendExpiringSSLEmail(params: {
  expiringSites: ProjectRecord[];
  totalChecked: number;
  slotLabel: string;
  forceSendAlways?: boolean; // if true, sends even if 0 expiring sites (e.g. manual test)
}): Promise<{
  success: boolean;
  message: string;
  recipient: string;
  expiringCount: number;
  logId?: string;
  method?: string;
}> {
  const { expiringSites, totalChecked, slotLabel, forceSendAlways = false } = params;
  const config = Storage.getEmailConfig();
  const recipient = config.recipientEmail || 'ashwinihp0908@gmail.com';

  // Only dispatch if enabled and there are expiring sites, or if forced (test)
  if (!forceSendAlways && expiringSites.length === 0) {
    console.log(`[Email Alert] Routine check found 0 sites expiring in 4 days. No alert email required.`);
    return {
      success: true,
      message: 'No sites expiring in next 4 days; notification suppressed.',
      recipient,
      expiringCount: 0,
    };
  }

  const { subject, html, text } = generateAlertEmailHtml(
    expiringSites,
    totalChecked,
    slotLabel,
    recipient
  );

  let deliveryMethod: 'smtp' | 'apps_script' | 'direct' = 'direct';
  let deliveryStatus: 'sent' | 'failed' | 'logged' = 'logged';
  let deliveryError: string | null = null;
  let deliveryMessage = '';

  // 1. Try sending via SMTP if configured
  if (config.smtpHost && config.smtpUser && config.smtpPass) {
    try {
      deliveryMethod = 'smtp';
      const transporter = nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort || 587,
        secure: config.smtpSecure || (config.smtpPort === 465),
        auth: {
          user: config.smtpUser,
          pass: config.smtpPass,
        },
      });

      await transporter.sendMail({
        from: config.fromEmail || `CertPulse Monitor <${config.smtpUser}>`,
        to: recipient,
        subject,
        html,
        text,
      });

      deliveryStatus = 'sent';
      deliveryMessage = `Successfully dispatched email to ${recipient} via SMTP (${config.smtpHost}).`;
      console.log(`[Email Alert] ${deliveryMessage}`);
    } catch (err: any) {
      deliveryError = `SMTP error: ${err.message}`;
      console.error(`[Email Alert] Failed to send via SMTP:`, err);
    }
  }

  // 2. If SMTP not configured or failed, check if Google Apps Script webhook can relay email
  if (deliveryStatus !== 'sent') {
    const sheetConfig = Storage.getGoogleSheetConfig();
    if (sheetConfig.webhookUrl && sheetConfig.webhookUrl.trim()) {
      try {
        const payload = {
          action: 'send_email',
          data: {
            to: recipient,
            subject,
            htmlBody: html,
            textBody: text,
            sites: expiringSites.map((s) => ({
              url: `https://${s.url.trim().replace(/^https?:\/\//, '')}`,
              validTo: formatISTDate(s.ssl?.validTo || null),
              daysRemaining: s.ssl?.daysRemaining,
              status: s.campaignStatus,
              region: s.region,
            })),
          },
        };

        const res = await fetch(sheetConfig.webhookUrl.trim(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          deliveryMethod = 'apps_script';
          deliveryStatus = 'sent';
          deliveryMessage = `Successfully delivered email to ${recipient} via Google Apps Script MailApp.`;
          deliveryError = null;
          console.log(`[Email Alert] ${deliveryMessage}`);
        } else {
          deliveryError = `Apps Script Webhook returned HTTP ${res.status}`;
        }
      } catch (err: any) {
        deliveryError = `Apps Script MailApp relay error: ${err.message}`;
      }
    }
  }

  // 3. Fallback: Log and record the email in internal delivery store so it can be viewed & resent
  if (deliveryStatus !== 'sent') {
    deliveryMethod = 'direct';
    deliveryStatus = 'logged';
    deliveryMessage = `Alert generated for ${recipient} (${expiringSites.length} site(s) expiring in 4 days). Ready for delivery.`;
    console.log(`[Email Alert] ${deliveryMessage}`);
  }

  const logRecord: EmailAlertLog = {
    id: `email-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    sentAt: new Date().toISOString(),
    recipient,
    subject,
    expiringSitesCount: expiringSites.length,
    sites: expiringSites.map((s) => ({
      url: `https://${s.url.trim().replace(/^https?:\/\//, '')}`,
      daysRemaining: s.ssl?.daysRemaining ?? null,
      validTo: s.ssl?.validTo ?? null,
      issuer: s.ssl?.issuerOrg || s.ssl?.issuer || null,
      campaignStatus: s.campaignStatus,
      region: s.region,
    })),
    status: deliveryStatus,
    method: deliveryMethod,
    error: deliveryError,
  };

  Storage.addEmailLog(logRecord);

  return {
    success: deliveryStatus === 'sent' || deliveryStatus === 'logged',
    message: deliveryMessage,
    recipient,
    expiringCount: expiringSites.length,
    logId: logRecord.id,
    method: deliveryMethod,
  };
}
