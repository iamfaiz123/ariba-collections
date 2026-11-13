import { config } from '../config.js';
import { fetchJson } from './fetch.js';
import { maskPhone } from './util.js';

/**
 * WhatsApp messages through Meta's WhatsApp Cloud API.
 * Business-initiated messages must use templates approved in WhatsApp Manager (see backend/README.md).
 * WHATSAPP_PROVIDER=console prints messages to the log instead (local development and tests).
 */
export interface SentMessage {
  to: string;
  template: string;
  params: string[];
  document?: { filename: string; bytes: number };
  id: string;
}

/** Messages "sent" by the console provider, newest last (tests read this). */
export const consoleOutbox: SentMessage[] = [];

const graph = (path: string) => `${config.WHATSAPP_API_URL}/${config.WHATSAPP_API_VERSION}/${path}`;
const authHeader = () => ({ authorization: `Bearer ${config.WHATSAPP_TOKEN}` });
const toWa = (e164: string) => e164.replace(/^\+/, '');

async function sendTemplate(to: string, template: string, components: unknown[], logParams: string[], document?: SentMessage['document']): Promise<string> {
  if (config.WHATSAPP_PROVIDER === 'console') {
    const id = `console-${Date.now()}-${consoleOutbox.length}`;
    consoleOutbox.push({ to, template, params: logParams, document, id });
    if (config.NODE_ENV !== 'test') console.log(`[whatsapp:console] to ${to} · ${template} · ${JSON.stringify(logParams)}${document ? ` · 📎 ${document.filename}` : ''}`);
    return id;
  }
  const res = await fetchJson<{ messages?: { id: string }[] }>(graph(`${config.WHATSAPP_PHONE_NUMBER_ID}/messages`), {
    method: 'POST',
    headers: authHeader(),
    timeoutMs: 15000,
    body: {
      messaging_product: 'whatsapp',
      to: toWa(to),
      type: 'template',
      template: { name: template, language: { code: config.WHATSAPP_TEMPLATE_LANG }, components },
    },
  });
  const id = res.messages?.[0]?.id;
  if (!id) throw new Error(`WhatsApp did not return a message id for ${maskPhone(to)}`);
  return id;
}

const bodyParams = (values: string[]) => ({ type: 'body', parameters: values.map((text) => ({ type: 'text', text })) });

/** Login code. Uses an "Authentication" category template with a copy-code button. */
export function sendOtp(to: string, code: string) {
  return sendTemplate(
    to,
    config.WHATSAPP_OTP_TEMPLATE,
    [bodyParams([code]), { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] }],
    ['******'],
  );
}

async function uploadPdf(pdf: Buffer, filename: string): Promise<string> {
  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('type', 'application/pdf');
  form.append('file', new Blob([new Uint8Array(pdf)], { type: 'application/pdf' }), filename);
  const res = await fetchJson<{ id: string }>(graph(`${config.WHATSAPP_PHONE_NUMBER_ID}/media`), {
    method: 'POST',
    headers: authHeader(),
    body: form,
    timeoutMs: 30000,
  });
  return res.id;
}

/**
 * A template message with a PDF document header, e.g. the order receipt.
 * Template body variables are filled in order from `params`.
 */
export async function sendDocumentTemplate(to: string, template: string, params: string[], pdf: Buffer, filename: string) {
  if (config.WHATSAPP_PROVIDER === 'console') return sendTemplate(to, template, [], params, { filename, bytes: pdf.length });
  const mediaId = await uploadPdf(pdf, filename);
  return sendTemplate(to, template, [{ type: 'header', parameters: [{ type: 'document', document: { id: mediaId, filename } }] }, bodyParams(params)], params);
}

export function sendTextTemplate(to: string, template: string, params: string[]) {
  return sendTemplate(to, template, [bodyParams(params)], params);
}
