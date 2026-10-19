import { deleteColorLogAccount } from '../accountDeletionWorkflow';

describe('deleteColorLogAccount', () => {
  it('revokes only the current session before deleting app data', async () => {
    const signOutCurrentSession = jest.fn().mockResolvedValue({ error: null });
    const deleteAppData = jest.fn().mockResolvedValue({ error: null });
    await deleteColorLogAccount({ deleteAppData, signOutCurrentSession });
    expect(signOutCurrentSession).toHaveBeenCalledTimes(1);
    expect(deleteAppData).toHaveBeenCalledTimes(1);
    expect(signOutCurrentSession.mock.invocationCallOrder[0]).toBeLessThan(deleteAppData.mock.invocationCallOrder[0]);
  });

  it('does not delete data when current session revocation fails', async () => {
    const signOutCurrentSession = jest.fn().mockResolvedValue({ error: new Error('failed') });
    const deleteAppData = jest.fn().mockResolvedValue({ error: null });
    await expect(deleteColorLogAccount({ deleteAppData, signOutCurrentSession })).rejects.toThrow('session_revocation_failed');
    expect(deleteAppData).not.toHaveBeenCalled();
  });

  it('reports a data deletion failure without deleting the shared identity', async () => {
    await expect(deleteColorLogAccount({
      deleteAppData: jest.fn().mockResolvedValue({ error: new Error('failed') }),
      signOutCurrentSession: jest.fn().mockResolvedValue({ error: null }),
    })).rejects.toThrow('account_data_deletion_failed');
  });
});
