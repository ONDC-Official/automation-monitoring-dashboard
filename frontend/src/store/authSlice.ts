import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

interface AuthState {
  isAuthenticated: boolean;
  username: string | null;
  // Bearer token issued by the backend on login; sent on every /api request.
  token: string | null;
}

const authSlice = createSlice({
  name: "auth",
  initialState: {
    isAuthenticated: false,
    username: null,
    token: null,
  } as AuthState,
  reducers: {
    login(state, action: PayloadAction<{ username: string; token: string }>) {
      state.isAuthenticated = true;
      state.username = action.payload.username;
      state.token = action.payload.token;
    },
    logout(state) {
      state.isAuthenticated = false;
      state.username = null;
      state.token = null;
    },
  },
});

export const { login, logout } = authSlice.actions;
export default authSlice.reducer;
