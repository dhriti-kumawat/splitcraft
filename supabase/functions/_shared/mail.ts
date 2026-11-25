// Emails from the contact function, sent through Resend (https://resend.com).
//
// Secrets (npx supabase secrets set …):
//   RESEND_API_KEY  required for any email; without it nothing is sent.
//   NOTIFY_EMAIL    where new questions and access requests go (the owner's inbox).
//   MAIL_FROM       sender, e.g. "Splitcraft <hello@your-domain.com>", on a domain verified in
//                   Resend. Without it, notices go from Resend's test sender, which can only
//                   mail the Resend account's own address, and no auto-replies are sent.

import type { ContactKind } from './contact.ts';

export const DEMO_URL = 'https://splitcraft-app.vercel.app/demo.html';
const TEST_SENDER = 'Splitcraft <onboarding@resend.dev>';

export interface Mail {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}

export interface MailEnv {
  RESEND_API_KEY?: string;
  NOTIFY_EMAIL?: string;
  MAIL_FROM?: string;
}

/** The email to the owner about a new question or access request. Replying answers the sender. */
export function ownerNotice(kind: ContactKind, email: string, message: string, to: string): Mail {
  const what = kind === 'access' ? 'access request' : 'question';
  return {
    to,
    subject: `New ${what} from ${email}`,
    text: `${message}\n\n---\nFrom ${email}. Reply to this email to answer them.`,
    replyTo: email,
  };
}

/** The confirmation sent to someone who asked for access. Replies reach the owner. */
export function accessReply(email: string, replyTo?: string): Mail {
  return {
    to: email,
    subject: 'Your Splitcraft access request is in',
    text: [
      'Hi,',
      '',
      "Thanks for asking for access to Splitcraft. Your request is in, and we'll reply to this " +
        'address once we have read it.',
      '',
      'Meanwhile, you can look around the dashboard with example data, no account needed:',
      DEMO_URL,
      '',
      'If you have a question, reply to this email.',
      '',
      'Splitcraft',
    ].join('\n'),
    replyTo,
  };
}

/**
 * The emails to send for a stored message: a notice to the owner (when NOTIFY_EMAIL is set) and,
 * for a first access request from this address, a confirmation (only with a verified MAIL_FROM).
 */
export function mailsFor(
  kind: ContactKind,
  email: string,
  message: string,
  env: MailEnv,
  firstRequest: boolean,
): Mail[] {
  if (!env.RESEND_API_KEY) return [];
  const mails: Mail[] = [];
  if (env.NOTIFY_EMAIL) mails.push(ownerNotice(kind, email, message, env.NOTIFY_EMAIL));
  if (kind === 'access' && firstRequest && env.MAIL_FROM)
    mails.push(accessReply(email, env.NOTIFY_EMAIL));
  return mails;
}

/** Sends one email. Never throws: a failed email must not fail the form. Returns success. */
export async function sendMail(
  mail: Mail,
  env: MailEnv,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  if (!env.RESEND_API_KEY) return false;
  try {
    const res = await fetcher('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: env.MAIL_FROM || TEST_SENDER,
        to: [mail.to],
        subject: mail.subject,
        text: mail.text,
        ...(mail.replyTo && { reply_to: mail.replyTo }),
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.error('email failed', res.status, await res.text().catch(() => ''));
    return res.ok;
  } catch (err) {
    console.error('email failed', err);
    return false;
  }
}
