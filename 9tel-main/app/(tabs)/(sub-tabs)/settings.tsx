import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ban, CheckCircle2, Info, ChevronLeft, ChevronRight, Globe2, Landmark, Moon, Phone, PhoneCall, PhoneForwarded, Search, ShieldCheck, Smartphone, Volume2, X } from "lucide-react-native";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { getMyNumber } from "@/services/numbers";
import { getCallerIdVerificationStatus, type CallerIdStatus } from "@/services/callerid";
import { checkNumberAvailability, createFlutterwaveCheckout, getAvailableNumberCountries, getOrderStatus, getPaymentPrices, toPaymentInitError, type PaymentCurrency, type PaymentPrices } from "@/services/payments";
import CurrencySelector from "@/components/CurrencySelector";
import { useLoginContext } from "@/context/LoginProvider";
import { useCountryData } from "@/hooks/useCountryData";
import { TAB_BAR_CLEARANCE } from "@/constants/layout";
import { themedStyles, themeColor, useTheme } from "@/theme";
import { useTranslation } from "react-i18next";
import { languageLabel } from "@/utils/language";
import Constants from "expo-constants";
import { tr } from "@/utils/tr";

type FlowStep = "country" | "preview" | "processing";

export default function Settings() {
  const { preference } = useTheme();
  const { t, i18n } = useTranslation();
  const appearanceLabel = preference === "system" ? t("prefs.appearance.system", "System default") : preference === "dark" ? t("prefs.appearance.dark", "Dark") : t("prefs.appearance.light", "Light");
  const { user } = useLoginContext();
  const [wifi, setWifi] = useState(true);
  const [alerts, setAlerts] = useState(true);

  const [myNumber, setMyNumber] = useState<string | null>(null);
  const [loadingNumber, setLoadingNumber] = useState(true);

  const [callerId, setCallerId] = useState<string | null>(null);
  const [callerIdStatus, setCallerIdStatus] = useState<CallerIdStatus>("unverified");
  const [callerIdMethod, setCallerIdMethod] = useState<string | undefined>();
  const [loadingCallerId, setLoadingCallerId] = useState(true);

  const { countries } = useCountryData();
  const [availableCountries, setAvailableCountries] = useState<{ label: string; value: string }[]>([]);
  const [loadingAvailableCountries, setLoadingAvailableCountries] = useState(false);
  const [availableCountriesError, setAvailableCountriesError] = useState("");
  const [countryRefreshKey, setCountryRefreshKey] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState<FlowStep>("country");
  const [countrySearch, setCountrySearch] = useState("");
  const [preferredCountryCode, setPreferredCountryCode] = useState("us");
  // "US" until the ipapi lookup below resolves (or fails, in which case it
  // just stays US) — previously this was never anything BUT "US", for
  // every user regardless of where they actually are.
  const [selectedCountry, setSelectedCountry] = useState<{ label: string; value: string }>({ label: "United States", value: "us" });
  const selectedCountryRef = useRef(selectedCountry.value);

  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");
  const [previewNumber, setPreviewNumber] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [currency, setCurrency] = useState<PaymentCurrency>("USD");
  const [paymentPrices, setPaymentPrices] = useState<PaymentPrices | null>(null);
  const [processingMessage, setProcessingMessage] = useState(tr("Processing your payment…"));
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    getMyNumber()
      .then(setMyNumber)
      .catch(() => setMyNumber(null))
      .finally(() => setLoadingNumber(false));
    getCallerIdVerificationStatus()
      .then((status) => {
        setCallerId(status.verifiedCallerId || (status.method === "developer_test" ? status.phoneNumber || null : null));
        setCallerIdStatus(status.callerIdStatus);
        setCallerIdMethod(status.method);
      })
      .catch(() => {
        setCallerId(null);
        setCallerIdStatus("unverified");
      })
      .finally(() => setLoadingCallerId(false));

    // Best-effort: pre-select the country 9tel already detects for the
    // dialer's own calling-code display, so the picker below opens on
    // something relevant instead of always defaulting to the US. The
    // person can still change it before confirming.
    fetch("https://ipapi.co/json/")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((location) => {
        if (location.country_code && location.country_name) {
          setPreferredCountryCode(String(location.country_code).toLowerCase());
        }
      })
      .catch(() => undefined);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return availableCountries;
    const q = countrySearch.trim().toLowerCase();
    return availableCountries.filter((c) => c.label.toLowerCase().includes(q));
  }, [availableCountries, countrySearch]);

  useEffect(() => {
    selectedCountryRef.current = selectedCountry.value;
  }, [selectedCountry.value]);

  useEffect(() => {
    if (!modalOpen || !countries.length) return;
    let cancelled = false;
    setLoadingAvailableCountries(true);
    setAvailableCountriesError("");
    getAvailableNumberCountries(countries)
      .then((countryCodes) => {
        if (cancelled) return;
        const available = countries.filter((country: { label: string; value: string }) =>
          countryCodes.includes(country.value.toUpperCase()),
        );
        setAvailableCountries(available);
        if (
          available.length &&
          !available.some((country) => country.value.toLowerCase() === selectedCountryRef.current.toLowerCase())
        ) {
          setSelectedCountry(
            available.find((country) => country.value.toLowerCase() === preferredCountryCode) || available[0],
          );
        }
      })
      .catch((error) => {
        if (!cancelled) setAvailableCountriesError((error as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoadingAvailableCountries(false);
      });
    return () => {
      cancelled = true;
    };
  }, [modalOpen, countries, countryRefreshKey, preferredCountryCode]);

  const closeModal = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setModalOpen(false);
    setStep("country");
    setPreviewNumber(null);
    setAvailabilityError("");
    setPaying(false);
  };

  // Checking availability is free — nothing is purchased here. This used to
  // go straight from picking a country to an "are you sure, this may
  // charge you" alert with no idea what number you'd even be paying for.
  const checkAvailability = async () => {
    setCheckingAvailability(true);
    setAvailabilityError("");
    try {
      const result = await checkNumberAvailability(selectedCountry.value.toUpperCase());
      if (result.alreadyProvisioned) {
        setMyNumber(result.phoneNumber);
        closeModal();
        return;
      }
      if (!result.available) {
        setAvailabilityError(result.message);
        const remainingCountries = availableCountries.filter(
          (country) => country.value.toUpperCase() !== selectedCountry.value.toUpperCase(),
        );
        setAvailableCountries(remainingCountries);
        if (remainingCountries.length) setSelectedCountry(remainingCountries[0]);
        return;
      }
      setPreviewNumber(result.phoneNumber);
      setStep("preview");
      getPaymentPrices().then(setPaymentPrices).catch(() => undefined);
    } catch (error) {
      setAvailabilityError((error as Error).message);
    } finally {
      setCheckingAvailability(false);
    }
  };

  const pollForFulfillment = (orderId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    const deadline = Date.now() + 5 * 60 * 1000; // give a payment page plenty of time without polling forever
    pollRef.current = setInterval(async () => {
      if (Date.now() > deadline) {
        clearInterval(pollRef.current!);
        setProcessingMessage(tr("Still waiting on your payment. You can close this and check Settings again shortly."));
        return;
      }
      try {
        const order = await getOrderStatus(orderId);
        if (order.status === "paid" && order.phoneNumber) {
          clearInterval(pollRef.current!);
          setMyNumber(order.phoneNumber);
          closeModal();
          Alert.alert(tr("You're all set"), tr("{{number}} is now your 9tel number.", { number: order.phoneNumber }));
        } else if (order.status === "cancelled") {
          clearInterval(pollRef.current!);
          setProcessingMessage("");
          Alert.alert(tr("Payment cancelled"), tr("Nothing was charged. You can try again anytime."));
          setStep("preview");
        } else if (order.status === "failed") {
          clearInterval(pollRef.current!);
          setProcessingMessage("");
          Alert.alert(tr("Payment didn't go through"), tr("Nothing was charged. You can try again."));
          setStep("preview");
        } else if (order.status === "paid_unfulfilled") {
          // Payment succeeded, but assigning the actual number then failed
          // (e.g. that country ran out of numbers in the few seconds
          // between checkout and fulfillment) — a refund has automatically
          // been requested. Keep polling briefly: "refunded" confirms it
          // actually completed, rather than just having been attempted.
          setProcessingMessage(tr("We couldn't assign a number — refunding your payment now…"));
        } else if (order.status === "refunded") {
          clearInterval(pollRef.current!);
          setProcessingMessage("");
          Alert.alert(
            tr("Payment refunded"),
            tr("We couldn't assign a number for that country, so your payment was refunded. Please try again — a different country may have availability.")
          );
          setStep("country");
        }
      } catch {
        // transient — keep polling until the deadline
      }
    }, 3000);
  };

  const displayedNumberPrice = paymentPrices?.ngn.number != null
    ? `₦${paymentPrices.ngn.number.toLocaleString("en-US")}`
    : tr("Loading current price…");
  const ngnNumberPriceReady = currency !== "NGN" || paymentPrices?.ngn.number != null;

  const payWithFlutterwave = async () => {
    if (!ngnNumberPriceReady) return;
    setPaying(true);
    try {
      const { orderId, url } = await createFlutterwaveCheckout(selectedCountry.value.toUpperCase(), currency);

      setStep("processing");
      setProcessingMessage(tr("Processing your payment…"));
      // Opens the provider's own hosted, secure checkout page — card details
      // are entered there, never inside this app. This resolves once the
      // person closes/returns from that browser, which is not the same as
      // payment having succeeded — actual confirmation only ever comes from
      // the provider's webhook on the backend, which is what the polling
      // below is watching for.
      await WebBrowser.openBrowserAsync(url);
      pollForFulfillment(orderId);
    } catch (error) {
      const paymentError = toPaymentInitError(error);
      Alert.alert(tr("Unable to start payment"), paymentError.message, [
        { text: tr("Not now"), style: "cancel" },
        { text: tr("Retry"), onPress: () => payWithFlutterwave() },
      ]);
      setStep("preview");
    } finally {
      setPaying(false);
    }
  };

  // Guests get the app instantly with no login screen (see
  // context/LoginProvider.js) — but a real, permanent number is exactly the
  // kind of thing a throwaway guest account shouldn't hold: uninstall the
  // app, clear storage, or lose the device, and a guest session is gone for
  // good along with whatever number was tied to it. This is the one place
  // sign-in is actually required, and only reached if someone tries to do
  // this specific thing.
  const handleGetNumber = () => {
    if (user?.isGuest) {
      Alert.alert(
        tr("Create a free account"),
        tr("Getting a 9tel number ties it to your account, so create a free account first to make sure you don't lose access to it."),
        [
          { text: tr("Not now"), style: "cancel" },
          { text: tr("Create account"), onPress: () => router.push("/sign-up") },
        ]
      );
      return;
    }
    setCountrySearch("");
    setAvailabilityError("");
    setModalOpen(true);
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={s.page}>
        <View style={s.top}>
          <Pressable onPress={() => router.back()} style={s.back}>
            <ChevronLeft size={23} color={themeColor("#211B59")} />
          </Pressable>
          <Text style={s.title}>{tr("Settings")}</Text>
          <View style={s.back} />
        </View>
        <Text style={s.sub}>{tr("Personalize your calling experience.")}</Text>

        <Text style={s.heading}>{tr("YOUR 9TEL NUMBER")}</Text>
        <View style={s.group}>
          <View style={s.row}>
            <View style={s.rowIcon}>
              <Phone size={20} color={themeColor("#5147AF")} />
            </View>
            <View style={s.rowCopy}>
              {loadingNumber ? (
                <ActivityIndicator size="small" color={themeColor("#5147AF")} />
              ) : myNumber ? (
                <>
                  <Text style={s.rowLabel}>{myNumber}</Text>
                  <Text style={s.rowDetail}>{tr("People can reach you on this number")}</Text>
                </>
              ) : (
                <>
                  <Text style={s.rowLabel}>{tr("No number yet")}</Text>
                  <Text style={s.rowDetail}>{tr("Get a number so people can call you")}</Text>
                </>
              )}
            </View>
            {!loadingNumber && !myNumber && (
              <Pressable style={s.getNumberBtn} onPress={handleGetNumber}>
                <Text style={s.getNumberText}>{tr("Get number")}</Text>
              </Pressable>
            )}
          </View>
        </View>

        <Text style={s.heading}>{tr("YOUR CALLER ID")}</Text>
        <View style={s.group}>
          <View style={s.row}>
            <View style={s.rowIcon}>
              <PhoneCall size={20} color={themeColor("#5147AF")} />
            </View>
            <View style={s.rowCopy}>
              {loadingCallerId ? (
                <ActivityIndicator size="small" color={themeColor("#5147AF")} />
              ) : callerId ? (
                <>
                  <Text style={s.rowLabel}>{callerIdMethod === "developer_test" ? tr("Test number · {{number}}", { number: callerId }) : callerId}</Text>
                  <Text style={s.rowDetail}>
                    {callerIdMethod === "developer_test"
                      ? "Synthetic local/test state; calls use the configured Twilio caller ID"
                      : callerIdMethod === "spoken_code"
                        ? tr("Verified as yours. Calls show 9tel's shared number until the provider approves yours")
                        : tr("Shown to people you call, instead of the shared number")}
                  </Text>
                </>
              ) : callerIdStatus === "pending" ? (
                <>
                  <Text style={s.rowLabel}>{tr("Verification in progress")}</Text>
                  <Text style={s.rowDetail}>{tr("Enter the code spoken on the verification call in the app")}</Text>
                </>
              ) : callerIdStatus === "failed" || callerIdStatus === "expired" ? (
                <>
                  <Text style={s.rowLabel}>{tr("Verification {{status}}", { status: callerIdStatus })}</Text>
                  <Text style={s.rowDetail}>{tr("Calls still work and show 9tel's shared number until verification succeeds")}</Text>
                </>
              ) : (
                <>
                  <Text style={s.rowLabel}>{tr("Unverified caller ID")}</Text>
                  <Text style={s.rowDetail}>{tr("You can still call. Recipients see 9tel's shared number, not yours. Verify to use your own.")}</Text>
                </>
              )}
            </View>
            {!loadingCallerId && !callerId && (
              <Pressable style={s.getNumberBtn} onPress={() => router.push("/verify-phone")}>
                <Text style={s.getNumberText}>{callerIdStatus === "pending" ? tr("View") : tr("Verify")}</Text>
              </Pressable>
            )}
          </View>
        </View>

        <Text style={s.heading}>{tr("CALL PREFERENCES")}</Text>
        <View style={s.group}>
          <Toggle icon={Volume2} label={tr("Call sound")} detail={tr("Ringtone & vibration")} value={alerts} onChange={setAlerts} />
          <Toggle icon={Smartphone} label={tr("Wi-Fi calling")} detail={tr("Make calls over Wi-Fi")} value={wifi} onChange={setWifi} />
          <Link icon={PhoneForwarded} label={tr("Call forwarding")} detail={tr("Send calls to another number")} onPress={() => router.push("/(tabs)/(sub-tabs)/call-forwarding")} />
          <Link icon={Ban} label={tr("Blocked numbers")} detail={tr("Manage blocked contacts")} onPress={() => router.push("/(tabs)/(sub-tabs)/blocked-numbers")} />
        </View>

        <Text style={s.heading}>{tr("GENERAL")}</Text>
        <View style={s.group}>
          <Link icon={Globe2} label={t("prefs.language.title", "Language")} detail={languageLabel(i18n.language)} onPress={() => router.push("/(tabs)/(sub-tabs)/language")} />
          <Link icon={Moon} label={t("prefs.appearance.title", "Appearance")} detail={appearanceLabel} onPress={() => router.push("/(tabs)/(sub-tabs)/appearance")} />
          <Link icon={Info} label={t("prefs.about.title", "About")} detail={t("prefs.about.detail", "Version, updates, legal")} onPress={() => router.push("/(tabs)/(sub-tabs)/about")} />
        </View>

        <View style={s.version}>
          <Text style={s.versionBrand}>{tr("9tel")}</Text>
          <Text style={s.versionCopy}>{tr("Version {{version}} · Built for connection", { version: Constants.expoConfig?.version ?? "1.0.0" })}</Text>
        </View>
        <Pressable onPress={() => Alert.alert(tr("Account deletion"), tr("Please contact support to complete this request."))}>
          <Text style={s.delete}>{tr("Delete account")}</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={closeModal}>
        <View style={s.modalBackdrop}>
          <View style={s.modalSheet}>
            {step === "country" && (
              <>
                <View style={s.modalHeader}>
                  <Text style={s.modalTitle}>{tr("Choose your country")}</Text>
                  <Pressable onPress={closeModal} style={s.modalClose}>
                    <X size={20} color={themeColor("#211B59")} />
                  </Pressable>
                </View>
                <Text style={s.modalSub}>{tr("Your number's area code depends on the country you pick.")}</Text>

                <View style={s.searchRow}>
                  <Search size={17} color={themeColor("#9894A9")} />
                  <TextInput
                    value={countrySearch}
                    onChangeText={setCountrySearch}
                    placeholder={tr("Search countries")}
                    placeholderTextColor={themeColor("#9995A8")}
                    style={s.searchInput}
                  />
                </View>

                <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
                  {loadingAvailableCountries ? (
                    <View style={{ alignItems: "center", paddingVertical: 24 }}>
                      <ActivityIndicator color={themeColor("#5147AF")} />
                      <Text style={[s.noResults, { paddingBottom: 0 }]}>{tr("Checking number availability…")}</Text>
                    </View>
                  ) : availableCountriesError ? (
                    <View>
                      <Text style={s.noResults}>{availableCountriesError}</Text>
                      <Text
                        onPress={() => setCountryRefreshKey((key) => key + 1)}
                        style={s.backLink}
                      >
                        Try again
                      </Text>
                    </View>
                  ) : availableCountries.length === 0 ? (
                    <Text style={s.noResults}>{tr("No countries currently have 9tel numbers available.")}</Text>
                  ) : filteredCountries.map((country) => (
                    <Pressable key={country.value} style={s.countryRow} onPress={() => setSelectedCountry(country)}>
                      <Text style={s.countryLabel}>{country.label}</Text>
                      {selectedCountry.value === country.value && <View style={s.countryCheck} />}
                    </Pressable>
                  ))}
                  {!loadingAvailableCountries && !availableCountriesError && availableCountries.length > 0 && filteredCountries.length === 0 && (
                    <Text style={s.noResults}>{tr('No countries match "{{query}}"', { query: countrySearch })}</Text>
                  )}
                </ScrollView>

                {!!availabilityError && <Text style={s.errorText}>{availabilityError}</Text>}

                {availableCountries.length > 0 && !loadingAvailableCountries && !availableCountriesError && (
                  <Pressable style={s.confirmBtn} onPress={checkAvailability} disabled={checkingAvailability}>
                    {checkingAvailability ? (
                      <ActivityIndicator color={themeColor("#FFF")} />
                    ) : (
                      <Text style={s.confirmBtnText}>{tr("Check {{country}} numbers", { country: selectedCountry.label })}</Text>
                    )}
                  </Pressable>
                )}
              </>
            )}

            {step === "preview" && (
              <>
                <View style={s.modalHeader}>
                  <Text style={s.modalTitle}>{tr("Your new number")}</Text>
                  <Pressable onPress={closeModal} style={s.modalClose}>
                    <X size={20} color={themeColor("#211B59")} />
                  </Pressable>
                </View>

                <View style={s.previewCard}>
                  <CheckCircle2 size={22} color={themeColor("#2EAF7D")} />
                  <Text style={s.previewNumber}>{previewNumber}</Text>
                  <Text style={s.previewNote}>
                    This exact number isn't reserved until payment completes — in the rare case someone else takes it
                    first, you'll automatically get the next available {selectedCountry.label} number instead. Your 9tel number access lasts 30 days after payment; renew with Flutterwave to keep it active.
                  </Text>
                </View>

                <Text style={s.modalSub}>{tr("Choose your payment currency")}</Text>

                <CurrencySelector value={currency} onChange={setCurrency} disabled={paying} />

                <Pressable style={s.paymentOption} onPress={payWithFlutterwave} disabled={paying || !ngnNumberPriceReady}>
                  <View style={[s.paymentIcon, { backgroundColor: "#FFF0E0" }]}>
                    <Landmark size={19} color={themeColor("#E17A2D")} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.paymentLabel}>{currency === "NGN" ? tr("Pay {{price}} in NGN with Flutterwave", { price: displayedNumberPrice }) : tr("Pay in USD with Flutterwave")}</Text>
                    <Text style={s.paymentDetail}>{tr("Cards, bank transfer, mobile money")}</Text>
                  </View>
                  {paying ? <ActivityIndicator color={themeColor("#E17A2D")} /> : <ChevronRight size={18} color={themeColor("#AAA6B7")} />}
                </Pressable>

                <Text
                  onPress={() => setStep("country")}
                  style={s.backLink}
                >
                  Choose a different country
                </Text>
              </>
            )}

            {step === "processing" && (
              <View style={{ alignItems: "center", paddingVertical: 30 }}>
                <ActivityIndicator size="large" color={themeColor("#5147AF")} />
                <Text style={[s.modalSub, { textAlign: "center", marginTop: 18 }]}>{processingMessage}</Text>
                <Text
                  onPress={closeModal}
                  style={[s.backLink, { marginTop: 20 }]}
                >
                  {tr("Close — I'll check back later")}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Toggle({ icon: Icon, label, detail, value, onChange }: { icon: any; label: string; detail: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={s.row}>
      <View style={s.rowIcon}>
        <Icon size={20} color={themeColor("#5147AF")} />
      </View>
      <View style={s.rowCopy}>
        <Text style={s.rowLabel}>{label}</Text>
        <Text style={s.rowDetail}>{detail}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ false: "#D9D6E6", true: "#9B95E7" }} thumbColor={value ? "#5F56C6" : "#FFF"} />
    </View>
  );
}

function Link({ icon: Icon, label, detail, onPress }: { icon: any; label: string; detail: string; onPress?: () => void }) {
  return (
    <Pressable style={s.row} onPress={onPress ?? (() => Alert.alert(label, detail))}>
      <View style={s.rowIcon}>
        <Icon size={20} color={themeColor("#5147AF")} />
      </View>
      <View style={s.rowCopy}>
        <Text style={s.rowLabel}>{label}</Text>
        <Text style={s.rowDetail}>{detail}</Text>
      </View>
      <ChevronRight size={19} color={themeColor("#AAA6B7")} />
    </Pressable>
  );
}

const s = themedStyles({
  safe: { flex: 1, backgroundColor: "#F8F8FD" },
  page: { padding: 20, paddingBottom: TAB_BAR_CLEARANCE },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  back: { height: 43, width: 43, borderRadius: 15, backgroundColor: "#FFF", alignItems: "center", justifyContent: "center" },
  title: { color: "#211B59", fontFamily: "Poppins-SemiBold", fontSize: 21 },
  sub: { color: "#85829B", fontFamily: "Poppins-Regular", fontSize: 12, marginTop: 17 },
  heading: { color: "#908CA2", fontFamily: "Poppins-SemiBold", fontSize: 10, letterSpacing: 1, marginTop: 27, marginBottom: 9 },
  group: { backgroundColor: "#FFF", borderRadius: 20, paddingHorizontal: 14 },
  row: { minHeight: 68, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#F1F0F6" },
  rowIcon: { height: 40, width: 40, borderRadius: 14, backgroundColor: "#EEECFF", alignItems: "center", justifyContent: "center" },
  rowCopy: { flex: 1, marginLeft: 12 },
  rowLabel: { color: "#383452", fontFamily: "Poppins-Medium", fontSize: 12.5 },
  rowDetail: { color: "#9693A7", fontFamily: "Poppins-Regular", fontSize: 10, marginTop: 1 },
  getNumberBtn: { backgroundColor: "#5147AF", borderRadius: 14, paddingVertical: 9, paddingHorizontal: 14, minWidth: 92, alignItems: "center" },
  getNumberText: { color: "#FFF", fontFamily: "Poppins-SemiBold", fontSize: 11.5 },
  version: { alignItems: "center", marginTop: 33 },
  versionBrand: { color: "#211B59", fontFamily: "Poppins-Bold", fontSize: 23, letterSpacing: -1 },
  versionCopy: { color: "#A29EAF", fontFamily: "Poppins-Regular", fontSize: 10.5, marginTop: 2 },
  delete: { color: "#E36A65", fontFamily: "Poppins-Medium", fontSize: 12, textAlign: "center", marginTop: 24 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(20,16,45,0.45)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "#FFF", borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingBottom: 30, minHeight: 300 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modalTitle: { color: "#211B59", fontFamily: "Poppins-SemiBold", fontSize: 17 },
  modalClose: { height: 34, width: 34, borderRadius: 12, backgroundColor: "#F1F0F6", alignItems: "center", justifyContent: "center" },
  modalSub: { color: "#8F8BA3", fontFamily: "Poppins-Regular", fontSize: 11.5, marginTop: 6, marginBottom: 16 },
  searchRow: { height: 46, borderRadius: 14, backgroundColor: "#F4F3F9", flexDirection: "row", alignItems: "center", paddingHorizontal: 14, marginBottom: 8 },
  searchInput: { flex: 1, marginLeft: 9, color: "#211B59", fontFamily: "Poppins-Regular", fontSize: 12.5 },
  countryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: "#F4F3F9" },
  countryLabel: { color: "#302C4C", fontFamily: "Poppins-Medium", fontSize: 13 },
  countryCheck: { height: 10, width: 10, borderRadius: 5, backgroundColor: "#5F56C6" },
  noResults: { color: "#9693A7", fontFamily: "Poppins-Regular", fontSize: 12, textAlign: "center", paddingVertical: 20 },
  errorText: { color: "#D9534F", fontFamily: "Poppins-Regular", fontSize: 11.5, marginTop: 10, textAlign: "center" },
  confirmBtn: { marginTop: 16, height: 54, borderRadius: 17, backgroundColor: "#5F56C6", alignItems: "center", justifyContent: "center" },
  confirmBtnText: { color: "#FFF", fontFamily: "Poppins-SemiBold", fontSize: 13.5 },
  previewCard: { backgroundColor: "#F3FAF6", borderRadius: 18, padding: 18, alignItems: "center", marginBottom: 6 },
  previewNumber: { color: "#211B59", fontFamily: "Poppins-Bold", fontSize: 22, marginTop: 8 },
  previewNote: { color: "#7D9E8E", fontFamily: "Poppins-Regular", fontSize: 10.5, textAlign: "center", marginTop: 8, lineHeight: 15 },
  paymentOption: { flexDirection: "row", alignItems: "center", backgroundColor: "#FAFAFD", borderRadius: 16, padding: 13, marginBottom: 10, borderWidth: 1, borderColor: "#F0EFF5" },
  paymentIcon: { height: 38, width: 38, borderRadius: 13, alignItems: "center", justifyContent: "center", marginRight: 12 },
  paymentLabel: { color: "#302C4C", fontFamily: "Poppins-Medium", fontSize: 13 },
  paymentDetail: { color: "#9693A7", fontFamily: "Poppins-Regular", fontSize: 10, marginTop: 1 },
  backLink: { color: "#8B86B8", fontFamily: "Poppins-Regular", fontSize: 12, textAlign: "center", marginTop: 8, textDecorationLine: "underline" },
});
