import { afterEach, describe, expect, it, vi } from "vitest";
import { clearRefreshTokenCookie, setRefreshTokenCookie } from "../generateTokens.js";

const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
});

describe("refresh-token cookie attributes", () => {
  it("uses a Lax non-secure cookie for local development over HTTP", () => {
    process.env.NODE_ENV = "development";
    const res = { cookie: vi.fn() };

    setRefreshTokenCookie(res, "token");

    expect(res.cookie).toHaveBeenCalledWith("refreshToken", "token", {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  });

  it("uses SameSite=None with Secure for the cross-site production deployment", () => {
    process.env.NODE_ENV = "production";
    const res = { cookie: vi.fn() };

    setRefreshTokenCookie(res, "token");

    expect(res.cookie).toHaveBeenCalledWith("refreshToken", "token", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  });

  it("clears the cookie with the same production security attributes", () => {
    process.env.NODE_ENV = "production";
    const res = { clearCookie: vi.fn() };

    clearRefreshTokenCookie(res);

    expect(res.clearCookie).toHaveBeenCalledWith("refreshToken", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    });
  });
});
