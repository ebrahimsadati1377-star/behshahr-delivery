import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { SmsProvider } from './sms.provider';

type IpPanelResponse = {
  data?: {
    message_outbox_ids?: number[];
  } | null;
  meta?: {
    status?: boolean;
    message?: string;
    message_code?: string;
  };
};

@Injectable()
export class IpPanelSmsProvider implements SmsProvider {
  async sendOtp(phone: string, code: string): Promise<void> {
    const apiKey = this.requiredEnv('IPPANEL_API_KEY');
    const fromNumber = this.requiredEnv('IPPANEL_FROM_NUMBER');
    const patternCode = this.requiredEnv('IPPANEL_OTP_PATTERN_CODE');
    const paramName = (process.env.IPPANEL_OTP_PARAM_NAME ?? 'code').trim();
    if (!paramName) throw new Error('IPPANEL_OTP_PARAM_NAME must not be empty');

    const baseUrl = (process.env.IPPANEL_API_BASE_URL ?? 'https://edge.ippanel.com/v1').replace(/\/$/, '');
    const timeoutMs = this.positiveNumberEnv('IPPANEL_TIMEOUT_MS', 5000);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${baseUrl}/api/send`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sending_type: 'pattern',
          from_number: fromNumber,
          code: patternCode,
          recipients: [phone],
          params: {
            [paramName]: code,
          },
        }),
        signal: controller.signal,
      });

      const body = (await response.json().catch(() => ({}))) as IpPanelResponse;

      if (!response.ok || body.meta?.status !== true) {
        const providerCode = body.meta?.message_code ? ` ${body.meta.message_code}` : '';
        throw new ServiceUnavailableException(`IPPanel SMS request failed.${providerCode}`);
      }
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      const reason = error instanceof Error && error.name === 'AbortError' ? 'timed out' : 'request failed';
      throw new ServiceUnavailableException(`IPPanel SMS ${reason}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  private requiredEnv(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) throw new Error(`${name} is required for SMS_PROVIDER=ippanel`);
    return value;
  }

  private positiveNumberEnv(name: string, fallback: number): number {
    const raw = process.env[name];
    if (!raw) return fallback;
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive number`);
    return value;
  }
}
