import { useMutation } from '@tanstack/react-query';
import type { UseMutationOptions, UseMutationResult } from '@tanstack/react-query';

export function usePost<
    TData = unknown,
    TVariables = void,
    TError = Error,
    TContext = unknown,
>(
    options: UseMutationOptions<TData, TError, TVariables, TContext>
): UseMutationResult<TData, TError, TVariables, TContext> {
    return useMutation(options);
}
