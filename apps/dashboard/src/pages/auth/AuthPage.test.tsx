import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MESSAGES } from '../../auth/api';
import { ALEX, fakeAuth, PASSWORD } from '../../test/fakeAuth';
import { renderApp } from '../../test/renderApp';

const field = (name: string | RegExp) => screen.getByLabelText(name);
const submit = (name: string | RegExp) => screen.getByRole('button', { name });

async function openAt(path: string, auth = fakeAuth()) {
  const router = renderApp(path, { api: auth.api });
  await screen.findByRole('heading', { level: 1 });
  return { router, ...auth };
}

describe('login', () => {
  it('shows field errors only after blur or submit, with aria wiring', async () => {
    const user = userEvent.setup();
    await openAt('/login');
    const email = field('Email');
    expect(email).toHaveAttribute('aria-invalid', 'false');
    expect(screen.queryByText('Enter your email address.')).not.toBeInTheDocument();

    await user.click(email);
    await user.tab();
    const error = screen.getByText('Enter your email address.');
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(email).toHaveAttribute('aria-describedby', error.id);

    await user.click(submit('Log in'));
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
  });

  it('flags an email that is missing something', async () => {
    const user = userEvent.setup();
    await openAt('/login');
    await user.type(field('Email'), 'maya@larkspur');
    await user.tab();
    expect(
      screen.getByText('This email is missing something. Check for typos.'),
    ).toBeInTheDocument();
  });

  it('shows the spec message for wrong credentials', async () => {
    const user = userEvent.setup();
    await openAt('/login');
    await user.type(field('Email'), ALEX.email);
    await user.type(field('Password'), 'wrong-password');
    await user.click(submit('Log in'));
    expect(await screen.findByRole('alert')).toHaveTextContent(MESSAGES.invalidLogin);
  });

  it('logs in, shows the welcome screen and links to where the user was going', async () => {
    const user = userEvent.setup();
    const { calls } = await openAt('/login?next=%2Fp%2Fmarketing-site%2Fmetrics');
    await user.type(field('Email'), ALEX.email);
    await user.type(field('Password'), PASSWORD);
    await user.click(screen.getByLabelText('Keep me logged in for 30 days'));
    await user.click(submit('Log in'));

    expect(await screen.findByRole('heading', { name: 'Welcome back, Maya' })).toBeInTheDocument();
    expect(calls).toContain(`signIn:${ALEX.email}:false`);
    expect(screen.getByRole('link', { name: 'Open dashboard →' })).toHaveAttribute(
      'href',
      '/p/marketing-site/metrics',
    );
  });

  it('shows a loading state while logging in', async () => {
    const user = userEvent.setup();
    const auth = fakeAuth();
    let finish: () => void = () => {};
    auth.api.signIn = () => new Promise((r) => (finish = () => r({ ok: true })));
    await openAt('/login', auth);
    await user.type(field('Email'), ALEX.email);
    await user.type(field('Password'), PASSWORD);
    await user.click(submit('Log in'));

    const busy = submit('Logging in…');
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute('aria-busy', 'true');
    await act(async () => finish());
  });

  it('ignores an unsafe next parameter', async () => {
    const user = userEvent.setup();
    await openAt('/login?next=%2F%2Fevil.example');
    await user.type(field('Email'), ALEX.email);
    await user.type(field('Password'), PASSWORD);
    await user.click(submit('Log in'));
    expect(await screen.findByRole('link', { name: 'Open dashboard →' })).toHaveAttribute(
      'href',
      '/projects',
    );
  });

  it('skips the form when already signed in', async () => {
    const router = renderApp('/login', { api: fakeAuth({ signedIn: true }).api });
    await screen.findByRole('complementary', { name: 'Sidebar' });
    expect(router.state.location.pathname).toBe('/projects');
  });
});

