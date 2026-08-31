export abstract class SmsProvider {
  abstract sendOtp(phone: string, code: string): Promise<void>;
}
