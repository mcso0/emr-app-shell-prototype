import { expect, test } from "@playwright/test";

import {
  parseHospitalContactUpdateInput,
  parseHospitalProfileChangeRequestInput,
} from "@/features/hospital-admin/settings/hospital-profile-model";

test("hospital contact parser accepts only the documented shape and normalizes optional values", () => {
  const parsed = parseHospitalContactUpdateInput({
    revision: 3,
    contact: {
      phone: " 02-6203-7582 ",
      fax: " ",
      homepage: " https://example.com ",
      instagram: " @clair ",
      customerGuideMemo: " 주차 안내 ",
    },
  });

  expect(parsed).toEqual({
    ok: true,
    value: {
      revision: 3,
      contact: {
        phone: "02-6203-7582",
        fax: "",
        homepage: "https://example.com",
        instagram: "@clair",
        customerGuideMemo: "주차 안내",
      },
    },
  });

  expect(
    parseHospitalContactUpdateInput({
      revision: 3,
      workspaceId: "other-workspace",
      contact: { phone: "02-1", fax: "", homepage: "", instagram: "", customerGuideMemo: "" },
    })
  ).toMatchObject({ ok: false, fieldErrors: { root: "unknown_field" } });
});

test("hospital contact parser enforces revision, required phone, URL protocol, and memo length", () => {
  expect(
    parseHospitalContactUpdateInput({
      revision: -1,
      contact: {
        phone: "",
        fax: "",
        homepage: "javascript:alert(1)",
        instagram: "",
        customerGuideMemo: "가".repeat(301),
      },
    })
  ).toEqual({
    ok: false,
    error: "invalid_input",
    fieldErrors: {
      revision: "invalid_revision",
      phone: "required",
      homepage: "invalid_url",
      customerGuideMemo: "too_long",
    },
  });
});

test("registered-information request parser accepts only approved fields and a bounded detail", () => {
  expect(
    parseHospitalProfileChangeRequestInput({
      fields: [" hospital_name ", "address", "hospital_name"],
      detail: " 병원명과 주소를 변경해 주세요. ",
    })
  ).toEqual({
    ok: true,
    value: {
      fields: ["hospital_name", "address"],
      detail: "병원명과 주소를 변경해 주세요.",
    },
  });

  expect(
    parseHospitalProfileChangeRequestInput({
      fields: ["status", "representative_name"],
      detail: "가".repeat(2001),
    })
  ).toEqual({
    ok: false,
    error: "invalid_input",
    fieldErrors: {
      fields: "invalid_field",
      detail: "too_long",
    },
  });
});
