import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "@/store";
import { toggleTheme as toggleThemeAction } from "@/store/themeSlice";

export function useTheme() {
  const theme = useSelector((state: RootState) => state.theme.value);
  const dispatch = useDispatch<AppDispatch>();

  function toggleTheme() {
    dispatch(toggleThemeAction());
  }

  return { theme, toggleTheme };
}
