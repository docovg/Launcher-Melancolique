/**
 * minecraft-java-core stores Microsoft token expiration dates in milliseconds,
 * but its refresh method compares them with a timestamp expressed in seconds.
 * Keep the persisted account in the unit expected by the refresh method.
 */
function normalizeMicrosoftAccount(account) {
    if (account?.meta?.type !== 'Xbox') return account;

    const expiresAt = Number(account.meta.access_token_expires_in);
    if (!Number.isFinite(expiresAt) || expiresAt < 10_000_000_000) return account;

    return {
        ...account,
        meta: {
            ...account.meta,
            access_token_expires_in: Math.floor(expiresAt / 1000)
        }
    };
}

/**
 * Only discard a saved Microsoft account when Microsoft explicitly says that
 * its credentials are no longer usable. Network and service errors must never
 * erase a local session.
 */
function isPermanentMicrosoftAuthError(result) {
    const error = String(result?.error || '').toLowerCase();

    if (result?.errorType === 'oauth2') {
        return ['invalid_grant', 'invalid_client', 'unauthorized_client'].includes(error);
    }

    return ['no_minecraft_account', 'no_minecraft_entitlements'].includes(error);
}

export {
    normalizeMicrosoftAccount,
    isPermanentMicrosoftAuthError
};
