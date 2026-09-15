const { default: axios } = require("axios");
const express = require("express");

const router = express.Router();
let countryCache = null;
let lastFetchTime = null;

// Fetch countries data from the third-party API
const fetchCountriesFromAPI = async () => {
  const res = await axios.get(
    "https://restcountries.com/v3.1/independent?status=true"
  );
  return res.data;
};

// Cache for 1000 hours
const CACHE_EXPIRATION = 1000 * 60 * 60 * 1000;

router.get("/countries", async (req, res) => {
  try {
    // Check if the data is already cached and hasn't expired
    if (countryCache && Date.now() - lastFetchTime < CACHE_EXPIRATION) {
      return res.json(countryCache);
    }

    // Fetch data from external API
    const countries = await fetchCountriesFromAPI();

    // Process and format data
    const formattedCountries = countries
      .map((country) => ({
        label: country.name?.common || country.name,
        value: (country.cca2 || country.code)?.toLowerCase(),
        flag: country.flags?.png || "",
      }))
      .filter((c) => c.label && c.value)
      .sort((a, b) => a.label.localeCompare(b.label));

    // Cache the data
    countryCache = formattedCountries;
    lastFetchTime = Date.now();

    // Send the response to the client
    res.json(formattedCountries);
  } catch (error) {
    console.error("Error fetching country data:", error);
    res.status(500).json({ error: "Failed to fetch country data" });
  }
});

const extraAfricanLanguages = [
  "Hausa",
  "Igbo",
  "Yoruba",
  "Amharic",
  "Oromo",
  "Tigrinya",
  "Shona",
  "Zulu",
  "Xhosa",
  "Tswana",
  "Wolof",
  "Ewe",
  "Fula",
  "Berber",
  "Lingala",
  "Kinyarwanda",
  "Luganda",
];

let languageCache = null;

// Fetch language data from the restcountries API
const fetchLanguagesFromAPI = async () => {
  try {
    const res = await axios.get(
      "https://restcountries.com/v3.1/independent?status=true"
    );
    return res.data;
  } catch (error) {
    console.error("Error fetching country data:", error);
    throw new Error("Failed to fetch languages");
  }
};

router.get("/languages", async (req, res) => {
  try {
    // Check if the languages are cached and haven't expired
    if (languageCache && Date.now() - lastFetchTime < CACHE_EXPIRATION) {
      return res.json(languageCache);
    }

    // Fetch country data
    const countries = await fetchLanguagesFromAPI();
    const langSet = new Set();

    // Extract languages from countries data
    countries.forEach((country) => {
      const languages = country.languages;
      if (languages) {
        Object.values(languages).forEach((lang) => langSet.add(lang));
      }
    });

    // Add the missing African languages manually
    extraAfricanLanguages.forEach((lang) => langSet.add(lang));

    // Format the language data
    const formattedLanguages = Array.from(langSet)
      .map((lang) => ({
        label: lang,
        value: lang.toLowerCase().replace(/\s+/g, "-"),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    // Cache the language data
    languageCache = formattedLanguages;
    lastFetchTime = Date.now();

    // Send the response to the client
    res.json(formattedLanguages);
  } catch (error) {
    console.error("Error fetching language data:", error);
    res.status(500).json({ message: "Failed to fetch languages" });
  }
});

let exchangeCache = null;

const fetchExchangeRateFromAPI = async () => {
  try {
    const res = await axios.get("https://www.floatrates.com/daily/usd.json");
    return res.data;
  } catch (error) {
    console.error("Error fetching country data:", error);
    throw new Error("Failed to fetch languages");
  }
};

router.get("/exchange-rate", async (req, res) => {
  try {
    // Check if the languages are cached and haven't expired
    if (exchangeCache && Date.now() - lastFetchTime < CACHE_EXPIRATION) {
      return res.json(exchangeCache);
    }

    // Fetch country data
    const exchangesRates = await fetchExchangeRateFromAPI();

    // Cache the language data
    exchangeCache = exchangesRates;
    lastFetchTime = Date.now();

    // Send the response to the client
    res.json(exchangesRates);
  } catch (error) {
    console.error("Error fetching exchange data:", error);
    res.status(500).json({ message: "Failed to fetch exchange data" });
  }
});

module.exports = router;
