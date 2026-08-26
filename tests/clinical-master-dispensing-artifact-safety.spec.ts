import { expect, test } from "@playwright/test";

import {
  isDisallowedNetworkAddress,
  normalizeOfficialVmdSourceUrl,
  spreadsheetSafeCsvCell,
} from "../scripts/lib/dispensing-order-artifact-safety.mjs";

const validSource =
  "https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_125687.PDF";

test("dispensing artifact source URLs fail closed outside the exact official VMD SPC path", () => {
  expect(normalizeOfficialVmdSourceUrl(validSource)).toBe(validSource);

  for (const unsafe of [
    "http://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_1.PDF",
    "https://user@www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_1.PDF",
    "https://www.vmd.defra.gov.uk:444/productinformationdatabase/files/SPC_Documents/SPC_1.PDF",
    "https://vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_1.PDF",
    "https://www.vmd.defra.gov.uk.evil.example/productinformationdatabase/files/SPC_Documents/SPC_1.PDF",
    "https://www.vmd.defra.gov.uk/redirect?to=https://127.0.0.1/",
    "javascript:alert(1)",
    "data:text/html,unsafe",
    "file:///etc/passwd",
    "//www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_1.PDF",
  ]) {
    expect(() => normalizeOfficialVmdSourceUrl(unsafe), unsafe).toThrow(
      "unsupported_official_vmd_source_url",
    );
  }
});

test("dispensing source reachability rejects local and private address classes", () => {
  for (const address of [
    "127.0.0.1",
    "10.1.2.3",
    "100.64.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.168.1.1",
    "224.0.0.1",
    "::1",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
  ]) {
    expect(isDisallowedNetworkAddress(address), address).toBe(true);
  }
  expect(isDisallowedNetworkAddress("8.8.8.8")).toBe(false);
  expect(isDisallowedNetworkAddress("2606:4700:4700::1111")).toBe(false);
});

test("both dispensing CSV sinks encode spreadsheet formulas as literal text", () => {
  for (const formula of ["=1+1", "+cmd", "-2+3", "@SUM(A1:A2)", "  =HYPERLINK(\"x\")"]) {
    expect(spreadsheetSafeCsvCell(formula)).toBe(
      `"'${formula.replaceAll('"', '""')}"`,
    );
  }
  expect(spreadsheetSafeCsvCell('정상, "텍스트"')).toBe(
    '"정상, ""텍스트"""',
  );
});
