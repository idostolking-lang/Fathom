(function configureAuthenticatedFetch() {
    const tokenStorageKey = 'dataScraperAccessToken';
    const nativeFetch = window.fetch.bind(window);
    let tokenPromptPromise = null;

    function getUrl(input) {
        if (typeof input === 'string') {
            return new URL(input, window.location.origin);
        }

        return new URL(input.url, window.location.origin);
    }

    function isSameOriginApi(input) {
        try {
            const url = getUrl(input);
            return url.origin === window.location.origin && url.pathname.startsWith('/api/');
        } catch (_error) {
            return false;
        }
    }

    function readTokenFromUrl() {
        const params = new URLSearchParams(window.location.search);
        const token = params.get('access_token') || params.get('token');
        if (!token) return;

        localStorage.setItem(tokenStorageKey, token);
        params.delete('access_token');
        params.delete('token');

        const nextQuery = params.toString();
        const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`;
        window.history.replaceState({}, document.title, nextUrl);
    }

    function getStoredToken() {
        return localStorage.getItem(tokenStorageKey) || '';
    }

    function addTokenHeader(input, init, token = getStoredToken()) {
        if (!token) return init;

        const headers = new Headers(init.headers || (typeof input !== 'string' ? input.headers : undefined));
        headers.set('X-App-Access-Token', token);

        return {
            ...init,
            headers
        };
    }

    function askForAccessToken() {
        const token = window.prompt('Enter your Data Scraper access token');
        if (token && token.trim()) {
            const normalizedToken = token.trim();
            localStorage.setItem(tokenStorageKey, normalizedToken);
            return normalizedToken;
        }

        return '';
    }

    function requestAccessToken() {
        if (!tokenPromptPromise) {
            tokenPromptPromise = Promise.resolve()
                .then(() => getStoredToken() || askForAccessToken())
                .finally(() => {
                    tokenPromptPromise = null;
                });
        }

        return tokenPromptPromise;
    }

    readTokenFromUrl();

    window.fetch = async function authenticatedFetch(input, init = {}) {
        if (!isSameOriginApi(input)) {
            return nativeFetch(input, init);
        }

        const tokenUsed = getStoredToken();
        let response = await nativeFetch(input, addTokenHeader(input, init, tokenUsed));
        if (response.status !== 401) {
            return response;
        }

        const latestToken = getStoredToken();
        if (latestToken && latestToken !== tokenUsed) {
            response = await nativeFetch(input, addTokenHeader(input, init, latestToken));
            if (response.status !== 401) {
                return response;
            }
        }

        if (getStoredToken() === tokenUsed) {
            localStorage.removeItem(tokenStorageKey);
        }

        if (!await requestAccessToken()) {
            return response;
        }

        response = await nativeFetch(input, addTokenHeader(input, init));
        return response;
    };
})();
