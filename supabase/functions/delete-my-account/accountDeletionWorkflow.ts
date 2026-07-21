type AccountDeletionOperationResult = {
  error: unknown | null;
};

export type AccountDeletionAdminAuth = {
  deleteUser: (userId: string) => Promise<AccountDeletionOperationResult>;
  signOut: (accessToken: string, scope: 'global') => Promise<AccountDeletionOperationResult>;
};

type DeleteAuthIdentityInput = {
  accessToken: string;
  adminAuth: AccountDeletionAdminAuth;
  userId: string;
};

export async function deleteAuthIdentity({ accessToken, adminAuth, userId }: DeleteAuthIdentityInput): Promise<void> {
  const { error: signOutError } = await adminAuth.signOut(accessToken, 'global');
  if (signOutError) throw new Error('session_revocation_failed');

  const { error: deleteUserError } = await adminAuth.deleteUser(userId);
  if (deleteUserError) throw new Error('auth_user_deletion_failed');
}
