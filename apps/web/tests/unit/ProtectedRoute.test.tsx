import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const useSessionMock = vi.hoisted(() => vi.fn());
vi.mock("../../src/hooks/useSession", () => ({ useSession: useSessionMock }));

const apiClientMock = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../../src/lib/apiClient", () => ({ apiClient: apiClientMock }));

const { ProtectedRoute } = await import("../../src/routes/ProtectedRoute");
const { useProfile } = await import("../../src/lib/ProfileContext");

function renderAt(path: string) {
  function ProfileProbe() {
    const profile = useProfile();
    return <div>Protected content (role: {profile?.role ?? "none"})</div>;
  }

  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <ProfileProbe />
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<div>Login page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute", () => {
  it("shows a loading state while the session is still being determined", () => {
    useSessionMock.mockReturnValue({ session: null, loading: true });
    renderAt("/");
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
    expect(apiClientMock.get).not.toHaveBeenCalled();
  });

  it("redirects to /login when there is no session", async () => {
    useSessionMock.mockReturnValue({ session: null, loading: false });
    renderAt("/");
    await waitFor(() => expect(screen.getByText("Login page")).toBeInTheDocument());
  });

  it("renders children and exposes the fetched profile via context once authenticated", async () => {
    useSessionMock.mockReturnValue({ session: { access_token: "t" }, loading: false });
    apiClientMock.get.mockResolvedValue({ profile: { id: "u1", email: "a@b.com", role: "admin", createdAt: "now" } });

    renderAt("/");

    await waitFor(() => expect(screen.getByText("Protected content (role: admin)")).toBeInTheDocument());
    expect(apiClientMock.get).toHaveBeenCalledWith("/me");
  });

  it("still renders children if the profile fetch fails (doesn't hard-block on a transient failure)", async () => {
    useSessionMock.mockReturnValue({ session: { access_token: "t" }, loading: false });
    apiClientMock.get.mockRejectedValue(new Error("network error"));

    renderAt("/");

    await waitFor(() => expect(screen.getByText("Protected content (role: none)")).toBeInTheDocument());
  });
});
