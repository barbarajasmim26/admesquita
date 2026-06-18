export function useServerFn<TInput, TOutput>(fn: (input: TInput) => Promise<TOutput>) {
  return async (args: { data: TInput } = { data: undefined as any }) => {
    return fn(args.data);
  };
}
