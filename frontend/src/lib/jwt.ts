export const parseJwt = (token: string) => {
    try {
        const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
            window.atob(base64)
                .split('')
                .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );
        return JSON.parse(jsonPayload);
    } catch {
        return null;
    }
};

export const getUserIdFromToken = (token: string | null): string | null => {
    if (!token) return null;
    const decoded = parseJwt(token);
    return decoded?.userId || null;
};
