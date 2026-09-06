import { createPermissionPolicy, allowPermission, denyPermission, DefaultPermissionChecker } from '../src/permissions';

describe('PermissionChecker', () => {
  it('should allow by default when policy allows', () => {
    const policy = createPermissionPolicy('test', 'allow');
    const checker = new DefaultPermissionChecker(policy);
    
    expect(checker.check('filesystem.read', { agentId: 'a1' })).toBe(true);
  });

  it('should deny by default when policy denies', () => {
    const policy = createPermissionPolicy('test', 'deny');
    const checker = new DefaultPermissionChecker(policy);
    
    expect(checker.check('filesystem.read', { agentId: 'a1' })).toBe(false);
  });

  it('should respect explicit allow', () => {
    let policy = createPermissionPolicy('test', 'deny');
    policy = allowPermission(policy, 'filesystem.read');
    const checker = new DefaultPermissionChecker(policy);
    
    expect(checker.check('filesystem.read', { agentId: 'a1' })).toBe(true);
  });

  it('should respect explicit deny', () => {
    let policy = createPermissionPolicy('test', 'allow');
    policy = denyPermission(policy, 'filesystem.write');
    const checker = new DefaultPermissionChecker(policy);
    
    expect(checker.check('filesystem.write', { agentId: 'a1' })).toBe(false);
    expect(checker.check('filesystem.read', { agentId: 'a1' })).toBe(true);
  });
});
