export function getAppBaseUrl(): string {
    const configuredUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!configuredUrl) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('NEXT_PUBLIC_APP_URL wajib diatur di production');
        }
        return 'http://localhost:3000';
    }

    return new URL(configuredUrl).origin;
}
