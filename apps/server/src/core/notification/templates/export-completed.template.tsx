import * as React from 'react';
import { Button, Section, Text, Link, Row, Column } from '@react-email/components';
import { MailBody } from '../../../integrations/transactional/partials/partials';
import { content, paragraph, button, h1 } from '../../../integrations/transactional/css/styles';

interface ExportCompletedEmailProps {
  recipientName: string;
  exportType: string;
  entityName: string;
  fileSize: string;
  downloadUrl: string;
  expiresAt: string;
  workspaceName: string;
  settingsUrl: string;
}

export const ExportCompletedEmail = ({
  recipientName,
  exportType,
  entityName,
  fileSize,
  downloadUrl,
  expiresAt,
  workspaceName,
  settingsUrl,
}: ExportCompletedEmailProps) => {
  return (
    <MailBody>
      <Section style={content}>
        <Text style={h1}>Export Complete!</Text>
        
        <Text style={paragraph}>
          Hi {recipientName},
        </Text>
        
        <Text style={paragraph}>
          Your {exportType.toUpperCase()} export of "{entityName}" has been completed successfully.
        </Text>

        <Section style={exportDetails}>
          <Row>
            <Column style={detailLabel}>File Size:</Column>
            <Column style={detailValue}>{fileSize}</Column>
          </Row>
          <Row>
            <Column style={detailLabel}>Format:</Column>
            <Column style={detailValue}>{exportType.toUpperCase()}</Column>
          </Row>
          <Row>
            <Column style={detailLabel}>Expires:</Column>
            <Column style={detailValue}>{expiresAt}</Column>
          </Row>
        </Section>

        <Button href={downloadUrl} style={downloadButton}>
          Download Export
        </Button>
        
        <Text style={warningText}>
          ⚠️ This download link will expire on {expiresAt}.
          Please download your file before then.
        </Text>

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

const exportDetails: React.CSSProperties = {
  backgroundColor: '#f5f5f5',
  borderRadius: '4px',
  padding: '16px',
  margin: '16px 0',
};

const detailLabel: React.CSSProperties = {
  ...paragraph,
  fontWeight: 'bold',
  width: '120px',
  paddingBottom: '8px',
};

const detailValue: React.CSSProperties = {
  ...paragraph,
  paddingBottom: '8px',
};

const downloadButton: React.CSSProperties = {
  ...button,
  backgroundColor: '#28a745',
  width: 'auto',
  padding: '12px 24px',
  margin: '0 auto',
};

const warningText: React.CSSProperties = {
  ...paragraph,
  backgroundColor: '#fff3cd',
  border: '1px solid #ffeeba',
  borderRadius: '4px',
  color: '#856404',
  padding: '12px',
  marginTop: '16px',
};

const footerText: React.CSSProperties = {
  ...paragraph,
  fontSize: '12px',
  color: '#666',
  marginTop: '24px',
};