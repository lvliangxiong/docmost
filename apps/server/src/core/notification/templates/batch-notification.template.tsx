import * as React from 'react';
import { Button, Section, Text, Link, Hr, Heading } from '@react-email/components';
import { MailBody } from '@docmost/transactional/partials/partials';
import { content, paragraph, button, h1 } from '@docmost/transactional/css/styles';

interface NotificationGroup {
  type: string;
  title: string;
  summary: string;
  count: number;
  actors: string[];
  url: string;
  preview: string[];
}

interface BatchNotificationEmailProps {
  recipientName: string;
  groups: NotificationGroup[];
  totalCount: number;
  workspaceName: string;
  settingsUrl: string;
  viewAllUrl: string;
}

export const BatchNotificationEmail = ({
  recipientName,
  groups,
  totalCount,
  workspaceName,
  settingsUrl,
  viewAllUrl,
}: BatchNotificationEmailProps) => {
  return (
    <MailBody>
      <Section style={content}>
        <Text style={h1}>Hi {recipientName},</Text>
        
        <Text style={paragraph}>
          You have {totalCount} new notifications in {workspaceName}:
        </Text>

        {groups.map((group, index) => (
          <Section key={index} style={notificationGroup}>
            <Heading as="h3" style={groupTitle}>
              {group.title}
            </Heading>
            
            <Text style={actorList}>
              {formatActors(group.actors)} {group.summary}
            </Text>
            
            {group.preview.slice(0, 3).map((item, i) => (
              <Text key={i} style={notificationItem}>
                • {item}
              </Text>
            ))}
            
            {group.count > 3 && (
              <Text style={moreText}>
                And {group.count - 3} more...
              </Text>
            )}
            
            <Button href={group.url} style={viewButton}>
              View All
            </Button>
          </Section>
        ))}

        <Hr style={divider} />

        <Button href={viewAllUrl} style={viewAllButton}>
          View All Notifications
        </Button>
        
        <Text style={footerText}>
          You received this because you have smart notifications enabled.{' '}
          <Link href={settingsUrl} style={{ color: '#176ae5' }}>
            Manage your preferences
          </Link>
        </Text>
      </Section>
    </MailBody>
  );
};

function formatActors(actors: string[]): string {
  if (actors.length === 0) return '';
  if (actors.length === 1) return actors[0];
  if (actors.length === 2) return `${actors[0]} and ${actors[1]}`;
  return `${actors[0]}, ${actors[1]} and ${actors.length - 2} others`;
}

const notificationGroup: React.CSSProperties = {
  backgroundColor: '#f9f9f9',
  borderRadius: '4px',
  padding: '16px',
  marginBottom: '16px',
};

const groupTitle: React.CSSProperties = {
  ...paragraph,
  fontSize: '16px',
  fontWeight: 'bold',
  marginBottom: '8px',
};

const actorList: React.CSSProperties = {
  ...paragraph,
  marginBottom: '12px',
};

const notificationItem: React.CSSProperties = {
  ...paragraph,
  marginLeft: '8px',
  marginBottom: '4px',
  color: '#666',
};

const moreText: React.CSSProperties = {
  ...paragraph,
  fontStyle: 'italic',
  color: '#999',
  marginLeft: '8px',
  marginBottom: '12px',
};

const viewButton: React.CSSProperties = {
  ...button,
  width: 'auto',
  padding: '8px 16px',
  fontSize: '14px',
  marginTop: '8px',
};

const viewAllButton: React.CSSProperties = {
  ...button,
  width: 'auto',
  padding: '12px 24px',
  margin: '16px auto',
};

const divider: React.CSSProperties = {
  borderColor: '#e0e0e0',
  margin: '24px 0',
};

const footerText: React.CSSProperties = {
  ...paragraph,
  fontSize: '12px',
  color: '#666',
  marginTop: '24px',
};