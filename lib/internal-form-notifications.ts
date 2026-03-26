const INTERNAL_FORM_NOTIFICATION_RECIPIENTS = ['roxy.viulet@gmail.com', 'dani.iancu@yahoo.com'];

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export async function sendInternalFormNotificationEmail(input: {
  type: 'review' | 'complaint' | 'lost_property';
  subject: string;
  lines: string[];
  htmlLines: Array<{ label: string; value: string }>;
  errorLabel: string;
}) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM;
  if (!resendApiKey || !emailFrom) return;

  const html = `
    <h2>${escapeHtml(input.subject)}</h2>
    ${input.htmlLines
      .map(
        (line) =>
          `<p><strong>${escapeHtml(line.label)}:</strong> ${escapeHtml(line.value || 'N/A').replace(/\n/g, '<br />')}</p>`
      )
      .join('')}
  `;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: emailFrom,
      to: INTERNAL_FORM_NOTIFICATION_RECIPIENTS,
      subject: input.subject,
      html,
      text: input.lines.join('\n'),
    }),
  }).catch((err) => {
    console.error(input.errorLabel, err);
  });
}
