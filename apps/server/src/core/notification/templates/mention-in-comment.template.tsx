import * as React from 'react';
import { Button, Section, Text, Link } from '@react-email/components';
import { MailBody } from '../../../integrations/transactional/partials/partials';
import { content, paragraph, button, h1 } from '../../../integrations/transactional/css/styles';

interface MentionInCommentEmailProps {
  recipientName: string;
  actorName: string;
  pageTitle: string;
  commentExcerpt: string;
  mentionContext: string;
  commentUrl: string;
  workspaceName: string;
  settingsUrl: string;
}

export const MentionInCommentEmail = ({
  recipientName,
  actorName,
  pageTitle,
  commentExcerpt,
  mentionContext,
  commentUrl,
  workspaceName,
  settingsUrl,
}: MentionInCommentEmailProps) => {
  return (
    <MailBody>
      <Section style={content}>
        <Text style={h1}>Hi {recipientName},</Text>
        
        <Text style={paragraph}>
          {actorName} mentioned you in a comment on "{pageTitle}":
        </Text>

        <Section style={commentSection}>
          <Text style={commentAuthor}>{actorName} commented:</Text>
          <Text style={commentText}>
            {commentExcerpt}
          </Text>
          {mentionContext && (
            <Text style={mentionHighlight}>
              Context: ...{mentionContext}...
            </Text>
          )}
        </Section>

        <Button href={commentUrl} style={button}>
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

const commentAuthor: React.CSSProperties = {
  ...paragraph,
  fontWeight: 'bold',
  marginBottom: '8px',
};

const commentText: React.CSSProperties = {
  ...paragraph,
  margin: '0 0 8px 0',
};

const mentionHighlight: React.CSSProperties = {
  ...paragraph,
  fontStyle: 'italic',
  color: '#666',
  margin: 0,
};

const footerText: React.CSSProperties = {
  ...paragraph,
  fontSize: '12px',
  color: '#666',
  marginTop: '24px',
};