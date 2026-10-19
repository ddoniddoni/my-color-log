type AccountDeletionOperationResult = {
  error: unknown | null;
};

type DeleteColorLogAccountInput = {
  deleteAppData: () => PromiseLike<AccountDeletionOperationResult>;
  signOutCurrentSession: () => PromiseLike<AccountDeletionOperationResult>;
};

// Auth is shared with other apps. Never delete the identity or revoke their sessions.
export async function deleteColorLogAccount({ deleteAppData, signOutCurrentSession }: DeleteColorLogAccountInput): Promise<void> {
  const { error: signOutError } = await signOutCurrentSession();
  if (signOutError) throw new Error('session_revocation_failed');

  const { error: deletionError } = await deleteAppData();
  if (deletionError) throw new Error('account_data_deletion_failed');
}
