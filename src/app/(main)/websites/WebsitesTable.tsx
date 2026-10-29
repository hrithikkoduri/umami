import { DataColumn, DataTable, type DataTableProps, Icon, Row, Text } from '@umami/react-zen';
import { type ReactNode, useMemo } from 'react';
import { DateDistance } from '@/components/common/DateDistance';
import { LinkButton } from '@/components/common/LinkButton';
import { SortableLabel } from '@/components/common/SortableLabel';
import { useMessages, useNavigation, useWebsiteListChartsQuery } from '@/components/hooks';
import { SquarePen } from '@/components/icons';
import { decodePunycodeDomain } from '@/lib/format';
import { WebsiteFavouriteButton } from './WebsiteFavouriteButton';
import { WebsiteSparkline } from './WebsiteSparkline';

export interface WebsitesTableProps extends DataTableProps {
  showActions?: boolean;
  showFavourite?: boolean;
  renderLink?: (row: any) => ReactNode;
}

export function WebsitesTable({
  showActions,
  showFavourite = true,
  renderLink,
  data = [],
  ...props
}: WebsitesTableProps & { data?: any[] }) {
  const { t, labels } = useMessages();
  const { renderUrl } = useNavigation();
  const websiteIds = useMemo(() => data.map(row => row.id), [data]);
  const chartsQuery = useWebsiteListChartsQuery(websiteIds);
  const charts = chartsQuery.data?.data || {};
  const isChartLoading = chartsQuery.isLoading && !chartsQuery.data;

  return (
    <DataTable {...props} data={data}>
      <DataColumn
        id="name"
        label={<SortableLabel label={t(labels.name)} sortKey="name" />}
        style={{ minWidth: 0 }}
      >
        {renderLink}
      </DataColumn>
      <DataColumn
        id="domain"
        label={<SortableLabel label={t(labels.domain)} sortKey="domain" />}
        style={{ minWidth: 0 }}
      >
        {(row: any) => (
          <Text
            truncate
            title={decodePunycodeDomain(row.domain) ?? undefined}
            style={{ maxWidth: '100%' }}
          >
            {decodePunycodeDomain(row.domain)}
          </Text>
        )}
      </DataColumn>
      <DataColumn
        id="chart"
        label={<span style={{ whiteSpace: 'normal' }}>{`${t(labels.visitors)} (7d)`}</span>}
        style={{ minWidth: 0 }}
      >
        {(row: any) => {
          const chart = charts[row.id];

          return (
            <WebsiteSparkline
              values={chart?.values}
              total={chart?.total}
              isLoading={isChartLoading}
            />
          );
        }}
      </DataColumn>
      <DataColumn
        id="created"
        label={
          <SortableLabel label={t(labels.created)} sortKey="createdAt" defaultDirection="desc" />
        }
        width="180px"
      >
        {(row: any) => <DateDistance date={new Date(row.createdAt)} />}
      </DataColumn>
      <DataColumn id="action" label=" " align="end" width="72px">
        {(row: any) => {
          const websiteId = row.id;

          return (
            <Row gap="2">
              {showFavourite && (
                <WebsiteFavouriteButton websiteId={websiteId} isFavourite={row.isFavourite} />
              )}
              {showActions && (
                <LinkButton href={renderUrl(`/websites/${websiteId}/settings`)} variant="quiet">
                  <Icon>
                    <SquarePen />
                  </Icon>
                </LinkButton>
              )}
            </Row>
          );
        }}
      </DataColumn>
    </DataTable>
  );
}
