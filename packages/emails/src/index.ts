import React from 'react';
import { Html, Head, Body, Container, Heading, Text, Link } from '@react-email/components';
import { render } from '@react-email/render';
export async function renderEmail(
  subject: string,
  body: string,
  url?: string,
  locale: string = 'id',
) {
  return render(
    React.createElement(
      Html,
      null,
      React.createElement(Head),
      React.createElement(
        Body,
        { style: { backgroundColor: '#F4F5F1', fontFamily: 'Arial,sans-serif', color: '#12291F' } },
        React.createElement(
          Container,
          { style: { padding: '40px 24px' } },
          React.createElement(Heading, null, 'Citadel'),
          React.createElement(Heading, { as: 'h2' }, subject),
          React.createElement(Text, null, body),
          url
            ? React.createElement(
                Link,
                { href: url },
                locale === 'id' ? 'Lihat perjalanan Anda' : 'View your journey',
              )
            : null,
        ),
      ),
    ),
  );
}
