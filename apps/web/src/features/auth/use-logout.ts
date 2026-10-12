import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useNavigate } from "react-router";
import { logout } from "./auth-api";

/** Log out, drop all cached data (it belongs to the old user), and go to the login page. */
export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useCallback(async () => {
    await logout();
    queryClient.clear();
    await navigate("/login", { replace: true });
  }, [queryClient, navigate]);
}
