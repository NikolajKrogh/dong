import { useCallback, useEffect, useState } from "react";

import { useGameStore } from "../store/store";
import type {
  ImportLegacyHistoryRpcRequest,
  ImportLegacyHistoryRpcResponse,
} from "../types/legacyHistoryImport";
import {
  buildLegacyHistoryClaimantOptions,
  buildLegacyHistoryImportRequest,
  type LegacyHistoryDerivedClaimantOption,
} from "../utils/legacyHistoryImport";
import {
  getLegacyHistoryImportRpcClient,
  getSupabaseClient,
  hasSupabasePublicConfig,
} from "../utils/supabaseClient";

export type LegacyHistoryImportPhase =
  | "checking"
  | "ready"
  | "importing"
  | "completed"
  | "failed";

export interface UseLegacyHistoryImportResult {
  claimantOptions: LegacyHistoryDerivedClaimantOption[];
  historySessionCount: number;
  hasLocalHistory: boolean;
  isConfigured: boolean;
  isAuthenticated: boolean;
  authChecked: boolean;
  isImporting: boolean;
  importPhase: LegacyHistoryImportPhase;
  canStartImport: boolean;
  canRetryImport: boolean;
  availabilityReason: string | null;
  importError: string | null;
  importResult: ImportLegacyHistoryRpcResponse | null;
  importHistory: (
    claimant: LegacyHistoryDerivedClaimantOption,
  ) => Promise<ImportLegacyHistoryRpcResponse | null>;
}

const MISSING_HISTORY_MESSAGE = "No local history saved on this device yet.";
const MISSING_CONFIG_MESSAGE =
  "Supabase import is not configured for this build.";
const MISSING_AUTH_MESSAGE = "Sign in to import this history.";

const validateLegacyHistoryImportRequest = (
  request: ImportLegacyHistoryRpcRequest,
) => {
  request.sessions.forEach((session) => {
    const playerIds = new Set(session.players.map((player) => player.id));

    if (
      session.guestParticipants.some(
        (participant) => participant.id === session.claimedLocalParticipantId,
      )
    ) {
      throw new Error(
        `Claimed participant ${session.claimedLocalParticipantId} cannot be sent as a guest snapshot for source session ${session.sourceLocalSessionId}.`,
      );
    }

    session.guestParticipants.forEach((participant) => {
      if (!playerIds.has(participant.id)) {
        throw new Error(
          `Guest participant ${participant.id} is missing from source session ${session.sourceLocalSessionId}.`,
        );
      }
    });
  });
};

const getLegacyHistoryImportPhase = ({
  authChecked,
  isImporting,
  hasCompletedImport,
  hasFailedImport,
}: {
  authChecked: boolean;
  isImporting: boolean;
  hasCompletedImport: boolean;
  hasFailedImport: boolean;
}): LegacyHistoryImportPhase => {
  if (authChecked === false) {
    return "checking";
  }

  if (isImporting) {
    return "importing";
  }

  if (hasCompletedImport) {
    return "completed";
  }

  if (hasFailedImport) {
    return "failed";
  }

  return "ready";
};

const getLegacyHistoryImportAvailabilityReason = ({
  hasLocalHistory,
  isConfigured,
  authChecked,
  isAuthenticated,
  importPhase,
}: {
  hasLocalHistory: boolean;
  isConfigured: boolean;
  authChecked: boolean;
  isAuthenticated: boolean;
  importPhase: LegacyHistoryImportPhase;
}): string | null => {
  if (hasLocalHistory === false) {
    return MISSING_HISTORY_MESSAGE;
  }

  if (isConfigured === false) {
    return MISSING_CONFIG_MESSAGE;
  }

  if (authChecked && isAuthenticated === false && importPhase !== "completed") {
    return MISSING_AUTH_MESSAGE;
  }

  return null;
};

export const useLegacyHistoryImport = (): UseLegacyHistoryImportResult => {
  const history = useGameStore((state) => state.history);
  const claimantOptions = buildLegacyHistoryClaimantOptions(history);
  const historySessionCount = history.length;
  const hasLocalHistory = historySessionCount > 0;
  const isConfigured = hasSupabasePublicConfig();

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] =
    useState<ImportLegacyHistoryRpcResponse | null>(null);

  const hasCompletedImport = importResult?.importState === "completed";
  const hasFailedImport =
    importResult?.importState === "failed" || Boolean(importError);

  const importPhase = getLegacyHistoryImportPhase({
    authChecked,
    isImporting,
    hasCompletedImport,
    hasFailedImport,
  });

  const canStartImport =
    hasLocalHistory &&
    isConfigured &&
    authChecked &&
    isAuthenticated &&
    claimantOptions.length > 0 &&
    isImporting === false &&
    importPhase !== "completed";

  const canRetryImport = canStartImport && importPhase === "failed";

  const refreshAuthenticationState = useCallback(async () => {
    if (!isConfigured) {
      setIsAuthenticated(false);
      setAuthChecked(true);
      return null;
    }

    try {
      const { data, error } = await getSupabaseClient().auth.getUser();

      if (error || !data.user) {
        setIsAuthenticated(false);
        setAuthChecked(true);
        return null;
      }

      setIsAuthenticated(true);
      setAuthChecked(true);
      return data.user.id;
    } catch {
      setIsAuthenticated(false);
      setAuthChecked(true);
      return null;
    }
  }, [isConfigured]);

  useEffect(() => {
    let isMounted = true;

    const checkAuthenticationState = async () => {
      const userId = await refreshAuthenticationState();

      if (!isMounted && userId) {
        setIsAuthenticated(false);
      }
    };

    void checkAuthenticationState();

    return () => {
      isMounted = false;
    };
  }, [refreshAuthenticationState]);

  const importHistory = async (
    claimant: LegacyHistoryDerivedClaimantOption,
  ) => {
    if (importPhase === "completed" && importResult) {
      return importResult;
    }

    if (!hasLocalHistory) {
      setImportError(MISSING_HISTORY_MESSAGE);
      return null;
    }

    if (!isConfigured) {
      setImportError(MISSING_CONFIG_MESSAGE);
      return null;
    }

    const userId = await refreshAuthenticationState();

    if (!userId) {
      setImportError(MISSING_AUTH_MESSAGE);
      return null;
    }

    setIsImporting(true);
    setImportError(null);
    if (importPhase !== "completed") {
      setImportResult(null);
    }

    try {
      const request = buildLegacyHistoryImportRequest({
        sessions: history,
        claimant,
      });

      validateLegacyHistoryImportRequest(request);

      const response =
        await getLegacyHistoryImportRpcClient().importLegacyHistory(request);

      setImportResult(response);
      return response;
    } catch (error) {
      setImportError(
        error instanceof Error
          ? error.message
          : "Legacy history import failed.",
      );
      return null;
    } finally {
      setIsImporting(false);
    }
  };

  const availabilityReason = getLegacyHistoryImportAvailabilityReason({
    hasLocalHistory,
    isConfigured,
    authChecked,
    isAuthenticated,
    importPhase,
  });

  return {
    claimantOptions,
    historySessionCount,
    hasLocalHistory,
    isConfigured,
    isAuthenticated,
    authChecked,
    isImporting,
    importPhase,
    canStartImport,
    canRetryImport,
    availabilityReason,
    importError,
    importResult,
    importHistory,
  };
};
