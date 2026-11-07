import React, { createContext, useCallback, useContext, useMemo, useReducer } from "react";
import type { AppNotification, User, WasteClassification } from "../types";

type State = { user: User | null; notifications: AppNotification[]; lastScan: WasteClassification | null; lastScanImage: string | null; demoMode: boolean };
type Action =
  | { type: "LOGIN"; user: User; demoMode: boolean }
  | { type: "LOGOUT" }
  | { type: "ADD_NOTIFICATION"; item: AppNotification }
  | { type: "SET_NOTIFICATIONS"; items: AppNotification[] }
  | { type: "SET_SCAN"; result: WasteClassification; imageUri: string | null }
  | { type: "MARK_READ"; id: string };
const initialState: State = { user: null, notifications: [], lastScan: null, lastScanImage: null, demoMode: false };
function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "LOGIN": return { ...state, user: action.user, demoMode: action.demoMode };
    case "LOGOUT": return { ...state, user: null, demoMode: false };
    case "ADD_NOTIFICATION": return { ...state, notifications: [action.item, ...state.notifications].slice(0, 50) };
    case "SET_NOTIFICATIONS": return { ...state, notifications: action.items };
    case "SET_SCAN": return { ...state, lastScan: action.result, lastScanImage: action.imageUri };
    case "MARK_READ": return { ...state, notifications: state.notifications.map((n) => n.id === action.id ? { ...n, read: true } : n) };
    default: return state;
  }
}
type ContextValue = State & {
  login: (user: User, demoMode?: boolean) => void; logout: () => void;
  addNotification: (item: AppNotification) => void; setNotifications: (items: AppNotification[]) => void;
  setLastScan: (result: WasteClassification, imageUri?: string | null) => void; markRead: (id: string) => void;
};
const AppContext = createContext<ContextValue | null>(null);
export function AppProvider({ children }: React.PropsWithChildren) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const login = useCallback((user: User, demoMode = false) => dispatch({ type: "LOGIN", user, demoMode }), []);
  const logout = useCallback(() => dispatch({ type: "LOGOUT" }), []);
  const addNotification = useCallback((item: AppNotification) => dispatch({ type: "ADD_NOTIFICATION", item }), []);
  const setNotifications = useCallback((items: AppNotification[]) => dispatch({ type: "SET_NOTIFICATIONS", items }), []);
  const setLastScan = useCallback((result: WasteClassification, imageUri: string | null = null) => dispatch({ type: "SET_SCAN", result, imageUri }), []);
  const markRead = useCallback((id: string) => dispatch({ type: "MARK_READ", id }), []);
  const value = useMemo(() => ({ ...state, login, logout, addNotification, setNotifications, setLastScan, markRead }), [state, login, logout, addNotification, setNotifications, setLastScan, markRead]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
export function useApp() { const value = useContext(AppContext); if (!value) throw new Error("useApp phải nằm trong AppProvider"); return value; }
