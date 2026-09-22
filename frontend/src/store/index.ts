import { configureStore } from '@reduxjs/toolkit';
import { integracionSapApi } from './api/integracionSapApi';

export const store = configureStore({
  reducer: {
    [integracionSapApi.reducerPath]: integracionSapApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(integracionSapApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
