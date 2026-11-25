import { accessReply, mailsFor, ownerNotice, sendMail } from '../functions/_shared/mail.ts';

const env = {
  RESEND_API_KEY: 're_test',
  NOTIFY_EMAIL: 'owner@splitcraft.test',
  MAIL_FROM: 'Splitcraft <hello@splitcraft.test>',
};

describe('ownerNotice and accessReply', () => {
  it('tells the owner, and replying answers the sender', () => {
    const m = ownerNotice('access', 'ana@shop.test', 'Access request\nName: Ana', 'owner@x.test');
    expect(m).toMatchObject({
      to: 'owner@x.test',
      subject: 'New access request from ana@shop.test',
      replyTo: 'ana@shop.test',
    });
    expect(m.text).toContain('Name: Ana');
    expect(ownerNotice('question', 'ana@shop.test', 'Hi', 'o@x.test').subject).toBe(
      'New question from ana@shop.test',
    );
  });

  it('confirms an access request and points to the demo', () => {
    const m = accessReply('ana@shop.test', 'owner@x.test');
    expect(m.to).toBe('ana@shop.test');
    expect(m.replyTo).toBe('owner@x.test');
    expect(m.text).toContain('/demo.html');
  });
});

describe('mailsFor', () => {
  it('sends nothing without an API key', () => {
    expect(mailsFor('access', 'ana@shop.test', 'x', { ...env, RESEND_API_KEY: '' }, true)).toEqual(
      [],
    );
  });

  it('notifies the owner and confirms a first access request', () => {
    const mails = mailsFor('access', 'ana@shop.test', 'x', env, true);
    expect(mails.map((m) => m.to)).toEqual(['owner@splitcraft.test', 'ana@shop.test']);
  });

  it('confirms only once a day, only access requests, and only from a verified sender', () => {
    expect(mailsFor('access', 'ana@shop.test', 'x', env, false)).toHaveLength(1);
    expect(mailsFor('question', 'ana@shop.test', 'x', env, true)).toHaveLength(1);
    const noSender = mailsFor('access', 'ana@shop.test', 'x', { ...env, MAIL_FROM: '' }, true);
    expect(noSender.map((m) => m.to)).toEqual(['owner@splitcraft.test']);
  });
});

describe('sendMail', () => {
  const mail = { to: 'ana@shop.test', subject: 'Hi', text: 'Body', replyTo: 'o@x.test' };

  it('posts to Resend with the key and sender', async () => {
    const fetcher = vi.fn(async () => new Response('{}', { status: 200 }));
    expect(await sendMail(mail, env, fetcher as typeof fetch)).toBe(true);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer re_test');
    expect(JSON.parse(init.body as string)).toEqual({
      from: 'Splitcraft <hello@splitcraft.test>',
      to: ['ana@shop.test'],
      subject: 'Hi',
      text: 'Body',
      reply_to: 'o@x.test',
    });
  });

  it('uses the test sender without MAIL_FROM', async () => {
    const fetcher = vi.fn(async () => new Response('{}'));
    await sendMail(mail, { ...env, MAIL_FROM: undefined }, fetcher as typeof fetch);
    const init = (fetcher.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(JSON.parse(init.body as string).from).toContain('onboarding@resend.dev');
  });

  it('never throws: a failure only returns false', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const down = vi.fn(async () => {
      throw new Error('network');
    });
    expect(await sendMail(mail, env, down as typeof fetch)).toBe(false);
    const refused = vi.fn(async () => new Response('bad', { status: 403 }));
    expect(await sendMail(mail, env, refused as typeof fetch)).toBe(false);
    expect(await sendMail(mail, { RESEND_API_KEY: '' }, down as typeof fetch)).toBe(false);
    errors.mockRestore();
  });
});
