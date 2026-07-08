const KAKAO_POSTCODE_SCRIPT_ID = "kakao-postcode-script";
const KAKAO_POSTCODE_SCRIPT_SRC =
  "https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";

export type KakaoPostcodeSelectedAddress = {
  readonly baseAddress: string;
  readonly postalCode: string;
};

type KakaoPostcodeData = {
  readonly address: string;
  readonly autoJibunAddress: string;
  readonly autoRoadAddress: string;
  readonly jibunAddress: string;
  readonly roadAddress: string;
  readonly userSelectedType: string;
  readonly zonecode: string;
};

type KakaoPostcodeOptions = {
  readonly oncomplete: (data: unknown) => void;
};

type KakaoPostcodeInstance = {
  readonly open: () => void;
};

type KakaoPostcodeConstructor = new (
  options: KakaoPostcodeOptions
) => KakaoPostcodeInstance;

type KakaoNamespace = {
  readonly Postcode?: KakaoPostcodeConstructor;
};

export type KakaoPostcodeFailureReason =
  | "browser_unavailable"
  | "constructor_missing"
  | "invalid_result"
  | "load_failed";

export class KakaoPostcodeLoadError extends Error {
  readonly reason: KakaoPostcodeFailureReason;

  constructor(reason: KakaoPostcodeFailureReason) {
    super(getKakaoPostcodeErrorMessage(reason));
    this.name = "KakaoPostcodeLoadError";
    this.reason = reason;
  }
}

declare global {
  interface Window {
    readonly kakao?: KakaoNamespace;
  }
}

let kakaoPostcodeScriptPromise: Promise<KakaoPostcodeConstructor> | undefined;

export function loadKakaoPostcodeScript(): Promise<KakaoPostcodeConstructor> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.reject(new KakaoPostcodeLoadError("browser_unavailable"));
  }

  const loadedConstructor = window.kakao?.Postcode;
  if (loadedConstructor) return Promise.resolve(loadedConstructor);
  if (kakaoPostcodeScriptPromise) return kakaoPostcodeScriptPromise;

  kakaoPostcodeScriptPromise = new Promise((resolve, reject) => {
    const resolveWhenReady = () => {
      const readyConstructor = window.kakao?.Postcode;
      if (readyConstructor) {
        resolve(readyConstructor);
        return;
      }

      kakaoPostcodeScriptPromise = undefined;
      reject(new KakaoPostcodeLoadError("constructor_missing"));
    };
    const rejectLoad = () => {
      kakaoPostcodeScriptPromise = undefined;
      reject(new KakaoPostcodeLoadError("load_failed"));
    };

    const existingScript = document.getElementById(KAKAO_POSTCODE_SCRIPT_ID);
    if (existingScript instanceof HTMLScriptElement) {
      existingScript.addEventListener("load", resolveWhenReady, { once: true });
      existingScript.addEventListener("error", rejectLoad, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = KAKAO_POSTCODE_SCRIPT_ID;
    script.src = KAKAO_POSTCODE_SCRIPT_SRC;
    script.async = true;
    script.addEventListener("load", resolveWhenReady, { once: true });
    script.addEventListener("error", rejectLoad, { once: true });
    document.head.append(script);
  });

  return kakaoPostcodeScriptPromise;
}

export async function openKakaoPostcodeSearch({
  onSelectAddress,
  onSearchError,
}: {
  readonly onSearchError: (error: KakaoPostcodeLoadError) => void;
  readonly onSelectAddress: (address: KakaoPostcodeSelectedAddress) => void;
}) {
  const Postcode = await loadKakaoPostcodeScript();
  const postcode = new Postcode({
    oncomplete: (data) => {
      const result = parseKakaoPostcodeData(data);
      if (!result) {
        onSearchError(new KakaoPostcodeLoadError("invalid_result"));
        return;
      }

      onSelectAddress(selectKoreanAddress(result));
    },
  });

  postcode.open();
}

function parseKakaoPostcodeData(data: unknown): KakaoPostcodeData | undefined {
  if (!isRecord(data)) return undefined;

  return {
    address: getStringField(data, "address"),
    autoJibunAddress: getStringField(data, "autoJibunAddress"),
    autoRoadAddress: getStringField(data, "autoRoadAddress"),
    jibunAddress: getStringField(data, "jibunAddress"),
    roadAddress: getStringField(data, "roadAddress"),
    userSelectedType: getStringField(data, "userSelectedType"),
    zonecode: getStringField(data, "zonecode"),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getStringField(data: Record<string, unknown>, field: keyof KakaoPostcodeData) {
  const value = data[field];
  return typeof value === "string" ? value : "";
}

function selectKoreanAddress(data: KakaoPostcodeData): KakaoPostcodeSelectedAddress {
  const selectedAddress =
    data.userSelectedType === "R" ? data.roadAddress : data.jibunAddress;

  return {
    baseAddress:
      selectedAddress ||
      data.roadAddress ||
      data.autoRoadAddress ||
      data.address ||
      data.jibunAddress ||
      data.autoJibunAddress,
    postalCode: data.zonecode,
  };
}

function getKakaoPostcodeErrorMessage(reason: KakaoPostcodeFailureReason) {
  if (reason === "browser_unavailable") return "주소 검색은 브라우저에서만 사용할 수 있습니다.";
  if (reason === "constructor_missing") return "주소 검색 스크립트를 초기화하지 못했습니다.";
  if (reason === "invalid_result") return "주소 검색 결과를 읽지 못했습니다.";
  return "주소 검색 스크립트를 불러오지 못했습니다.";
}
