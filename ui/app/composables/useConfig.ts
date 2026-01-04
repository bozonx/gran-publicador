export const useConfig = () => {
    const api = useApi();
    const loading = ref(false);
    const error = ref<string | null>(null);

    const fetchConfig = async () => {
        loading.value = true;
        error.value = null;
        try {
            const { yaml } = await api.get<{ yaml: string }>('/config');
            return yaml;
        } catch (err: any) {
            error.value = err.message || 'Failed to fetch configuration';
            throw err;
        } finally {
            loading.value = false;
        }
    };

    const updateConfig = async (yaml: string) => {
        loading.value = true;
        error.value = null;
        try {
            await api.put('/config', { yaml });
            return true;
        } catch (err: any) {
            error.value = err.message || 'Failed to update configuration';
            throw err;
        } finally {
            loading.value = false;
        }
    };

    return {
        loading,
        error,
        fetchConfig,
        updateConfig,
    };
};
