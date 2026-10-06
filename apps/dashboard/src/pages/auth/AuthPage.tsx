import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { MESSAGES, type Provider } from '../../auth/api';
import { useAuth } from '../../auth/context';
import { safeNext } from '../../auth/next';
import { Logo } from '../../components/icons';
import { passwordRules, strength, STRENGTH, validate, type FieldErrors, type Mode } from './rules';
import styles from './AuthPage.module.css';

const COPY: Record<Mode, { title: string; subtitle: string; cta: string; busy: string }> = {
  login: {
    title: 'Log in to Splitcraft',
    subtitle: 'Welcome back. Your experiments are waiting.',
    cta: 'Log in',
    busy: 'Logging in…',
  },
  signup: {
    title: 'Create your workspace',
    subtitle: 'Free up to 100,000 events a month. No card needed.',
    cta: 'Create workspace',
    busy: 'Creating workspace…',
  },
  magic: {
    title: 'Log in with an email link',
    subtitle: "Enter your email and we'll send a link that logs you in. No password needed.",
    cta: 'Email me a link',
    busy: 'Sending…',
  },
  forgot: {
    title: 'Reset your password',
    subtitle: 'Enter the email you signed up with and we will send you a reset link.',
    cta: 'Send reset link',
    busy: 'Sending…',
  },
  reset: {
    title: 'Choose a new password',
    subtitle: 'Use it next time you log in.',
    cta: 'Save password',
    busy: 'Saving…',
  },
};

const STRENGTH_COLOR = ['var(--line)', '#B3261E', '#C27A10', '#0F6B57', '#0A4E40'];
const RESEND_SECONDS = 30;
const SITE_URL = (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, '');

type Result =
  | { kind: 'sent'; email: string; what: 'reset' | 'login' }
  | { kind: 'confirm'; email: string }
  | { kind: 'welcome'; name: string }
  | { kind: 'created' }
  | { kind: 'passwordSaved' };

/**
 * Log in / sign up / forgot password / new password, with the success screens.
 * Ported from the form logic in design/screens/01-auth-desktop.html.
 */
