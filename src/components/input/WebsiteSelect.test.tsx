import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@/test/render';
import { WebsiteSelect } from './WebsiteSelect';

const { useUserWebsitesQueryMock } = vi.hoisted(() => ({ useUserWebsitesQueryMock: vi.fn() }));

vi.mock('@/components/hooks', () => ({
  useMessages: () => ({
    t: (value: string) => value,
    labels: { selectWebsite: 'Select website', favourite: 'Favourite' },
    messages: { noResultsFound: 'No results found' },
  }),
  useLoginQuery: () => ({ user: { id: 'user-1' } }),
  useWebsiteQuery: () => ({ data: { name: 'Alpha' } }),
  useUserWebsitesQuery: useUserWebsitesQueryMock,
}));

// jsdom has no Web Animations API; Base UI's scroll area calls it when the popup opens.
if (!Element.prototype.getAnimations) {
  Element.prototype.getAnimations = () => [];
}

function setRows(rows: { id: string; name: string; favourite: boolean }[]) {
  useUserWebsitesQueryMock.mockReturnValue({ data: { data: rows }, isLoading: false });
}

describe('WebsiteSelect favourites', () => {
  test('marks a favourited option with an accessible label and a star', async () => {
    setRows([
      { id: 'w-1', name: 'Alpha', favourite: true },
      { id: 'w-2', name: 'Bravo', favourite: false },
    ]);
    const user = userEvent.setup();

    render(<WebsiteSelect websiteId="w-1" onChange={() => {}} />, {
      route: 'https://app.umami.is/websites',
    });

    await user.click(screen.getByRole('combobox'));

    const starred = await screen.findByRole('option', { name: 'Alpha (Favourite)' });
    const unstarred = screen.getByRole('option', { name: 'Bravo' });

    expect(starred.querySelector('svg')).toBeInTheDocument();
    expect(unstarred.querySelector('svg')).toBeNull();
  });

  test('leaves the option text intact for selection', async () => {
    setRows([
      { id: 'w-1', name: 'Alpha', favourite: true },
      { id: 'w-2', name: 'Bravo', favourite: false },
    ]);
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(<WebsiteSelect websiteId="w-1" onChange={onChange} />, {
      route: 'https://app.umami.is/websites',
    });

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'Bravo' }));

    expect(onChange).toHaveBeenCalledWith('w-2');
  });

  test('renders the options in the order the server returned them', async () => {
    // Unfavourited row first on purpose: re-sorting here would reshuffle only the current
    // page, so the rendered order must match the server order exactly.
    setRows([
      { id: 'w-2', name: 'Bravo', favourite: false },
      { id: 'w-1', name: 'Alpha', favourite: true },
    ]);
    const user = userEvent.setup();

    render(<WebsiteSelect websiteId="w-1" onChange={() => {}} />, {
      route: 'https://app.umami.is/websites',
    });

    await user.click(screen.getByRole('combobox'));

    const options = await screen.findAllByRole('option');

    expect(options.map(option => option.textContent)).toEqual(['Bravo', 'Alpha']);
    expect(useUserWebsitesQueryMock).toHaveBeenCalledWith(
      { userId: 'user-1', teamId: undefined },
      { search: '', pageSize: 100, includeTeams: undefined },
    );
  });
});
