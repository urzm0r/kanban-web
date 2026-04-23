export const parseJwt = (token: string) => {
    try {
        return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    } catch {
        return null;
    }
};

export const getUserIdFromToken = (token: string | null): string | null => {
    if (!token) return null;
    const decoded = parseJwt(token);
    return decoded?.userId || null;
};
