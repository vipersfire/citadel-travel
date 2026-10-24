import React from 'react';
import { Document, Page, Text, View, StyleSheet, renderToBuffer, Font } from '@react-pdf/renderer';
import { fileURLToPath } from 'node:url';
Font.register({
  family: 'Schibsted',
  fonts: [
    { src: fileURLToPath(new URL('../fonts/regular.ttf', import.meta.url)), fontWeight: 400 },
    { src: fileURLToPath(new URL('../fonts/medium.ttf', import.meta.url)), fontWeight: 500 },
  ],
});
Font.register({
  family: 'Caslon',
  src: fileURLToPath(new URL('../fonts/display.ttf', import.meta.url)),
});
const s = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 12,
    fontFamily: 'Schibsted',
    color: '#12291F',
    backgroundColor: '#F4F5F1',
  },
  brand: { fontSize: 25, fontFamily: 'Caslon', marginBottom: 24 },
  title: { fontSize: 28, fontFamily: 'Caslon', marginBottom: 16 },
  row: { paddingVertical: 12, borderBottom: '1px solid #D8DCD3' },
  small: { fontSize: 12, color: '#56635C', marginBottom: 8 },
});
export async function pdf(
  title: string,
  subtitle: string,
  rows: { title: string; body: string }[],
  locale: 'id' | 'en' = 'id',
) {
  return renderToBuffer(
    React.createElement(
      Document,
      { language: locale },
      React.createElement(
        Page,
        { size: 'A4', style: s.page },
        React.createElement(Text, { style: s.brand }, 'Citadel'),
        React.createElement(Text, { style: s.title }, title),
        React.createElement(Text, { style: s.small }, subtitle),
        ...rows.map((r, i) =>
          React.createElement(
            View,
            { key: i, style: s.row, wrap: true },
            React.createElement(Text, null, r.title),
            React.createElement(Text, { style: s.small }, r.body),
          ),
        ),
      ),
    ),
  );
}
