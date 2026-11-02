import { describe, it, expect } from "vitest";
import { sha256, hashPrefix } from "../../src/utils/hash.js";

describe("sha256", () => {
  it("hashes an empty buffer", () => {
    const result = sha256(Buffer.from(""));
    expect(result).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("hashes a known string", () => {
    const result = sha256(Buffer.from("hello"));
    expect(result).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });

  it("hashes binary data", () => {
    const buf = Buffer.from([0x00, 0xff, 0x80, 0x01]);
    const result = sha256(buf);
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[a-f0-9]{64}$/);
  });

  it("accepts Uint8Array", () => {
    const arr = new Uint8Array([104, 101, 108, 108, 111]); // "hello"
    const result = sha256(arr);
    expect(result).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });
});

describe("hashPrefix", () => {
  it("returns first 8 chars by default", () => {
    const hash = "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";
    expect(hashPrefix(hash)).toBe("2cf24dba");
  });

  it("returns custom length", () => {
    const hash = "2cf24dba5fb0a30e";
    expect(hashPrefix(hash, 4)).toBe("2cf2");
  });

  it("returns full hash if length exceeds", () => {
    expect(hashPrefix("abc", 8)).toBe("abc");
  });
});
