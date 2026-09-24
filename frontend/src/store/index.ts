import { configureStore } from '@reduxjs/toolkit';
import { integracionSapApi } from './api/integracionSapApi';
import { portalApi } from './api/portalApi';
import { adminApi } from './api/adminApi';

export const store = configureStore({
  reducer: {
    [integracionSapApi.reducerPath]: integracionSapApi.reducer,
    [portalApi.reducerPath]: portalApi.reducer,
    [adminApi.reducerPath]: adminApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware()
      .concat(integracionSapApi.middleware)
      .concat(portalApi.middleware)
      .concat(adminApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
