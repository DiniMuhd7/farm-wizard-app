const { default: axios } = require("axios");
const express = require("express");

const router = express.Router();
let countryCache = null;
let countryCacheAt = null;
let languageCache = null;
let languageCacheAt = null;

// Cache for 1000 hours
const CACHE_EXPIRATION = 1000 * 60 * 60 * 1000;

const fetchCountriesFromAPI = async () => {
  const res = await axios.get(
    "https://restcountries.com/v3.1/independent?status=true"
  );
  return res.data;
};

// Used by hooks/useCountryData.js — the sign-up screen's country picker.
router.get("/countries", async (req, res) => {
  try {
    if (countryCache && Date.now() - countryCacheAt < CACHE_EXPIRATION) {
      return res.json(countryCache);
    }

    const countries = await fetchCountriesFromAPI();

    const formattedCountries = countries
      .map((country) => ({
        label: country.name?.common || country.name,
        value: (country.cca2 || country.code)?.toLowerCase(),
        flag: country.flags?.png || "",
      }))
      .filter((c) => c.label && c.value)
      .sort((a, b) => a.label.localeCompare(b.label));

    countryCache = formattedCountries;
    countryCacheAt = Date.now();

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

// Used by hooks/useLanguageData.js — the sign-up screen's language picker.
router.get("/languages", async (req, res) => {
  try {
    if (languageCache && Date.now() - languageCacheAt < CACHE_EXPIRATION) {
      return res.json(languageCache);
    }

    const countries = await fetchCountriesFromAPI();
    const langSet = new Set();

    countries.forEach((country) => {
      const languages = country.languages;
      if (languages) {
        Object.values(languages).forEach((lang) => langSet.add(lang));
      }
    });

    extraAfricanLanguages.forEach((lang) => langSet.add(lang));

    const formattedLanguages = Array.from(langSet)
      .map((lang) => ({
        label: lang,
        value: lang.toLowerCase().replace(/\s+/g, "-"),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    languageCache = formattedLanguages;
    languageCacheAt = Date.now();

    res.json(formattedLanguages);
  } catch (error) {
    console.error("Error fetching language data:", error);
    res.status(500).json({ message: "Failed to fetch languages" });
  }
});

module.exports = router;
