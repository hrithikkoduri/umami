import { WebsitesTable } from '@/app/(main)/websites/WebsitesTable';
import { DataGrid } from '@/components/common/DataGrid';
import { useUserWebsitesQuery } from '@/components/hooks';

export function UserWebsites({ userId }) {
  const queryResult = useUserWebsitesQuery({ userId });

  return (
    <DataGrid query={queryResult}>
      {/* These are another user's rows; the star would write the caller's own favourite. */}
      {({ data }) => <WebsitesTable data={data} showActions showFavourite={false} />}
    </DataGrid>
  );
}
