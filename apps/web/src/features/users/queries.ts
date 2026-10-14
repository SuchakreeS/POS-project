import type {
  ManagedUser,
  PasswordResetInput,
  UserCreateInput,
  UserList,
  UserUpdateInput,
} from "@pos/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/auth-store";
import { api } from "@/lib/api";

export const userKeys = { all: ["users"] as const };

export function useUsers() {
  return useQuery({
    queryKey: userKeys.all,
    queryFn: ({ signal }) => api.get<UserList>("/users", { signal }).then((list) => list.items),
  });
}

/** After a change: refresh the list, and the sidebar name if admins edited themselves. */
function useUserChanged() {
  const queryClient = useQueryClient();
  return (user: ManagedUser) => {
    useAuthStore.getState().updateUser({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    });
    return queryClient.invalidateQueries({ queryKey: userKeys.all });
  };
}

export function useAddUser() {
  const changed = useUserChanged();
  return useMutation({
    mutationFn: (input: UserCreateInput) => api.post<ManagedUser>("/users", input),
    onSuccess: changed,
  });
}

export function useEditUser(id: string) {
  const changed = useUserChanged();
  return useMutation({
    mutationFn: (input: UserUpdateInput) => api.patch<ManagedUser>(`/users/${id}`, input),
    onSuccess: changed,
  });
}

export function useSetUserActive() {
  const changed = useUserChanged();
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.post<ManagedUser>(`/users/${id}/${active ? "reactivate" : "deactivate"}`),
    onSuccess: changed,
  });
}

export function useResetPassword(id: string) {
  return useMutation({
    mutationFn: (input: PasswordResetInput) =>
      api.post<ManagedUser>(`/users/${id}/reset-password`, input),
  });
}
