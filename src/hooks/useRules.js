import { createContext, useContext } from "react";

/** Édition des règles de la campagne ouverte : « 2024 » (par défaut) ou « 2014 » */
export const RulesContext = createContext("2024");
export const useRules = () => useContext(RulesContext);
