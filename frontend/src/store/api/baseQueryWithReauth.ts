'use client';
import { fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';

export function makeBaseQueryWithReauth(
  baseUrl: string,
  loginPath = '/portal/login',
): BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> {
  const rawQuery = fetchBaseQuery({ baseUrl, credentials: 'same-origin' });

  return async (args, api, extraOptions) => {
    let result = await rawQuery(args, api, extraOptions);

    if (result.error?.status === 401) {
      if (loginPath === '/portal/login') {
        // Portal: intentar refresh automático
        const refreshRes = await fetch('/api/portal/auth/refresh', {
          method: 'POST',
          credentials: 'same-origin',
        });

        if (refreshRes.ok) {
          result = await rawQuery(args, api, extraOptions);
          return result;
        }
      }

      if (typeof window !== 'undefined') {
        const redirect = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `${loginPath}?redirect=${redirect}`;
      }
    }

    return result;
  };
}
