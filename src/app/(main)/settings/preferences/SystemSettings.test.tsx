import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@/test/render';
import { SystemSettings } from './SystemSettings';

vi.hoisted(() => {
  process.env.currentVersion = '9.9.9';
});

vi.mock('@/components/hooks', () => ({
  useMessages: () => ({
    t: (value: string) => value,
    labels: { version: 'Version', healthCheck: 'Health check' },
  }),
}));

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
