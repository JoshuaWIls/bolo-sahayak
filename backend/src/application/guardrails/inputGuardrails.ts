import type { GuardrailContext, InputGuardrail } from '../../domain/ports';
import type { AgentReply } from '../../domain/types';
import { phrase } from '../messages';
import { containsAny } from './keywords';

const EMERGENCY_TERMS = [
  'chest pain', 'heart attack', 'bleeding', 'unconscious', 'fainted', "can't breathe",
  'seene mein dard', 'chhati mein dard', 'khoon', 'behosh',
  'सीने में दर्द', 'छाती में दर्द', 'खून', 'बेहोश', 'साँस नहीं',
  'ಎದೆ ನೋವು', 'ರಕ್ತ', 'ಪ್ರಜ್ಞೆ ತಪ್ಪಿ', 'ಉಸಿರಾಡಲು ಆಗುತ್ತಿಲ್ಲ',
] as const;

const CREDENTIAL_TERMS = [
  'otp', 'pin', 'password', 'cvv', 'upi pin', 'mpin',
  'ओटीपी', 'पिन', 'पासवर्ड', 'ಒಟಿಪಿ', 'ಪಿನ್', 'ಪಾಸ್‌ವರ್ಡ್',
] as const;

const FRAUD_TERMS = [
  'fraud', 'scam', 'lottery', 'account blocked', 'account block', 'kyc call', 'kyc expire',
  'dhokha', 'thagi', 'धोखा', 'ठगी', 'लॉटरी', 'ಮೋಸ', 'ವಂಚನೆ',
] as const;

/** Emergency words bypass the model entirely and raise an emergency banner. */
export class EmergencyGuardrail implements InputGuardrail {
  readonly name = 'emergency';

  check({ text, language, script }: GuardrailContext): AgentReply | null {
    if (!containsAny(text, EMERGENCY_TERMS)) return null;
    return { lang: language, action: 'emergency', ...phrase('emergency', language, script) };
  }
}

/** Any mention of OTP / PIN / password gets a fixed refusal — no model call. */
export class CredentialGuardrail implements InputGuardrail {
  readonly name = 'credential';

  check({ text, language, script }: GuardrailContext): AgentReply | null {
    if (!containsAny(withoutPostalPin(text), CREDENTIAL_TERMS)) return null;
    return { lang: language, action: 'none', ...phrase('otpRefusal', language, script) };
  }
}

/** Likely-scam situations get the 1930 cyber-fraud helpline and a staff hand-off. */
export class FraudGuardrail implements InputGuardrail {
  readonly name = 'fraud';

  check({ text, language, script }: GuardrailContext): AgentReply | null {
    if (!containsAny(text, FRAUD_TERMS)) return null;
    return {
      lang: language,
      action: 'handoff',
      handoff: { task: 'Suspected fraud', check: 'Advise customer; 1930 helpline', language },
      ...phrase('fraud', language, script),
    };
  }
}

/**
 * "PIN code" on an address / KYC form is a postal code, not a secret.
 * Remove it before looking for credential words.
 */
function withoutPostalPin(text: string): string {
  return text
    .replace(/\bpin[\s-]*code\b/gi, ' ')
    .replace(/पिन\s*कोड/g, ' ')
    .replace(/ಪಿನ್\s*ಕೋಡ್/g, ' ');
}
