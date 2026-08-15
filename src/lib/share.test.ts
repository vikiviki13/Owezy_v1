import { describe, expect, it } from 'vitest';
import {
  APP_URL,
  buildAppShareMessage,
  buildAppShareUrl,
  buildEmailShareUrl,
  buildSmsShareUrl,
  buildTelegramShareUrl,
  buildWhatsAppShareUrl,
} from './share';

describe('buildAppShareUrl', () => {
  it('returns the production URL when referrals are disabled', () => {
    expect(buildAppShareUrl()).toBe(APP_URL);
    expect(buildAppShareUrl('USER123')).toBe(APP_URL);
  });
});

describe('buildAppShareMessage', () => {
  it('includes the app name and the download link', () => {
    const message = buildAppShareMessage();
    expect(message).toContain('Owezy');
    expect(message).toContain(APP_URL);
  });

  it('uses the provided URL when given', () => {
    const message = buildAppShareMessage('https://example.com');
    expect(message).toContain('https://example.com');
    expect(message).not.toContain(APP_URL);
  });
});

describe('share URL builders', () => {
  it('builds a WhatsApp deep link with the encoded message', () => {
    const url = buildWhatsAppShareUrl('Hey!');
    expect(url).toBe('https://wa.me/?text=Hey!');
  });

  it('builds a Telegram share URL with url and text', () => {
    const url = buildTelegramShareUrl('Hello', APP_URL);
    expect(url).toContain('https://t.me/share/url');
    expect(url).toContain(`url=${encodeURIComponent(APP_URL)}`);
    expect(url).toContain('text=Hello');
  });

  it('builds an SMS URL with the encoded body', () => {
    expect(buildSmsShareUrl('Hi there')).toBe('sms:?&body=Hi%20there');
  });

  it('builds a mailto URL with subject and body', () => {
    const url = buildEmailShareUrl('Subject', 'Body text');
    expect(url).toContain('mailto:?subject=Subject');
    expect(url).toContain('body=Body%20text');
  });
});