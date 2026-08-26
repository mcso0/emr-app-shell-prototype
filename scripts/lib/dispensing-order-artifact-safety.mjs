export function normalizeOfficialVmdSourceUrl(value) {
  let url;
  try {
    url = new URL(String(value ?? ""));
  } catch {
    throw new Error("unsupported_official_vmd_source_url");
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== "www.vmd.defra.gov.uk" ||
    (url.port !== "" && url.port !== "443") ||
    url.username !== "" ||
    url.password !== "" ||
    !/^\/productinformationdatabase\/files\/SPC_Documents\/SPC_\d+\.PDF$/.test(
      url.pathname,
    ) ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw new Error("unsupported_official_vmd_source_url");
  }
  return url.href;
}

export function spreadsheetSafeCsvCell(value) {
  const raw = Array.isArray(value) ? value.join(";") : String(value ?? "");
  const text = /^\s*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${text.replaceAll('"', '""')}"`;
}

export function isDisallowedNetworkAddress(address) {
  const normalized = String(address ?? "").trim().toLowerCase();
  if (!normalized) return true;

  if (normalized.includes(":")) {
    if (
      normalized === "::" ||
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe8") ||
      normalized.startsWith("fe9") ||
      normalized.startsWith("fea") ||
      normalized.startsWith("feb")
    ) {
      return true;
    }
    if (normalized.startsWith("::ffff:")) {
      return isDisallowedNetworkAddress(normalized.slice(7));
    }
    return false;
  }

  const octets = normalized.split(".").map(Number);
  if (
    octets.length !== 4 ||
    octets.some(
      (octet, index) =>
        !Number.isInteger(octet) ||
        octet < 0 ||
        octet > 255 ||
        String(octet) !== normalized.split(".")[index],
    )
  ) {
    return true;
  }

  const [first, second] = octets;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 0) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    first >= 224
  );
}
