import { fn } from "storybook/test";
import type {
  KakaoPostcodeFailureReason,
  loadKakaoPostcodeScript as actualLoad,
  openKakaoPostcodeSearch as actualOpen,
} from "../kakao-postcode";

// Storybook-only implementation. No external script, popup or address query.
export class KakaoPostcodeLoadError extends Error {
  constructor(readonly reason: KakaoPostcodeFailureReason) {
    super("합성 주소 검색 오류");
    this.name = "KakaoPostcodeLoadError";
  }
}

type PostcodeConstructor = Awaited<ReturnType<typeof actualLoad>>;
const SyntheticPostcode: PostcodeConstructor = class {
  constructor(private readonly options: { oncomplete: (data: unknown) => void }) {}
  open() {
    this.options.oncomplete({
      address: "합성시 샘플로 1", roadAddress: "합성시 샘플로 1",
      zonecode: "00000", userSelectedType: "R",
    });
  }
};

export const loadKakaoPostcodeScript = fn<typeof actualLoad>(
  async () => SyntheticPostcode,
).mockName("loadKakaoPostcodeScript");
export const openKakaoPostcodeSearch = fn<typeof actualOpen>(async ({ onSelectAddress }) => {
  onSelectAddress({ baseAddress: "합성시 샘플로 1", postalCode: "00000" });
}).mockName("openKakaoPostcodeSearch");
