import { Pressable, StyleSheet, Text, View } from "react-native";
import { Check, Zap } from "lucide-react-native";
import {
  type CountryCallingPlans,
  formatTierMinutes,
  formatTierPrice,
} from "@/constants/callingPlans";

interface Props {
  plans: CountryCallingPlans;
  selectedTierId: string | null;
  onSelect: (tierId: string) => void;
}

// Minutes-based plan picker shown only to US/UK/Canada accounts (see
// getCallingPlansForCountry) — e.g. "2000 minutes" for a subsidized
// monthly price, with a few pricing tiers to choose from.
export default function CallingPlanTiers({ plans, selectedTierId, onSelect }: Props) {
  return (
    <View>
      <View style={s.headingRow}>
        <Text style={s.heading}>MINUTES PLANS · {plans.countryName.toUpperCase()}</Text>
        <Text style={s.count}>{plans.tiers.length} tiers</Text>
      </View>
      <View style={s.list}>
        {plans.tiers.map((tier) => {
          const selected = selectedTierId === tier.id;
          return (
            <Pressable
              key={tier.id}
              onPress={() => onSelect(tier.id)}
              style={[s.card, selected && s.cardSelected]}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              {tier.popular && (
                <View style={s.popularBadge}>
                  <Zap size={11} color="#211B59" />
                  <Text style={s.popularText}>BEST VALUE</Text>
                </View>
              )}
              <View style={s.tierCopy}>
                <Text style={[s.tierMinutes, selected && s.tierMinutesSelected]}>
                  {formatTierMinutes(tier)}
                </Text>
                <Text style={[s.tierPrice, selected && s.tierPriceSelected]}>
                  {formatTierPrice(tier, plans.currencySymbol)}
                </Text>
              </View>
              <View style={[s.radio, selected && s.radioSelected]}>
                {selected && <Check size={13} color="#FFF" />}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  headingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 27, marginBottom: 10 },
  heading: { color: "#211B59", fontFamily: "Poppins-SemiBold", fontSize: 11, letterSpacing: 0.8 },
  count: { color: "#8D899F", fontFamily: "Poppins-Regular", fontSize: 10 },
  list: { gap: 10 },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: "#EDEBF6",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardSelected: { borderColor: "#5147AF", backgroundColor: "#F3F1FF" },
  tierCopy: { flex: 1 },
  popularBadge: {
    position: "absolute",
    top: -9,
    left: 14,
    backgroundColor: "#7BE4BB",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  popularText: { color: "#12331F", fontFamily: "Poppins-SemiBold", fontSize: 8.5, letterSpacing: 0.4 },
  tierMinutes: { color: "#302C4C", fontFamily: "Poppins-SemiBold", fontSize: 14 },
  tierMinutesSelected: { color: "#211B59" },
  tierPrice: { color: "#85829B", fontFamily: "Poppins-Medium", fontSize: 12, marginTop: 3 },
  tierPriceSelected: { color: "#5147AF" },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#D6D3EA",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  radioSelected: { backgroundColor: "#5147AF", borderColor: "#5147AF" },
});
