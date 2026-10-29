import { WebsitesTable } from '@/app/(main)/websites/WebsitesTable';
import { DataGrid } from '@/components/common/DataGrid';
import { useUserWebsitesQuery } from '@/components/hooks';

export function UserWebsites({ userId }) {
  const queryResult = useUserWebsitesQuery({ userId });

  return (
    <DataGrid query={queryResult}>
      {({ data }) => (
        // The star would read the target user's isFavourite while writing the admin's own.
        <WebsitesTable data={data} showActions showFavourite={false} />
      )}
    </DataGrid>
  );
}
