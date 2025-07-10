import * as React from 'react';
import { Button, Section, Text, Link } from '@react-email/components';
import { MailBody } from '../../../integrations/transactional/partials/partials';
import { content, paragraph, button, h1 } from '../../../integrations/transactional/css/styles';

interface MentionInPageEmailProps {
  recipientName: string;
  actorName: string;
  pageTitle: string;
  mentionContext: string;
  pageUrl: string;
  workspaceName: string;
  settingsUrl: string;
}

export const MentionInPageEmail = ({
  recipientName,
  actorName,
  pageTitle,
  mentionContext,
  pageUrl,
  workspaceName,
  settingsUrl,
}: MentionInPageEmailProps) => {
  return (
    <MailBody>
      <Section style={content}>
        <Text style={h1}>Hi {recipientName},</Text>
        
        <Text style={paragraph}>
          {actorName} mentioned you in the page "{pageTitle}":
        </Text>

        <Section style={mentionSection}>
          <Text style={mentionText}>
            ...{mentionContext}...
          </Text>
        </Section>

        <Button href={pageUrl} style={button}>
          View Page
        </Button>

        <Text style={footerText}>
          This notification was sent from {workspaceName}.{' '}
          <Link href={settingsUrl} style={{ color: '#176ae5' }}>
            Manage your notification preferences
          </Link>
        </Text>
      </Section>
    </MailBody>
  );
};

const mentionSection: React.CSSProperties = {
  backgroundColor: '#f5f5f5',
  borderRadius: '4px',
  padding: '16px',
  margin: '16px 0',
};

const mentionText: React.CSSProperties = {
  ...paragraph,
  fontStyle: 'italic',
  margin: 0,
};

const footerText: React.CSSProperties = {
  ...paragraph,
  fontSize: '12px',
  color: '#666',
  marginTop: '24px',
};