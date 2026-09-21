import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
export function journalError(error) {
  const detail = error?.response?.data?.detail;
  return typeof detail === "string"
    ? detail
    : Array.isArray(detail)
      ? detail.map((x) => x.msg).join(". ")
      : "Unable to save. Please try again.";
}
export function useJournalQuery(user, resource) {
  return useQuery({
    queryKey: ["journal", user?.id, resource],
    enabled: !!user,
    queryFn: async () => (await axios.get(`/api/account/${resource}`)).data,
  });
}
export function useJournalMutation(user) {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: async ({ path, method = "post", data }) =>
      (await axios({ url: `/api/account/${path}`, method, data })).data,
    onSuccess: () =>
      cache.invalidateQueries({ queryKey: ["journal", user?.id] }),
  });
}
