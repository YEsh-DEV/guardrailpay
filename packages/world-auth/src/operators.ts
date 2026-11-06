export interface Operator {
  subject: string; // World ID nullifier / sub
  name: string;
  role: 'TREASURY_ADMIN' | 'SECURITY_OFFICER' | 'ROTATION_APPROVER';
  authorized: boolean;
}

// In-memory registry of authorized operators
const authorizedOperators = new Map<string, Operator>();

// Pre-seed demo operator
authorizedOperators.set('sub_world_treasury_demo', {
  subject: 'sub_world_treasury_demo',
  name: 'Alice Treasury Lead',
  role: 'ROTATION_APPROVER',
  authorized: true,
});

export function registerOperator(operator: Operator): void {
  authorizedOperators.set(operator.subject, operator);
}

export function isAuthorizedOperator(
  subject: string,
  requiredRole: Operator['role'] = 'ROTATION_APPROVER'
): boolean {
  const op = authorizedOperators.get(subject);
  if (!op || !op.authorized) return false;
  return op.role === requiredRole;
}

export function getOperator(subject: string): Operator | undefined {
  return authorizedOperators.get(subject);
}
