'use client';

import { Column, Label, Text } from '@umami/react-zen';
import { useMessages } from '@/components/hooks';
import { CURRENT_VERSION } from '@/lib/constants';

export function SystemSettings() {
  const { t, labels } = useMessages();
  const healthUrl = `${process.env.basePath || ''}/api/heartbeat`;

  return (
    <Column gap="6">
      <Column gap="1">
        <Label>{t(labels.version)}</Label>
        <Text>{CURRENT_VERSION}</Text>
      </Column>
      <Column gap="1">
        <Label>{t(labels.healthCheck)}</Label>
        <a href={healthUrl} target="_blank" rel="noreferrer noopener">
          {healthUrl}
        </a>
      </Column>
    </Column>
  );
}
