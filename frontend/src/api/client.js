/**
 * Reusable HTTP API Client with Credentials & Automatic Token Refresh.
 * Intercepts 401s, attempts silent token refresh, and replays requests.
 */

let isRefreshing = false;
let refreshSubscribers = [];

function onRefreshed() {
  refreshSubscribers.forEach((callback) => callback());
  refreshSubscribers = [];
}

export async function apiClient(url, options = {}) {
  const defaultHeaders = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // If payload is FormData, do not set Content-Type header (browser sets boundary)
  if (options.body instanceof FormData) {
    delete defaultHeaders['Content-Type'];
  }

  const fetchOptions = {
    ...options,
    credentials: 'include', // Transmit and receive httpOnly cookies
    headers: defaultHeaders,
  };

  let response;
  try {
    response = await fetch(url, fetchOptions);
  } catch (networkErr) {
    throw new Error(`Network request failed: ${networkErr.message}`);
  }

  // Intercept 401 for silent token refresh (except for login or refresh itself)
  if (
    response.status === 401 &&
    !url.includes('/api/v1/auth/login') &&
    !url.includes('/api/v1/auth/refresh') &&
    !url.includes('/api/v1/auth/register-clinic')
  ) {
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const refreshResponse = await fetch('/api/v1/auth/refresh', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });

        if (refreshResponse.ok) {
          isRefreshing = false;
          onRefreshed();
          return fetch(url, fetchOptions);
        } else {
          isRefreshing = false;
          // Refresh failed - session expired
          return response;
        }
      } catch (refreshErr) {
        isRefreshing = false;
        return response;
      }
    }

    // Queue request until refresh completes
    return new Promise((resolve) => {
      refreshSubscribers.push(async () => {
        resolve(await fetch(url, fetchOptions));
      });
    });
  }

  return response;
}

