import { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE } from "@/config/client";
import { localLanguages } from "@/constants/fallbackData";

export const useLanguageData = () => {
  // Start with the bundled list so the screen renders instantly;
  // the server list (when reachable) replaces it in the background.
  const [languages, setLanguages] = useState(localLanguages);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchLanguages = async () => {
      try {
        const res = await axios.get(
          `${API_BASE}/api/v1/external-apis/languages`,
          { timeout: 8000 }
        );
        if (Array.isArray(res.data) && res.data.length > 0) {
          setLanguages(res.data);
        }
      } catch (error) {
        console.warn("Languages API unreachable, keeping local list.");
      }
    };

    fetchLanguages();
  }, []);

  return { languages, loading };
};
