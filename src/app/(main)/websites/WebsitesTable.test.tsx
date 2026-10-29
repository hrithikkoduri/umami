import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@/test/render';
import { WebsitesTable } from './WebsitesTable';

const { mutateMock } = vi.hoisted(() => ({ mutateMock: vi.fn() }));

vi.mock('@/components/hooks', () => ({
  useMessages: () => ({
    t: (value: string) => value,
    labels: {
      name: 'Name',
      domain: 'Domain',
      visitors: 'Visitors',
      created: 'Created',
      favourite: 'Favourite',
      unfavourite: 'Unfavourite',
    },
  }),
  useNavigation: () => ({ renderUrl: (value: string) => value }),
  useWebsiteListChartsQuery: () => ({ data: { data: {} }, isLoading: false }),
  useWebsiteFavouriteMutation: () => ({ mutate: mutateMock, isPending: false }),
}));

vi.mock('@/components/common/DateDistance', () => ({
  DateDistance: () => <span>date</span>,
}));

vi.mock('./WebsiteSparkline', () => ({
  WebsiteSparkline: () => <div>sparkline</div>,
}));

vi.mock('@/components/common/SortableLabel', () => ({
  SortableLabel: ({ label }: { label: string }) => <span>{label}</span>,
}));

const rows = [
  { id: 'w-1', name: 'Alpha', domain: 'alpha.dev', favourite: true, createdAt: '2024-01-01' },
  { id: 'w-2', name: 'Bravo', domain: 'bravo.dev', favourite: false, createdAt: '2024-02-01' },
];

describe('WebsitesTable favourites', () => {
  test('renders a star on every row that reflects the favourite flag', () => {
    render(<WebsitesTable data={rows} />, { route: 'https://app.umami.is/websites' });

    const pressed = screen.getAllByRole('button', { pressed: true });
    const unpressed = screen.getAllByRole('button', { pressed: false });

    expect([...pressed, ...unpressed]).toHaveLength(2);
    expect(pressed).toHaveLength(1);
    expect(unpressed).toHaveLength(1);
  });

  test('labels the star by the current state so the toggle is announced', () => {
    render(<WebsitesTable data={rows} />, { route: 'https://app.umami.is/websites' });

    const starred = screen.getByRole('button', { name: 'Unfavourite', pressed: true });
    const unstarred = screen.getByRole('button', { name: 'Favourite', pressed: false });

    expect(starred).toHaveAttribute('aria-pressed', 'true');
    expect(unstarred).toHaveAttribute('aria-pressed', 'false');
  });

  test('clicking the star calls the mutation with the toggled value', async () => {
    const user = userEvent.setup();

    render(<WebsitesTable data={rows} />, { route: 'https://app.umami.is/websites' });

    await user.click(screen.getByRole('button', { name: 'Unfavourite' }));
    await user.click(screen.getByRole('button', { name: 'Favourite' }));

    expect(mutateMock).toHaveBeenNthCalledWith(1, false);
    expect(mutateMock).toHaveBeenNthCalledWith(2, true);
  });

  test('the star is still rendered when actions are hidden', () => {
    render(<WebsitesTable data={rows} showActions={false} />, {
      route: 'https://app.umami.is/websites',
    });

    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(1);
    expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(1);
    expect(screen.queryByRole('link', { name: /settings/ })).not.toBeInTheDocument();
  });
});
