import { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE } from "@/config/client";
import { localCountries } from "@/constants/fallbackData";

export const useCountryData = () => {
  // Start with the bundled list so the screen renders instantly;
  // the server list (when reachable) replaces it in the background.
  const [countries, setCountries] = useState(localCountries);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const res = await axios.get(
          `${API_BASE}/api/v1/external-apis/countries`,
          { timeout: 8000 }
        );
        if (Array.isArray(res.data) && res.data.length > 0) {
          setCountries(res.data);
        }
      } catch (err) {
        console.warn("Countries API unreachable, keeping local list.");
      }
    };

    fetchCountries();
  }, []);

  return { countries, loading };
};
