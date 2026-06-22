import { useQuery } from '@tanstack/react-query';
import type { UseQueryOptions, UseQueryResult, QueryKey } from '@tanstack/react-query';

export function useGet<
    TQueryFnData = unknown,
    TError = Error,
    TData = TQueryFnData,
    TQueryKey extends QueryKey = QueryKey,
>(
    options: UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>
): UseQueryResult<TData, TError> {
    return useQuery(options);
}
