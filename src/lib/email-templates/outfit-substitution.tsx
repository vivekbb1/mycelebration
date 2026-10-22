import { Body, Container, Head, Heading, Html, Preview, Text, Button, Section } from '@react-email/components';
import type { TemplateEntry } from './registry';
type Props = { wearer?: string; event?: string; originalTitle?: string; originalSku?: string; originalSize?: string; replacementTitle?: string; replacementSku?: string; replacementSize?: string; portalUrl?: string };
function OutfitSubstitutionEmail(p: Props) {
  return <Html lang="en"><Head /><Preview>Your hosts have updated your outfit{p.event ? ` for ${p.event}` : ''}.</Preview>
    <Body style={{ backgroundColor: '#ffffff', color: '#4a1f2b', fontFamily: 'Georgia, serif' }}>
      <Container style={{ maxWidth: '560px', padding: '28px' }}>
        <Text>My Celebration</Text><Heading>Your outfit update</Heading>
        <Text>Dear {p.wearer || 'guest'}, your hosts have arranged a replacement outfit{p.event ? ` for ${p.event}` : ''} following a change from the vendor.</Text>
        <Section><Heading as="h2">Your original selection</Heading><Text>{p.originalTitle}{p.originalSku ? ` · ${p.originalSku}` : ''}<br />Size: {p.originalSize || 'Not recorded'}</Text></Section>
        <Section><Heading as="h2">Your replacement</Heading><Text>{p.replacementTitle}{p.replacementSku ? ` · ${p.replacementSku}` : ''}<br />Size: {p.replacementSize || 'Not recorded'}</Text></Section>
        <Text>Your original selection remains on record. Please contact your hosts if you have any questions about the replacement or fit.</Text>
        {p.portalUrl ? <Button href={p.portalUrl} style={{ backgroundColor: '#4a1f2b', color: '#ffffff', padding: '12px 20px', borderRadius: '6px' }}>Open My Celebration</Button> : null}
      </Container>
    </Body></Html>;
}
export const template = { component: OutfitSubstitutionEmail, subject: 'Your outfit update — My Celebration', displayName: 'Outfit substitution', previewData: { wearer: 'Guest', event: 'Wedding', originalTitle: 'Original look', originalSize: 'M', replacementTitle: 'Replacement look', replacementSize: 'L' } } satisfies TemplateEntry;