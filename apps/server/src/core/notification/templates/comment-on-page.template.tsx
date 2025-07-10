import * as React from 'react';
import { Button, Section, Text, Link } from '@react-email/components';
import { MailBody } from '../../../integrations/transactional/partials/partials';
import { content, paragraph, button, h1 } from '../../../integrations/transactional/css/styles';

interface CommentOnPageEmailProps {
  recipientName: string;
  actorName: string;
  pageTitle: string;
  commentExcerpt: string;
  pageUrl: string;
  workspaceName: string;
  settingsUrl: string;
}

export const CommentOnPageEmail = ({
  recipientName,
  actorName,
  pageTitle,
  commentExcerpt,
  pageUrl,
  workspaceName,
  settingsUrl,
}: CommentOnPageEmailProps) => {
  return (
    <MailBody>
      <Section style={content}>
        <Text style={h1}>Hi {recipientName},</Text>
        
        <Text style={paragraph}>
          {actorName} commented on "{pageTitle}":
        </Text>

        <Section style={commentSection}>
          <Text style={commentText}>
            {commentExcerpt}
          </Text>
        </Section>

        <Button href={pageUrl} style={button}>
          View Comment
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

const commentSection: React.CSSProperties = {
  backgroundColor: '#f5f5f5',
  borderRadius: '4px',
  padding: '16px',
  margin: '16px 0',
};

const commentText: React.CSSProperties = {
  ...paragraph,
  margin: 0,
};

const footerText: React.CSSProperties = {
  ...paragraph,
  fontSize: '12px',
  color: '#666',
  marginTop: '24px',
};