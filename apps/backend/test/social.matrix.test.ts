// Pure truth-table test for the shared group permission matrix (roleCan/canKick).
// Lives in the backend suite because @gambling/shared has no test runner of its
// own (its game math is likewise covered here). No DB access.
import { describe, it, expect } from 'vitest';
import { roleCan, canKick } from '@gambling/shared';
import type { GroupRole, GroupPermission } from '@gambling/shared';

const ALL_PERMS: GroupPermission[] = [
  'invite',
  'kickMember',
  'kickAdmin',
  'promote',
  'demote',
  'rename',
  'transferOwner',
  'deleteGroup',
];

describe('roleCan — group permission matrix', () => {
  it('owner can do everything', () => {
    for (const p of ALL_PERMS) expect(roleCan('owner', p)).toBe(true);
  });

  it('admin can invite, kick members and rename — nothing else', () => {
    const allowed = new Set<GroupPermission>(['invite', 'kickMember', 'rename']);
    for (const p of ALL_PERMS) expect(roleCan('admin', p)).toBe(allowed.has(p));
  });

  it('member can only invite', () => {
    for (const p of ALL_PERMS) expect(roleCan('member', p)).toBe(p === 'invite');
  });
});

describe('canKick — who can remove whom', () => {
  const roles: GroupRole[] = ['owner', 'admin', 'member'];

  it('nobody can kick the owner', () => {
    for (const r of roles) expect(canKick(r, 'owner')).toBe(false);
  });

  it('only the owner can kick an admin', () => {
    expect(canKick('owner', 'admin')).toBe(true);
    expect(canKick('admin', 'admin')).toBe(false);
    expect(canKick('member', 'admin')).toBe(false);
  });

  it('owner and admin can kick a member; a member cannot', () => {
    expect(canKick('owner', 'member')).toBe(true);
    expect(canKick('admin', 'member')).toBe(true);
    expect(canKick('member', 'member')).toBe(false);
  });
});
