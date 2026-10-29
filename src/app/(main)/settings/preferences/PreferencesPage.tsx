'use client';
import { Column } from '@umami/react-zen';
import { PageBody } from '@/components/common/PageBody';
import { PageHeader } from '@/components/common/PageHeader';
import { Panel } from '@/components/common/Panel';
import { useMessages } from '@/components/hooks';
import { PreferenceSettings } from './PreferenceSettings';
import { SystemSettings } from './SystemSettings';

export function PreferencesPage() {
  const { t, labels } = useMessages();

  return (
    <PageBody>
      <Column gap="6">
        <PageHeader title={t(labels.preferences)} />
        <Panel>
          <PreferenceSettings />
        </Panel>
        <Panel title={t(labels.system)}>
          <SystemSettings />
        </Panel>
      </Column>
    </PageBody>
  );
}