export function AuthPage({ mode }: { mode: Mode }) {
  const { state, api } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const query = params.get('next') ? `?next=${encodeURIComponent(next)}` : '';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [keep, setKeep] = useState(true);
  const [terms, setTerms] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [caps, setCaps] = useState(false);
  // A failed GitHub or Google login comes back as ?error=… (see RequireAuth).
  const [formError, setFormError] = useState(() => {
    const failed = mode === 'login' ? params.get('error') : null;
    return failed ? MESSAGES.providerFailed(failed) : '';
  });
  const [result, setResult] = useState<Result | null>(null);
  const [resendIn, setResendIn] = useState(0);
  // Set while a request we started is running, so the signed-in redirect below
  // doesn't skip the success screen.
  const busy = useRef(false);

  const ids = { name: useId(), email: useId(), password: useId(), terms: useId(), rules: useId() };

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  // Already signed in and just opened /login or /signup: go straight on.
  if (
    state.status === 'signedIn' &&
    !result &&
    !busy.current &&
    (mode === 'login' || mode === 'signup')
  ) {
    return <Navigate to={next} replace />;
  }

  const errors: FieldErrors = validate(mode, { name, email, password, terms });
  const shown = (k: keyof FieldErrors) => Boolean((submitted || touched[k]) && errors[k]);
  const touch = (k: string) => () => setTouched((t) => ({ ...t, [k]: true }));
  const copy = COPY[mode];
  const hasPassword = mode !== 'forgot' && mode !== 'magic';
  const withRules = (mode === 'signup' || mode === 'reset') && password.length > 0;
  const score = strength(password);

  const run = async (work: () => Promise<void>) => {
    busy.current = true;
    setLoading(true);
    setFormError('');
    try {
      await work();
    } finally {
      busy.current = false;
      setLoading(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setSubmitted(true);
    if (Object.keys(errors).length > 0) {
      setFormError('');
      return;
    }
    const cleanEmail = email.trim();
    await run(async () => {
      if (mode === 'login') {
        const r = await api.signIn(cleanEmail, password, keep);
        if (!r.ok) setFormError(r.error);
        else {
          const user = await api.getUser();
          setResult({ kind: 'welcome', name: user?.name ?? cleanEmail.split('@')[0]! });
        }
      } else if (mode === 'signup') {
        const r = await api.signUp(name.trim(), cleanEmail, password);
        if (!r.ok) setFormError(r.error);
        else
          setResult(
            r.needsConfirmation ? { kind: 'confirm', email: cleanEmail } : { kind: 'created' },
          );
      } else if (mode === 'forgot' || mode === 'magic') {
        const r =
          mode === 'magic'
            ? await api.sendLoginLink(cleanEmail, next)
            : await api.sendPasswordReset(cleanEmail);
        if (!r.ok) setFormError(r.error);
        else {
          setResult({
            kind: 'sent',
            email: cleanEmail,
            what: mode === 'magic' ? 'login' : 'reset',
          });
          setResendIn(RESEND_SECONDS);
        }
      } else {
        const r = await api.updatePassword(password);
        if (!r.ok) setFormError(r.error);
        else setResult({ kind: 'passwordSaved' });
      }
    });
  };

  const social = async (provider: Provider) => {
    await run(async () => {
      const r = await api.signInWithProvider(provider);
      if (!r.ok) setFormError(r.error);
    });
  };

  const resend = async () => {
    if (resendIn > 0 || result?.kind !== 'sent') return;
    const r =
      result.what === 'login'
        ? await api.sendLoginLink(result.email, next)
        : await api.sendPasswordReset(result.email);
    if (r.ok) setResendIn(RESEND_SECONDS);
    else setFormError(r.error);
  };

  const differentAccount = async () => {
    await api.signOut();
    setResult(null);
    navigate('/login');
  };

  const onPasswordKey = (e: KeyboardEvent<HTMLInputElement>) => {
    setCaps(e.getModifierState?.('CapsLock') ?? false);
  };

  const describedBy = (...list: Array<string | false>) =>
    list.filter(Boolean).join(' ') || undefined;

  const link = (path: string, label: string) =>
    SITE_URL ? <a href={`${SITE_URL}${path}`}>{label}</a> : <span>{label}</span>;

  let body;
  if (result?.kind === 'sent' || result?.kind === 'confirm') {
    body = (
      <div className={styles.stack}>
        <span className={styles.iconBox}>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="5" width="18" height="14" rx="2.5" />
            <path d="M3.5 7l8.5 6 8.5-6" />
          </svg>
        </span>
        <div className={styles.intro}>
          <h1 className={styles.title}>Check your email</h1>
          {result.kind === 'sent' ? (
            <p role="status" className={styles.subtitle}>
              We sent a {result.what === 'login' ? 'login' : 'reset'} link to <b>{result.email}</b>
              {result.what === 'login'
                ? ' if it has an account. Open it on this device to log in.'
                : '. It works for 30 minutes.'}{' '}
              Check spam if it isn't there in a minute.
            </p>
          ) : (
            <p role="status" className={styles.subtitle}>
              We sent a confirmation link to <b>{result.email}</b>. Open it to finish creating your
              workspace. Check spam if it isn't there in a minute.
            </p>
          )}
        </div>
        {formError && <FormError message={formError} />}
        {result.kind === 'sent' && (
          <button
            type="button"
            className={styles.ctaSecondary}
            onClick={resend}
            disabled={resendIn > 0}
          >
            {resendIn > 0 ? `Resend link in ${resendIn}s` : 'Resend link'}
          </button>
        )}
        <Link to={`/login${query}`} className={`${styles.link} ${styles.center}`}>
          ← Back to log in
        </Link>
      </div>
    );
  } else if (result) {
    const done = {
      welcome: {
        title: `Welcome back, ${result.kind === 'welcome' ? result.name.split(' ')[0] : ''}`,
        text: 'You are logged in. Your experiments are waiting.',
        cta: 'Open dashboard',
        to: next,
      },
      created: {
        title: 'Your workspace is ready',
        text: 'Next, add your first project and paste the snippet into your site. It takes about two minutes.',
        cta: 'Set up first project',
        to: '/projects',
      },
      passwordSaved: {
        title: 'Password updated',
        text: 'Use your new password next time you log in.',
        cta: 'Open dashboard',
        to: '/projects',
      },
    }[result.kind];
    body = (
      <div className={styles.stack}>
        <svg width="56" height="56" viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="32" r="30" fill="var(--accent)" />
          <path
            className={styles.tick}
            d="M20 33l8 8 16-17"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div className={styles.intro}>
          <h1 className={styles.title}>{done.title}</h1>
          <p role="status" className={styles.subtitle}>
            {done.text}
          </p>
        </div>
        <Link className={styles.cta} to={done.to}>
          {done.cta} →
        </Link>
        <button
          type="button"
          className={`${styles.link} ${styles.center}`}
          onClick={differentAccount}
        >
          Use a different account
        </button>
      </div>
    );
  } else if (mode === 'reset' && state.status === 'signedOut') {
    body = (
      <div className={styles.stack}>
        <div className={styles.intro}>
          <h1 className={styles.title}>This reset link has expired</h1>
          <p className={styles.subtitle}>Reset links work for 30 minutes. Ask for a new one.</p>
        </div>
        <Link className={styles.cta} to="/forgot-password">
          Send a new link
        </Link>
      </div>
    );
  } else {
    body = (
      <div className={styles.stack}>
        <div className={styles.intro}>
          <h1 className={styles.title}>{copy.title}</h1>
          <p className={styles.subtitle}>{copy.subtitle}</p>
        </div>

        {(mode === 'login' || mode === 'signup') && (
          <div className={styles.social}>
            {/* GitHub first and highlighted: one click, no password or email to confirm. */}
            <button
              type="button"
              className={styles.github}
              onClick={() => social('github')}
              disabled={loading}
              aria-describedby="github-hint"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 16 16"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
              Continue with GitHub
            </button>
            <p id="github-hint" className={styles.githubHint}>
              10× faster onboarding: no password, no email to confirm.
            </p>
            <div className={styles.socialRow}>
              <button
                type="button"
                className={styles.sso}
                onClick={() => social('google')}
                disabled={loading}
              >
                Google
              </button>
              <button
                type="button"
                className={styles.sso}
                onClick={() => setFormError(MESSAGES.sso)}
                disabled={loading}
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <circle cx="7" cy="10" r="3.5" />
                  <path d="M10.5 10H18M15 10v3M18 10v2" />
                </svg>
                SSO
              </button>
            </div>
            <div className={styles.divider}>or with email</div>
          </div>
        )}

        {formError && <FormError message={formError} />}

        <form className={styles.form} onSubmit={submit} noValidate>
          {mode === 'signup' && (
            <div className={styles.field}>
              <label htmlFor={ids.name} className={styles.label}>
                Full name
              </label>
              <input
                id={ids.name}
                className={styles.input}
                type="text"
                autoComplete="name"
                placeholder="Your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={touch('name')}
                aria-invalid={shown('name')}
                aria-describedby={describedBy(shown('name') && `${ids.name}-err`)}
              />
              {shown('name') && (
                <span id={`${ids.name}-err`} className={styles.error}>
                  {errors.name}
                </span>
              )}
            </div>
          )}

          {mode !== 'reset' && (
            <div className={styles.field}>
              <label htmlFor={ids.email} className={styles.label}>
                {mode === 'signup' ? 'Work email' : 'Email'}
              </label>
              <input
                id={ids.email}
                className={styles.input}
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setFormError('');
                }}
                onBlur={touch('email')}
                aria-invalid={shown('email')}
                aria-describedby={describedBy(shown('email') && `${ids.email}-err`)}
              />
              {shown('email') && (
                <span id={`${ids.email}-err`} className={styles.error}>
                  {errors.email}
                </span>
              )}
            </div>
          )}

          {hasPassword && (
            <div className={styles.field}>
              <div className={styles.labelRow}>
                <label htmlFor={ids.password} className={styles.label}>
                  {mode === 'reset' ? 'New password' : 'Password'}
                </label>
                {mode === 'login' && (
                  <Link to={`/forgot-password${query}`} className={styles.link}>
                    Forgot password?
                  </Link>
                )}
              </div>
              <div className={styles.passwordWrap}>
                <input
                  id={ids.password}
                  className={styles.input}
                  type={show ? 'text' : 'password'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  placeholder={mode === 'login' ? 'Your password' : 'Create a password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setFormError('');
                  }}
                  onBlur={touch('password')}
                  onKeyUp={onPasswordKey}
                  onKeyDown={onPasswordKey}
                  aria-invalid={shown('password')}
                  aria-describedby={describedBy(
                    shown('password') && `${ids.password}-err`,
                    withRules && ids.rules,
                  )}
                />
                <button
                  type="button"
                  className={styles.eye}
                  onClick={() => setShow((s) => !s)}
                  aria-pressed={show}
                  aria-controls={ids.password}
                  aria-label={show ? 'Hide password' : 'Show password'}
                >
                  {show ? (
                    <svg
                      width="17"
                      height="17"
                      viewBox="0 0 20 20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M3 3l14 14M8.5 5.2A8 8 0 0 1 10 5c5 0 8 5 8 5a13 13 0 0 1-2.4 2.9M6 6.8C3.7 8.2 2 10 2 10s3 5 8 5a7.5 7.5 0 0 0 3.2-.7" />
                    </svg>
                  ) : (
                    <svg
                      width="17"
                      height="17"
                      viewBox="0 0 20 20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M2 10s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5z" />
                      <circle cx="10" cy="10" r="2.5" />
                    </svg>
                  )}
                  {show ? 'Hide' : 'Show'}
                </button>
              </div>
              {caps && <span className={styles.warn}>Caps Lock is on.</span>}
              {shown('password') && (
                <span id={`${ids.password}-err`} className={styles.error}>
                  {errors.password}
                </span>
              )}
              {withRules && (
                <div id={ids.rules} className={styles.strength}>
                  <div className={styles.meterRow}>
                    <div className={styles.bars} aria-hidden="true">
                      {[0, 1, 2, 3].map((i) => (
                        <span
                          key={i}
                          className={styles.bar}
                          style={i < score ? { background: STRENGTH_COLOR[score] } : undefined}
                        />
                      ))}
                    </div>
                    <span className={styles.strengthLabel} style={{ color: STRENGTH_COLOR[score] }}>
                      {STRENGTH[score] && `${STRENGTH[score]}`}
                    </span>
                  </div>
                  <ul className={styles.rules} aria-label="Password requirements">
                    {passwordRules(password).map((r) => (
                      <li key={r.label} className={`${styles.rule} ${r.ok ? styles.ok : ''}`}>
                        <span className={styles.mark} aria-hidden="true">
                          {r.ok ? '✓' : '·'}
                        </span>
                        {r.label}
                        <span className="visually-hidden">{r.ok ? ' (done)' : ' (to do)'}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {mode === 'login' && (
            <label className={styles.check}>
              <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
              Keep me logged in for 30 days
            </label>
          )}

          {mode === 'signup' && (
            <div className={styles.field}>
              <label className={styles.check} style={{ fontSize: 13.5 }}>
                <input
                  id={ids.terms}
                  type="checkbox"
                  checked={terms}
                  onChange={(e) => {
                    setTerms(e.target.checked);
                    touch('terms')();
                  }}
                  aria-invalid={shown('terms')}
                  aria-describedby={describedBy(shown('terms') && `${ids.terms}-err`)}
                />
                <span>
                  I agree to the {link('/terms', 'Terms')} and {link('/privacy', 'Privacy Policy')}.
                </span>
              </label>
              {shown('terms') && (
                <span id={`${ids.terms}-err`} className={styles.error}>
                  {errors.terms}
                </span>
              )}
            </div>
          )}

          <button type="submit" className={styles.cta} disabled={loading} aria-busy={loading}>
            {loading && <span className={styles.spinner} aria-hidden="true" />}
            {loading ? copy.busy : copy.cta}
          </button>
        </form>

        {mode === 'login' && (
          <Link to={`/login/link${query}`} className={`${styles.link} ${styles.center}`}>
            Email me a login link instead
          </Link>
        )}

        {mode !== 'reset' && (
          <div className={styles.switch}>
            {mode === 'login' && (
              <>
                <span>New to Splitcraft?</span>
                <Link to={`/signup${query}`} className={styles.link}>
                  Create an account
                </Link>
              </>
            )}
            {mode === 'signup' && (
              <>
                <span>Already have an account?</span>
                <Link to={`/login${query}`} className={styles.link}>
                  Log in
                </Link>
              </>
            )}
            {(mode === 'forgot' || mode === 'magic') && (
              <Link to={`/login${query}`} className={styles.link}>
                ← Back to log in
              </Link>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.formSide}>
        <header className={styles.header}>
          <Link to="/login" className={styles.brand}>
            <Logo size={28} />
            Splitcraft
          </Link>
          {SITE_URL && (
            <a href={SITE_URL} className={styles.back}>
              ← Back to site
            </a>
          )}
        </header>
        <main className={styles.main}>
          <div className={styles.card}>{body}</div>
        </main>
        <footer className={styles.footer}>
          <span>© 2026 Splitcraft</span>
          {SITE_URL && (
            <>
              {link('/privacy', 'Privacy')}
              {link('/terms', 'Terms')}
            </>
          )}
        </footer>
      </div>
      <Showcase signup={mode === 'signup'} />
    </div>
  );
}

/** The dark panel beside the form on wide screens: what Splitcraft does, at a glance. */
function Showcase({ signup }: { signup: boolean }) {
  const arms = [
    { name: 'Original', rate: '4.98%', width: 62, color: 'var(--variant-a)' },
    { name: 'Sticky Book bar', rate: '5.47%', width: 68, color: 'var(--variant-b)' },
  ];
  return (
    <aside className={styles.showcase} aria-label="About Splitcraft">
      <div className={styles.showcaseInner}>
        <p className={styles.kicker}>{signup ? 'Free to start' : 'Welcome back'}</p>
        <h2 className={styles.showTitle}>
          {signup ? 'Run your first A/B test today.' : 'See what moved while you were away.'}
        </h2>
        <div className={styles.result}>
          <div className={styles.resultHead}>
            <span className={styles.resultName}>Sticky Book Now bar</span>
            <span className={styles.livePill}>Live</span>
          </div>
          {arms.map((a) => (
            <div key={a.name} className={styles.arm}>
              <span className={styles.armName}>
                <span className={styles.swatch} style={{ background: a.color }} />
                {a.name}
              </span>
              <span className={styles.bar}>
                <span style={{ width: `${a.width}%`, background: a.color }} />
              </span>
              <span className={styles.armRate}>{a.rate}</span>
            </div>
          ))}
          <dl className={styles.stats}>
            <div>
              <dt>Uplift</dt>
              <dd className={styles.up}>+9.7%</dd>
            </div>
            <div>
              <dt>Chance to win</dt>
              <dd>96%</dd>
            </div>
            <div>
              <dt>Sample ratio</dt>
              <dd>Healthy</dd>
            </div>
          </dl>
        </div>
        <ul className={styles.points}>
          <li>Variants in real JS and CSS, or point and click</li>
          <li>Targeting, goals and guardrails in one place</li>
          <li>
            {signup
              ? '100,000 events a month free, no card'
              : 'Results you can trust, with a 95% range'}
          </li>
        </ul>
        <p className={styles.showNote}>Example numbers from a demo test.</p>
      </div>
    </aside>
  );
}

function FormError({ message }: { message: string }) {
  return (
    <div role="alert" className={styles.alert}>
      <svg
        width="18"
        height="18"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="10" cy="10" r="7.5" />
        <path d="M10 6v4.5M10 13.5v.2" />
      </svg>
      <span>{message}</span>
    </div>
  );
}
