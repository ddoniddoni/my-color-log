import { deleteAuthIdentity, type AccountDeletionAdminAuth } from '../accountDeletionWorkflow';

describe('deleteAuthIdentity', () => {
  it('revokes every session with the access token before deleting the user id', async () => {
    const signOut = jest.fn().mockResolvedValue({ error: null });
    const deleteUser = jest.fn().mockResolvedValue({ error: null });
    const adminAuth: AccountDeletionAdminAuth = { deleteUser, signOut };

    await deleteAuthIdentity({
      accessToken: 'signed-user-access-token',
      adminAuth,
      userId: 'user-id',
    });

    expect(signOut).toHaveBeenCalledWith('signed-user-access-token', 'global');
    expect(deleteUser).toHaveBeenCalledWith('user-id');
    expect(signOut.mock.invocationCallOrder[0]).toBeLessThan(deleteUser.mock.invocationCallOrder[0]);
  });

  it('does not delete the identity when session revocation fails', async () => {
    const signOut = jest.fn().mockResolvedValue({ error: new Error('failed') });
    const deleteUser = jest.fn().mockResolvedValue({ error: null });

    await expect(deleteAuthIdentity({
      accessToken: 'signed-user-access-token',
      adminAuth: { deleteUser, signOut },
      userId: 'user-id',
    })).rejects.toThrow('session_revocation_failed');

    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('reports a user deletion failure after sessions are revoked', async () => {
    const signOut = jest.fn().mockResolvedValue({ error: null });
    const deleteUser = jest.fn().mockResolvedValue({ error: new Error('failed') });

    await expect(deleteAuthIdentity({
      accessToken: 'signed-user-access-token',
      adminAuth: { deleteUser, signOut },
      userId: 'user-id',
    })).rejects.toThrow('auth_user_deletion_failed');
  });
});