describe('password field', () => {
  it('shows and hides the password with aria-pressed', async () => {
    const user = userEvent.setup();
    await openAt('/login');
    const input = field('Password');
    const toggle = screen.getByRole('button', { name: 'Show password' });
    expect(input).toHaveAttribute('type', 'password');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await user.click(toggle);
    expect(input).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('warns when Caps Lock is on', async () => {
    const user = userEvent.setup();
    await openAt('/login');
    await user.type(field('Password'), '{CapsLock}a');
    expect(screen.getByText('Caps Lock is on.')).toBeInTheDocument();
  });
});

describe('sign up', () => {
  it('shows the strength meter and checklist as the password is typed', async () => {
    const user = userEvent.setup();
    await openAt('/signup');
    expect(screen.queryByText('8+ characters')).not.toBeInTheDocument();
    await user.type(field('Password'), 'tripdemo');
    expect(screen.getByText('Weak')).toBeInTheDocument();
    await user.type(field('Password'), '1T');
    expect(screen.getByText('Good')).toBeInTheDocument();
    const rules = screen.getByRole('list', { name: 'Password requirements' });
    expect(within(rules).getByText('8+ characters').closest('li')).toHaveTextContent('(done)');
    expect(within(rules).getByText('A symbol (optional)').closest('li')).toHaveTextContent(
      '(to do)',
    );
  });

  it('requires name, a strong password and the terms', async () => {
    const user = userEvent.setup();
    await openAt('/signup');
    await user.type(field('Work email'), 'new@example.com');
    await user.type(field('Password'), 'short');
    await user.click(submit('Create workspace'));
    expect(screen.getByText('Enter your full name.')).toBeInTheDocument();
    expect(
      screen.getByText('Use 8+ characters with a number and upper and lower case.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Accept the terms to create your workspace.')).toBeInTheDocument();
  });

  async function fillSignUp(user: ReturnType<typeof userEvent.setup>) {
    await user.type(field('Full name'), 'Sam Rivera');
    await user.type(field('Work email'), 'sam@example.com');
    await user.type(field('Password'), 'Samples99');
    await user.click(screen.getByRole('checkbox'));
    await user.click(submit('Create workspace'));
  }

  it('creates the workspace and offers to set up the first project', async () => {
    const user = userEvent.setup();
    const { calls } = await openAt('/signup');
    await fillSignUp(user);
    expect(
      await screen.findByRole('heading', { name: 'Your workspace is ready' }),
    ).toBeInTheDocument();
    expect(calls).toContain('signUp:Sam Rivera:sam@example.com');
    expect(screen.getByRole('link', { name: 'Set up first project →' })).toHaveAttribute(
      'href',
      '/projects',
    );
  });

  it('asks to confirm the email when Supabase requires it', async () => {
    const user = userEvent.setup();
    await openAt('/signup', fakeAuth({ confirmSignUps: true }));
    await fillSignUp(user);
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('confirmation link to sam@example.com');
  });
});

describe('forgot password', () => {
  it('sends a reset link and counts down before resending', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const { calls } = await openAt('/forgot-password');
      await user.type(field('Email'), ALEX.email);
      await user.click(submit('Send reset link'));

      expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent(`reset link to ${ALEX.email}`);
      const resend = screen.getByRole('button', { name: 'Resend link in 30s' });
      expect(resend).toBeDisabled();

      // One tick per act so React re-renders and schedules the next second.
      for (let i = 0; i < 30; i++) {
        await act(() => vi.advanceTimersByTimeAsync(1000));
      }
      await user.click(screen.getByRole('button', { name: 'Resend link' }));
      expect(calls.filter((c) => c.startsWith('reset:'))).toHaveLength(2);
      expect(await screen.findByRole('button', { name: /Resend link in \d+s/ })).toBeDisabled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('links between log in, sign up and forgot password', async () => {
    const user = userEvent.setup();
    const { router } = await openAt('/login');
    await user.click(screen.getByRole('link', { name: 'Forgot password?' }));
    expect(router.state.location.pathname).toBe('/forgot-password');
    await user.click(screen.getByRole('link', { name: '← Back to log in' }));
    await user.click(screen.getByRole('link', { name: 'Create an account' }));
    expect(router.state.location.pathname).toBe('/signup');
  });
});

describe('reset password', () => {
  it('saves a new password for a user who opened the email link', async () => {
    const user = userEvent.setup();
    const { calls } = await openAt('/reset-password', fakeAuth({ signedIn: true }));
    await user.type(field('New password'), 'Newpass123');
    await user.click(submit('Save password'));
    expect(await screen.findByRole('heading', { name: 'Password updated' })).toBeInTheDocument();
    expect(calls).toContain('updatePassword');
  });

  it('explains an expired link', async () => {
    await openAt('/reset-password');
    expect(
      screen.getByRole('heading', { name: 'This reset link has expired' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Send a new link' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });
});

describe('social and SSO', () => {
  it('shows a clear message when a provider is not enabled', async () => {
    const user = userEvent.setup();
    const { calls } = await openAt('/login');
    await user.click(screen.getByRole('button', { name: 'Continue with GitHub' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("GitHub sign-in isn't set up yet.");
    expect(calls).toContain('oauth:github');
    expect(
      screen.getByRole('button', { name: 'Continue with GitHub' }),
    ).toHaveAccessibleDescription(/10× faster onboarding/);
  });

  it('explains that SSO is not available yet', async () => {
    const user = userEvent.setup();
    await openAt('/login');
    await user.click(screen.getByRole('button', { name: 'SSO' }));
    expect(screen.getByRole('alert')).toHaveTextContent(MESSAGES.sso);
  });
});

describe('protected pages', () => {
  it('show why a GitHub or Google login failed', async () => {
    const { router } = await openAt(
      '/projects#error=server_error&error_code=unexpected_failure&error_description=Unable+to+exchange+external+code',
    );
    expect(router.state.location.pathname).toBe('/login');
    expect(screen.getByRole('alert')).toHaveTextContent(
      "Couldn't log you in: Unable to exchange external code",
    );
  });

  it('show an error sent back in the query too', async () => {
    await openAt('/projects?error=access_denied&error_description=The+user+denied+access');
    expect(screen.getByRole('alert')).toHaveTextContent('The user denied access');
  });

  it('send signed-out visitors to log in, then back', async () => {
    const user = userEvent.setup();
    const { router } = await openAt('/p/marketing-site/metrics');
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toBe('?next=%2Fp%2Fmarketing-site%2Fmetrics');

    await user.type(field('Email'), ALEX.email);
    await user.type(field('Password'), PASSWORD);
    await user.click(submit('Log in'));
    await user.click(await screen.findByRole('link', { name: 'Open dashboard →' }));
    expect(router.state.location.pathname).toBe('/p/marketing-site/metrics');
    expect(screen.getByText('Maya Chen')).toBeInTheDocument();
  });

  it('log out from the sidebar', async () => {
    const user = userEvent.setup();
    const auth = fakeAuth({ signedIn: true });
    const router = renderApp('/projects', { api: auth.api });
    await user.click(await screen.findByRole('button', { name: 'Log out' }));
    expect(auth.calls).toContain('signOut');
    expect(router.state.location.pathname).toBe('/login');
  });
});

describe('login link', () => {
  it('emails a one-time login link from the login page', async () => {
    const user = userEvent.setup();
    const { router, calls } = await openAt('/login?next=%2Fteam');
    await user.click(screen.getByRole('link', { name: 'Email me a login link instead' }));
    expect(router.state.location.pathname).toBe('/login/link');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Log in with an email link' }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/Password/)).not.toBeInTheDocument();

    await user.click(submit('Email me a link'));
    expect(screen.getByText('Enter your email address.')).toBeInTheDocument();
    await user.type(field('Email'), ALEX.email);
    await user.click(submit('Email me a link'));
    expect(await screen.findByRole('status')).toHaveTextContent(
      `login link to ${ALEX.email} if it has an account`,
    );
    expect(calls).toContain(`link:${ALEX.email}:/team`);
    expect(screen.getByRole('button', { name: /Resend link in/ })).toBeDisabled();
  });
});
