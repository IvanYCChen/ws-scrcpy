import { ref } from 'vue';

export type AuthStatus = 'loading' | 'setup' | 'login' | 'ok' | 'error';

export const MIN_PASSWORD_LENGTH = 6;

// Module-level state: App.vue and the tracker's 4401 handler must see the same instance.
const status = ref<AuthStatus>('loading');
const errorMessage = ref('');

/** Auth endpoints live next to the admin page itself (`<PATHNAME>api/auth/…`). */
function authUrl(name: string): string {
    return new URL(`api/auth/${name}`, location.href).toString();
}

async function request<T>(name: string, body?: unknown): Promise<T> {
    const response = await fetch(authUrl(name), {
        method: body === undefined ? 'GET' : 'POST',
        credentials: 'same-origin',
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
    }
    return data as T;
}

async function refresh(): Promise<void> {
    try {
        const data = await request<{ configured: boolean; authenticated: boolean }>('status');
        status.value = !data.configured ? 'setup' : data.authenticated ? 'ok' : 'login';
        errorMessage.value = '';
    } catch (error) {
        status.value = 'error';
        errorMessage.value = (error as Error).message;
    }
}

async function setup(password: string): Promise<void> {
    await request('setup', { password });
    status.value = 'ok';
}

async function login(password: string): Promise<void> {
    await request('login', { password });
    status.value = 'ok';
}

async function logout(): Promise<void> {
    await request('logout', {});
    status.value = 'login';
}

async function changePassword(current: string, next: string): Promise<void> {
    await request('password', { current, next });
}

export function useAuth() {
    return { status, errorMessage, refresh, setup, login, logout, changePassword };
}
