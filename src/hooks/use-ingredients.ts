import { useQueryClient } from "@tanstack/react-query";
import {
  useListIngredients as useGeneratedListIngredients,
  useCreateIngredient as useGeneratedCreateIngredient,
  useUpdateIngredient as useGeneratedUpdateIngredient,
  useDeleteIngredient as useGeneratedDeleteIngredient,
  getListIngredientsQueryKey,
} from "@workspace/api-client-react";

export function useIngredients() {
  return useGeneratedListIngredients();
}

export function useCreateIngredient() {
  const queryClient = useQueryClient();
  return useGeneratedCreateIngredient({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListIngredientsQueryKey() });
      },
    },
  });
}

export function useUpdateIngredient() {
  const queryClient = useQueryClient();
  return useGeneratedUpdateIngredient({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListIngredientsQueryKey() });
      },
    },
  });
}

export function useDeleteIngredient() {
  const queryClient = useQueryClient();
  return useGeneratedDeleteIngredient({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListIngredientsQueryKey() });
      },
    },
  });
}
