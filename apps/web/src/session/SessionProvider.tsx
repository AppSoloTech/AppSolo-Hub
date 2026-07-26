import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useMemo, useState } from 'react';
import type { SessionDto } from '@appsolo/shared';
import {
  ApiError,
  clearDevelopmentUserId,
  initializeDevelopmentUserId,
  sessionApi,
  storeDevelopmentUserId,
} from '../api.js';

type SessionContextValue = {
  session: SessionDto | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string) => Promise<void>;
  signOut: () => void;
  establish: (session: SessionDto) => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(() => initializeDevelopmentUserId());
  const sessionQuery = useQuery({
    queryKey: ['session', userId],
    queryFn: () => sessionApi.current().then((response) => response.data),
    enabled: userId !== null,
    retry: false,
  });

  const establish = (session: SessionDto) => {
    if (userId !== null && userId !== session.user.id) {
      queryClient.clear();
    }
    storeDevelopmentUserId(session.user.id);
    setUserId(session.user.id);
    queryClient.setQueryData(['session', session.user.id], session);
  };

  const value = useMemo<SessionContextValue>(
    () => ({
      session: sessionQuery.data ?? null,
      loading: userId !== null && sessionQuery.isLoading,
      error:
        sessionQuery.error instanceof ApiError
          ? sessionQuery.error.message
          : sessionQuery.error
            ? 'The development session could not be loaded.'
            : null,
      signIn: async (email: string) => {
        const response = await sessionApi.signIn(email);
        establish(response.data);
      },
      signOut: () => {
        clearDevelopmentUserId();
        setUserId(null);
        queryClient.clear();
      },
      establish,
    }),
    [queryClient, sessionQuery.data, sessionQuery.error, sessionQuery.isLoading, userId],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used within SessionProvider.');
  return value;
}
