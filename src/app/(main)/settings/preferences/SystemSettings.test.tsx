import { afterEach, describe, expect, test, vi } from 'vitest';
import { render, screen } from '@/test/render';
import { SystemSettings } from './SystemSettings';

vi.hoisted(() => {
  vi.stubEnv('currentVersion', '9.9.9');
});

describe('SystemSettings', () => {
  test('renders the app version and a link to the health endpoint', () => {
    render(<SystemSettings />);

    expect(screen.getByText('Version')).toBeInTheDocument();
    expect(screen.getByText('9.9.9')).toBeInTheDocument();

    const link = screen.getByRole('link', { name: '/api/heartbeat' });

    expect(link).toHaveAttribute('href', '/api/heartbeat');
    expect(link).toHaveAttribute('target', '_blank');
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});
