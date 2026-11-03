import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Markdown,
  Preview,
  Section,
  Text,
} from "@react-email/components";

// The one React Email layout every email uses (SPEC.md → Email: React Email
// templates in /emails). Each email's words live in content/emails/<id>.md;
// this draws them: large type, one accent colour, a single button, and an
// unsubscribe link on marketing email.

const ACCENT = "#43252c";
const INK = "#242122";
const MUTE = "#564b4e";

export interface EmailLayoutProps {
  preview: string;
  markdown: string;
  button?: { label: string; url: string };
  unsubscribeUrl?: string;
  appUrl: string;
}

export function EmailLayout({
  preview,
  markdown,
  button,
  unsubscribeUrl,
  appUrl,
}: EmailLayoutProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: "#f7f2e9",
          margin: 0,
          padding: "24px 0",
          fontFamily: "Helvetica, Arial, sans-serif",
        }}
      >
        <Container
          style={{
            maxWidth: 560,
            backgroundColor: "#fffcf7",
            padding: "32px 28px",
            borderRadius: 16,
          }}
        >
          <Text
            style={{
              color: ACCENT,
              fontFamily: "Georgia, serif",
              fontSize: 22,
              fontWeight: 700,
              margin: "0 0 16px",
            }}
          >
            Her Little Empire
          </Text>
          <Markdown
            markdownContainerStyles={{ color: INK, fontSize: 17, lineHeight: "1.6" }}
            markdownCustomStyles={{ link: { color: ACCENT }, p: { margin: "0 0 14px" } }}
          >
            {markdown}
          </Markdown>
          {button ? (
            <Section style={{ margin: "24px 0 8px" }}>
              <Button
                href={button.url}
                style={{
                  backgroundColor: ACCENT,
                  color: "#f7f2e9",
                  padding: "14px 24px",
                  borderRadius: 999,
                  fontSize: 17,
                  fontWeight: 700,
                }}
              >
                {button.label}
              </Button>
            </Section>
          ) : null}
          <Hr style={{ borderColor: "#d9ccc1", margin: "28px 0 16px" }} />
          <Text style={{ color: MUTE, fontSize: 13, lineHeight: "1.5", margin: 0 }}>
            Her Little Empire ·{" "}
            <Link href={appUrl} style={{ color: MUTE }}>
              {appUrl.replace(/^https?:\/\//, "")}
            </Link>
            {unsubscribeUrl ? (
              <>
                <br />
                Don't want these emails?{" "}
                <Link href={unsubscribeUrl} style={{ color: MUTE }}>
                  Unsubscribe
                </Link>
                . Receipts still come.
              </>
            ) : null}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
