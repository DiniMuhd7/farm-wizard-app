import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react-native';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Modal } from 'react-native';

const SelectField = ({ title, options, selectedValue, handleValueChange, otherStyles }) => {
    const [searchText, setSearchText] = useState('');
    const [filteredOptions, setFilteredOptions] = useState(options);
    const [dropdownOpen, setDropdownOpen] = useState(false); // Track dropdown visibility

    // Keep the list in sync when options arrive/refresh after mount
    useEffect(() => {
        setFilteredOptions(options);
        setSearchText('');
    }, [options]);

    const handleSearch = (text) => {
        setSearchText(text);
        setFilteredOptions(options.filter(option =>
            option.label.toLowerCase().includes(text.toLowerCase())
        ));
    };

    return (
        <View className={`gap-y-2 ${otherStyles}`}>
            <Text className="text-base text-gray-100 font-pmedium">{title}</Text>

            {/* Dropdown Box */}
            <TouchableOpacity
                onPress={() => setDropdownOpen(!dropdownOpen)}
                className="w-full px-4 py-2 rounded-2xl border-2 border-dotted border-secondary flex-row justify-between items-center"
            >
                {/* <Image source={{ uri: item.flag }} className="w-6 h-4 mr-2 rounded" /> */}
                <Text className="text-white font-psemibold text-base">
                    {selectedValue
                        ? options.find(opt => opt.value === selectedValue)?.label ||
                          selectedValue.charAt(0).toUpperCase() + selectedValue.slice(1)
                        : "Select an option"}
                </Text>
                {dropdownOpen ? (<ArrowUp size={35} color="#ffffff" />) : (<ArrowDown size={35} color="#ffffff" />)}

            </TouchableOpacity>

            {/* Dropdown List - Visible Only When Open */}
            {dropdownOpen && (
                <View className="w-full bg-gray-800 p-2 rounded-lg mt-2">
                    <TextInput
                        className="w-full text-white font-psemibold text-base mb-2"
                        placeholder="Search..."
                        placeholderTextColor="#ffffff"
                        value={searchText}
                        onChangeText={handleSearch}
                    />
                    <ScrollView className="max-h-[200px]">
                        {filteredOptions.map((item) => (
                            <TouchableOpacity
                                key={item.value}
                                onPress={() => {
                                    handleValueChange(item.value);
                                    setSearchText(item.label);
                                    setDropdownOpen(false);
                                }}
                                className="py-2 px-4 bg-gray-700 rounded-lg mb-2"
                            >
                                <Text className="text-white font-psemibold">{item.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    {/* <FlatList
                        data={filteredOptions}
                        keyExtractor={(item) => item.value}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                onPress={() => {
                                    handleValueChange(item.value);
                                    setSearchText(item.label); // Update display text
                                    setDropdownOpen(false); // Close dropdown after selection
                                }}
                                className="py-2 px-4 bg-gray-700 rounded-lg mb-2"
                            >
                                <Text className="text-white font-psemibold">{item.label}</Text>
                            </TouchableOpacity>
                        )}
                    /> */}
                </View>
            )}
        </View>
    );
};

export default SelectField;

export const CustomSelectField = ({ title, options, selectedValue, handleValueChange, otherStyles, variant = 'default' }) => {
    const [searchText, setSearchText] = useState('');
    const [filteredOptions, setFilteredOptions] = useState(options);
    const [modalVisible, setModalVisible] = useState(false); // State to control modal visibility
    const isAuth = variant === 'auth';

    // Keep the list in sync when options arrive/refresh after mount
    useEffect(() => {
        setFilteredOptions(options);
        setSearchText('');
    }, [options]);

    const handleSearch = (text) => {
        setSearchText(text);
        setFilteredOptions(options.filter(option =>
            option.label.toLowerCase().includes(text.toLowerCase())
        ));
    };

    return (
        <View className={`gap-y-2 ${otherStyles}`}>
            <Text className={`text-sm font-pmedium ${isAuth ? 'text-[#D8D5F0]' : 'text-gray-100'}`}>{title}</Text>

            {/* Touchable area for triggering Modal */}
            <TouchableOpacity
                onPress={() => setModalVisible(true)}
                className={`w-full h-14 px-4 rounded-xl flex-row justify-between items-center ${
                    isAuth
                        ? 'bg-[#302A68] border border-white/15'
                        : 'py-2 rounded-2xl border-2 border-dotted border-secondary'
                }`}
            >
                <Text className="text-white font-psemibold text-base">
                    {selectedValue
                        ? options.find(opt => opt.value === selectedValue)?.label ||
                          selectedValue.charAt(0).toUpperCase() + selectedValue.slice(1)
                        : "Select an option"}
                </Text>
                <ArrowDown size={24} color={isAuth ? "#CFCBFF" : "#ffffff"} />
            </TouchableOpacity>

            {/* Modal for displaying the dropdown */}
            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setModalVisible(false)}
            >
                <View className="flex-1 justify-center items-center bg-white/20 bg-opacity-5">
                    <View className={`w-4/5 p-4 rounded-2xl ${isAuth ? 'bg-[#211B59] border border-white/15' : 'bg-gray-600'}`}>
                        {/* Search Input */}
                        <TextInput
                            className="w-full text-white font-psemibold text-base mb-2"
                            placeholder="Search..."
                            placeholderTextColor={isAuth ? "#9C97C4" : "#ffffff"}
                            value={searchText}
                            onChangeText={handleSearch}
                        />

                        {/* Scrollable List of Options */}
                        <ScrollView className="max-h-[200px]">
                            {filteredOptions.map((item) => (
                                <TouchableOpacity
                                    key={item.value}
                                    onPress={() => {
                                        handleValueChange(item.value);
                                        setSearchText(item.label);
                                        setModalVisible(false); // Close modal after selection
                                    }}
                                    className="py-2 px-4 bg-gray-700 rounded-lg mb-2"
                                >
                                    <Text className="text-white font-psemibold">{item.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        {/* Close Button */}
                        <TouchableOpacity
                            onPress={() => setModalVisible(false)}
                            className={`mt-4 px-4 py-2 rounded-full ${isAuth ? 'bg-[#5147AF]' : 'bg-red-500'}`}
                        >
                            <Text className="text-white text-center">Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
};
