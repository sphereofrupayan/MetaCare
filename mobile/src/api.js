import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

// Set EXPO_PUBLIC_API_URL to your computer's LAN address when testing on a phone.
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

export async function apiRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error(`Can't connect to ${API_BASE_URL}. Check that the server is running and your phone and computer are on the same Wi-Fi.`);
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error('The server returned an unreadable response.');
  }
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
  return payload;
}

export function useApiData(path) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setError('');
    apiRequest(path)
      .then((payload) => {
        if (active) setData(payload);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [path, revision]));

  return { data, loading, error, refresh: () => setRevision((value) => value + 1) };
}

export function useApiList(path, property) {
  const { data, loading, error, refresh } = useApiData(path);
  const items = data?.[property];
  return {
    items: Array.isArray(items) ? items : [],
    loading,
    error: error || (data && !Array.isArray(items) ? 'The server returned invalid data.' : ''),
    refresh,
  };
}
