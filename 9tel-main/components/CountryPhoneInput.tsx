import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  Image,
} from "react-native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface Country {
  label: string;
  value: string;
  flag: string; // emoji or image URL
  callingCode: string;
}

interface Props {
  onChangePhone?: (fullNumber: string) => void;
  defaultCountryCode?: string;
}

const CountryPhoneInput: React.FC<Props> = ({
  onChangePhone,
  defaultCountryCode = "ng",
}) => {
  const [countries, setCountries] = useState<Country[]>([]);
  const [filteredCountries, setFilteredCountries] = useState<Country[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const cache = await AsyncStorage.getItem("cached_countries");
        if (cache) {
          const parsed = JSON.parse(cache);
          setCountries(parsed);
          setFilteredCountries(parsed);
          setSelectedCountry(
            parsed.find((c: Country) => c.value === defaultCountryCode) || null
          );
        } else {
          const res = await axios.get(
            "https://restcountries.com/v3.1/independent?status=true"
          );
          const formatted: Country[] = res.data
            .map((country: any) => ({
              label: country.name?.common || country.name,
              value: (country.cca2 || country.code)?.toLowerCase(),
              flag: country.flag || "",
              callingCode: country.idd?.root
                ? `${country.idd.root}${(country.idd.suffixes || [])[0] || ""}`
                : "",
            }))
            .filter((c: Country) => c.label && c.value && c.callingCode)
            .sort((a: Country, b: Country) => a.label.localeCompare(b.label));

          setCountries(formatted);
          setFilteredCountries(formatted);
          await AsyncStorage.setItem(
            "cached_countries",
            JSON.stringify(formatted)
          );
          setSelectedCountry(
            formatted.find((c) => c.value === defaultCountryCode) || null
          );
        }
      } catch (error) {
        console.error("Country fetch error:", error);
      }
    };

    fetchCountries();
  }, []);

  useEffect(() => {
    if (onChangePhone && selectedCountry) {
      onChangePhone(`${selectedCountry.callingCode}${phone}`);
    }
  }, [phone, selectedCountry]);

  const handleSearch = (text: string) => {
    setSearch(text);
    const filtered = countries.filter((country) =>
      country.label.toLowerCase().includes(text.toLowerCase())
    );
    setFilteredCountries(filtered);
  };

  return (
    <View className="py-6 gap-y-4 w-full">
      {/* Country Picker */}
      <TouchableOpacity
        onPress={() => setShowModal(true)}
        // className="w-full rounded-xl bg-white/10 backdrop-blur-md border border-white/20 px-4 py-4 flex-row justify-between items-center"
        className="w-full rounded-xl backdrop-blur-md border-2 border-dotted border-secondary px-4 py-4 flex-row justify-between items-center"
      >
        <View className="flex-row items-center gap-x-2">
          <Text className="text-xl">{selectedCountry?.flag}</Text>
          <Text className="text-white">
            {selectedCountry?.label || "Select Country"}
          </Text>
        </View>
        <Text className="text-white text-lg">⌄</Text>
      </TouchableOpacity>

      {/* Modal Picker */}
      <Modal visible={showModal} animationType="slide">
        <View className="flex-1 bg-white px-4 pt-8">
          <TextInput
            placeholder="Search countries..."
            value={search}
            onChangeText={handleSearch}
            className="border border-gray-300 rounded-lg px-4 py-2 mb-4"
          />
          <FlatList
            data={filteredCountries}
            keyExtractor={(item) => item.value}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => {
                  setSelectedCountry(item);
                  setShowModal(false);
                  setSearch("");
                }}
                className="py-3 border-b border-gray-200 flex-row items-center gap-x-4"
              >
                <Text className="text-lg">{item.flag}</Text>
                <Text className="text-base">
                  {item.label} (+{item.callingCode})
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>

      {/* Phone Input */}
      <View
        // className="w-full flex-row items-center px-4 py-4 rounded-xl bg-white/10 backdrop-blur-md border border-white/20"
        className="w-full flex-row items-center px-4 py-4 rounded-xl  backdrop-blur-md  border-2 border-dotted border-secondary my-6"
      >
        <Text className="text-white pr-2 text-base">
          {selectedCountry?.callingCode || "234"}
        </Text>
        <TextInput
          placeholder="Enter phone number"
          placeholderTextColor="#ffffff"
          keyboardType="phone-pad"
          className="text-white flex-1 my-1"
          value={phone}
          onChangeText={setPhone}
        />
      </View>
    </View>
  );
};

export default CountryPhoneInput;
