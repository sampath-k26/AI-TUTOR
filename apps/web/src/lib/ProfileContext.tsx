import { createContext, useContext } from "react";
import type { Profile } from "./types";

export const ProfileContext = createContext<Profile | null>(null);

export function useProfile(): Profile | null {
  return useContext(ProfileContext);
}
