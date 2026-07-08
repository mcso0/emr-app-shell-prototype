"use client";

import { useCallback, useEffect, useState } from "react";
import {
  KakaoPostcodeLoadError,
  loadKakaoPostcodeScript,
  openKakaoPostcodeSearch,
  type KakaoPostcodeSelectedAddress,
} from "@/lib/kakao-postcode";

const ADDRESS_SEARCH_ERROR_MESSAGE = "주소 검색을 불러오지 못했어요. 직접 입력해 주세요.";

type AddressSearchStatus = "error" | "idle" | "loading" | "ready";

export function useKakaoAddressSearch({
  enabled = true,
  onSelectAddress,
}: {
  readonly enabled?: boolean;
  readonly onSelectAddress: (address: KakaoPostcodeSelectedAddress) => void;
}) {
  const [errorMessage, setErrorMessage] = useState("");
  const [status, setStatus] = useState<AddressSearchStatus>("idle");

  const showSearchError = useCallback((error: unknown) => {
    if (error instanceof KakaoPostcodeLoadError || error instanceof Error) {
      setErrorMessage(ADDRESS_SEARCH_ERROR_MESSAGE);
      setStatus("error");
      return;
    }

    setErrorMessage(ADDRESS_SEARCH_ERROR_MESSAGE);
    setStatus("error");
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let active = true;

    void loadKakaoPostcodeScript()
      .then(() => {
        if (!active) return;
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (!active) return;
        showSearchError(error);
      });

    return () => {
      active = false;
    };
  }, [enabled, showSearchError]);

  const openAddressSearch = useCallback(() => {
    setErrorMessage("");
    setStatus("loading");
    void openKakaoPostcodeSearch({
      onSearchError: showSearchError,
      onSelectAddress: (address) => {
        onSelectAddress(address);
        setStatus("ready");
      },
    })
      .then(() => setStatus("ready"))
      .catch((error: unknown) => showSearchError(error));
  }, [onSelectAddress, showSearchError]);

  return {
    errorMessage,
    isLoading: status === "loading",
    openAddressSearch,
  };
}
