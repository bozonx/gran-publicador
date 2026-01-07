export interface ApiOptions {
    headers?: Record<string, string>
    onUploadProgress?: (progress: number) => void
    [key: string]: any
}

export const useApi = () => {
    const config = useRuntimeConfig();
    const token = useCookie('auth_token');

    // Base path for API, matching NestJS global prefix
    // If apiBase is empty (production), use current host + /api/v1
    // If apiBase is set (development), use it + /api/v1
    const apiBase = config.public.apiBase
        ? `${config.public.apiBase}/api/v1`
        : '/api/v1';

    // XMLHttpRequest-based upload with progress tracking
    const uploadWithProgress = async <T>(
        url: string,
        body: FormData,
        options: ApiOptions = {}
    ): Promise<T> => {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            // Track upload progress
            if (options.onUploadProgress) {
                xhr.upload.addEventListener('progress', (event) => {
                    if (event.lengthComputable) {
                        const progress = Math.round((event.loaded / event.total) * 100);
                        options.onUploadProgress!(progress);
                    }
                });
            }

            // Handle completion
            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        resolve(response);
                    } catch (error) {
                        reject(new Error('Failed to parse response'));
                    }
                } else if (xhr.status === 401) {
                    token.value = null;
                    reject(new Error('Unauthorized'));
                } else {
                    try {
                        const error = JSON.parse(xhr.responseText);
                        reject(new Error(error.message || `Request failed with status ${xhr.status}`));
                    } catch {
                        reject(new Error(`Request failed with status ${xhr.status}`));
                    }
                }
            });

            // Handle errors
            xhr.addEventListener('error', () => {
                reject(new Error('Network error'));
            });

            xhr.addEventListener('abort', () => {
                reject(new Error('Upload aborted'));
            });

            // Open request
            xhr.open('POST', `${apiBase}${url}`);

            // Set authorization header
            if (token.value) {
                xhr.setRequestHeader('Authorization', `Bearer ${token.value}`);
            }

            // Send request
            xhr.send(body);
        });
    };

    const request = async <T>(url: string, options: ApiOptions = {}) => {
        // Use XMLHttpRequest for FormData with progress tracking
        if (options.body instanceof FormData && options.onUploadProgress) {
            return uploadWithProgress<T>(url, options.body, options);
        }

        // Use $fetch for regular requests
        const headers = {
            ...options.headers,
        };

        if (token.value) {
            headers.Authorization = `Bearer ${token.value}`;
        }

        try {
            return await $fetch<T>(`${apiBase}${url}`, {
                ...options,
                headers,
            });
        } catch (error: any) {
            if (error.response?.status === 401) {
                // Handle unauthorized (clear token, etc.)
                token.value = null;
            }
            throw error;
        }
    };

    return {
        get: <T>(url: string, options: ApiOptions = {}) => request<T>(url, { ...options, method: 'GET' }),
        post: <T>(url: string, body?: any, options: ApiOptions = {}) => request<T>(url, { ...options, method: 'POST', body }),
        patch: <T>(url: string, body?: any, options: ApiOptions = {}) => request<T>(url, { ...options, method: 'PATCH', body }),
        put: <T>(url: string, body?: any, options: ApiOptions = {}) => request<T>(url, { ...options, method: 'PUT', body }),
        delete: <T>(url: string, options: ApiOptions = {}) => request<T>(url, { ...options, method: 'DELETE' }),
    };
};
