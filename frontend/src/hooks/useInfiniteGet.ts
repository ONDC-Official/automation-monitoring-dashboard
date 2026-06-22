import { useInfiniteQuery } from '@tanstack/react-query';
import type {
    UseInfiniteQueryOptions,
    UseInfiniteQueryResult,
    InfiniteData,
    QueryKey,
} from '@tanstack/react-query';

export function useInfiniteGet<
    TQueryFnData,
    TError = Error,
    TData = InfiniteData<TQueryFnData>,
    TQueryKey extends QueryKey = QueryKey,
    TPageParam = unknown,
>(
    options: UseInfiniteQueryOptions<TQueryFnData, TError, TData, TQueryKey, TPageParam>
): UseInfiniteQueryResult<TData, TError> {
    return useInfiniteQuery(options);
}
