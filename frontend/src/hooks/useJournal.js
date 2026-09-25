import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { setSessionUser } from '../lib/privateQueries'
export function journalError(error) {
  const detail = error?.response?.data?.detail;
  return typeof detail === "string"
    ? detail
    : Array.isArray(detail)
      ? detail.map((x) => x.msg).join(". ")
      : "Unable to save. Please try again.";
}
export function useJournalQuery(user, resource) {
  const cache = useQueryClient()
  return useQuery({
    queryKey: ["journal", user?.id, resource],
    meta: { private: true },
    enabled: !!user,
    queryFn: async ({ signal }) => {
      try { return (await axios.get(`/api/account/${resource}`, { signal })).data }
      catch (error) {
        if (error.response?.status === 401 && !signal.aborted) setSessionUser(cache, null)
        throw error
      }
    },
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
