import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { validateApiKey } from "../api-auth";
import { NextRequest } from "next/server";

describe("validateApiKey", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns null (allows request) when no API_KEY is configured", () => {
    delete process.env.API_KEY;
    const req = new NextRequest("http://localhost/api/test", {
      headers: { authorization: "Bearer wrong" },
    });
    expect(validateApiKey(req)).toBeNull();
  });

  it("returns null when valid Bearer token matches API_KEY", () => {
    process.env.API_KEY = "test-secret-key";
    const req = new NextRequest("http://localhost/api/test", {
      headers: { authorization: "Bearer test-secret-key" },
    });
    expect(validateApiKey(req)).toBeNull();
  });

  it("returns 401 response when Bearer token is wrong", () => {
    process.env.API_KEY = "test-secret-key";
    const req = new NextRequest("http://localhost/api/test", {
      headers: { authorization: "Bearer wrong-key" },
    });
    const result = validateApiKey(req);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });

  it("returns 401 response when no authorization header is present", () => {
    process.env.API_KEY = "test-secret-key";
    const req = new NextRequest("http://localhost/api/test");
    const result = validateApiKey(req);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });
});
