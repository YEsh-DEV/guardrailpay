import { WorldAuthError } from '@quoteseal/shared';
import { consumeSession } from './start.js';
import { isAuthorizedOperator, getOperator, Operator } from './operators.js';

export interface ValidateCallbackParams {
  code: string;
  state: string;
  error?: string;
  error_description?: string;
}

export interface ValidationResult {
  valid: boolean;
  subject: string;
  operator?: Operator;
  error?: string;
}

export async function validateCallback(
  params: ValidateCallbackParams
): Promise<ValidationResult> {
  if (params.error) {
    return {
      valid: false,
      subject: '',
      error: `World ID Auth Denied (${params.error}): ${params.error_description || params.error}`,
    };
  }

  const session = consumeSession(params.state);
  if (!session) {
    throw new WorldAuthError('Invalid or expired auth session state');
  }

  // Handle mock / test tokens for demonstration
  // Format: mock_code_<subject>
  let subject: string;
  if (params.code.startsWith('mock_code_')) {
    subject = params.code.replace('mock_code_', '');
  } else if (params.code === 'demo_cfo_code') {
    subject = 'sub_world_treasury_demo';
  } else if (params.code === 'unauthorized_code') {
    subject = 'sub_unauthorized_attacker';
  } else {
    // In production with real World OIDC endpoint, exchange code for ID token via token_endpoint
    subject = `sub_world_${params.code.slice(0, 8)}`;
  }

  const authorized = isAuthorizedOperator(subject, 'ROTATION_APPROVER');
  const operator = getOperator(subject);

  if (!authorized) {
    return {
      valid: false,
      subject,
      error: `Subject '${subject}' is not an authorized rotation approver`,
    };
  }

  return {
    valid: true,
    subject,
    operator,
  };
}
